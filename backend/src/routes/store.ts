import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const TICKET_SUPPLIER = 'Tienda';

const storeTicketSchema = z.object({
    filename: z.string().min(1),
    mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
    size: z.number().int().min(0),
    content: z.string().min(1),
});

const router = Router();

const storeOrderSchema = z.object({
    customerName: z.string().min(1, 'Nombre requerido'),
    customerPhone: z.string().default(''),
    notes: z.string().default(''),
    items: z.array(z.object({
        articleId: z.string(),
        name: z.string(),
        price: z.number(),
        qty: z.number().int().min(1),
        imageUrl: z.string().nullable().optional(),
        supplierName: z.string().default('Sin proveedor'),
        supplierId: z.string().optional(),
    })).min(1, 'El pedido necesita al menos un artículo'),
});

type ArticleInfo = { image: string | null; supplierName: string };

async function getArticleInfoMap(articleIds: string[]): Promise<Record<string, ArticleInfo>> {
    if (articleIds.length === 0) return {};
    const articles = await prisma.article.findMany({
        where: { id: { in: articleIds } },
        select: {
            id: true,
            image: true,
            suppliers: { include: { supplier: { select: { name: true } } }, take: 1 },
        },
    });
    return Object.fromEntries(articles.map(a => [
        a.id,
        { image: a.image, supplierName: a.suppliers[0]?.supplier?.name ?? '' },
    ]));
}

// For each item, compute how many units were purchased by other suppliers of the same article in the same order.
function addCrossSupplierInfo(items: RawOrder['items']): (RawOrder['items'][number] & { quantityPurchasedByOthers: number })[] {
    // Group by orderId+articleId, sum quantityPurchased per group
    const groupSum: Record<string, number> = {};
    for (const item of items) {
        const key = `${item.orderId}::${item.articleId}`;
        groupSum[key] = (groupSum[key] ?? 0) + item.quantityPurchased;
    }
    return items.map(item => {
        const key = `${item.orderId}::${item.articleId}`;
        const totalByGroup = groupSum[key] ?? 0;
        return { ...item, quantityPurchasedByOthers: totalByGroup - item.quantityPurchased };
    });
}

type RawOrderItem = { id: number; orderId: number; articleId: string; name: string; price: number; qty: number; isPurchased: boolean; quantityPurchased: number; imageUrl: string | null; supplierName: string; supplierId: string | null };
type RawOrder = {
    id: number; dateCreated: Date; status: string; customerName: string;
    customerPhone: string; notes: string; total: number;
    items: RawOrderItem[];
};

function formatStoreOrder(o: RawOrder, articleMap: Record<string, ArticleInfo> = {}) {
    const itemsWithCross = addCrossSupplierInfo(o.items);
    return {
        ...o,
        id: `T-${o.id}`,
        dateCreated: o.dateCreated.toISOString(),
        items: itemsWithCross.map(item => {
            const info = articleMap[item.articleId];
            return {
                ...item,
                imageUrl: info?.image ?? item.imageUrl,
                supplierName: info?.supplierName || item.supplierName || 'Sin proveedor',
            };
        }),
    };
}

router.get('/', async (_req: Request, res: Response) => {
    try {
        const orders = await prisma.storeOrder.findMany({
            include: { items: true },
            orderBy: { dateCreated: 'desc' },
        });
        const allIds = [...new Set(orders.flatMap(o => o.items.map(i => i.articleId)))];
        const articleMap = await getArticleInfoMap(allIds);
        res.json(orders.map(o => formatStoreOrder(o, articleMap)));
    } catch (err) {
        console.error('Error al obtener pedidos de tienda:', err);
        res.status(500).json({ error: 'Error al obtener pedidos de tienda' });
    }
});

router.post('/', async (req: Request, res: Response) => {
    const parsed = storeOrderSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { items, ...rest } = parsed.data;
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    try {
        const order = await prisma.storeOrder.create({
            data: { ...rest, total, items: { create: items } },
            include: { items: true },
        });
        const articleMap = await getArticleInfoMap(order.items.map(i => i.articleId));
        res.status(201).json(formatStoreOrder(order, articleMap));
    } catch (err) {
        console.error('Error al crear pedido de tienda:', err);
        res.status(500).json({ error: 'Error al crear pedido de tienda' });
    }
});

router.patch('/:id/complete', async (req: Request, res: Response) => {
    const rawId = req.params.id.startsWith('T-')
        ? parseInt(req.params.id.slice(2), 10)
        : parseInt(req.params.id, 10);
    if (!Number.isFinite(rawId)) { res.status(400).json({ error: 'ID inválido' }); return; }
    try {
        const order = await prisma.storeOrder.update({
            where: { id: rawId },
            data: { status: 'completed' },
            include: { items: true },
        });
        const articleMap = await getArticleInfoMap(order.items.map(i => i.articleId));
        res.json(formatStoreOrder(order, articleMap));
    } catch (err) {
        console.error('Error al completar pedido de tienda:', err);
        res.status(500).json({ error: 'Error al completar pedido de tienda' });
    }
});

// PATCH /api/store-orders/:id/items/:itemId — toggle purchased / set quantity
router.patch('/:id/items/:itemId', async (req: Request, res: Response) => {
    const itemId = parseInt(req.params.itemId, 10);
    if (!Number.isFinite(itemId)) { res.status(400).json({ error: 'itemId inválido' }); return; }
    const parsed = z.object({
        isPurchased: z.boolean().optional(),
        quantityPurchased: z.number().int().min(0).optional(),
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const item = await prisma.storeOrderItem.update({
            where: { id: itemId },
            data: parsed.data,
        });
        // Compute quantityPurchasedByOthers: sum of quantityPurchased of sibling items (same articleId+orderId)
        const siblings = await prisma.storeOrderItem.findMany({
            where: { orderId: item.orderId, articleId: item.articleId, id: { not: itemId } },
            select: { quantityPurchased: true },
        });
        const quantityPurchasedByOthers = siblings.reduce((s, r) => s + r.quantityPurchased, 0);
        res.json({ ...item, quantityPurchasedByOthers });
    } catch (err) {
        console.error('Error al actualizar item de tienda:', err);
        res.status(500).json({ error: 'Error al actualizar item' });
    }
});

// GET /api/store-orders/:id/tickets
router.get('/:id/tickets', async (req: Request, res: Response) => {
    const rawId = req.params.id.startsWith('T-') ? parseInt(req.params.id.slice(2), 10) : parseInt(req.params.id, 10);
    if (!Number.isFinite(rawId)) { res.status(400).json({ error: 'ID inválido' }); return; }
    try {
        const tickets = await prisma.orderTicket.findMany({
            where: { orderId: rawId, supplierName: TICKET_SUPPLIER },
            select: { id: true, orderId: true, supplierName: true, invoiced: true, filename: true, mimeType: true, size: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(tickets);
    } catch (err) {
        console.error('Error al obtener tickets de tienda:', err);
        res.status(500).json({ error: 'Error al obtener tickets' });
    }
});

// GET /api/store-orders/:id/tickets/:ticketId
router.get('/:id/tickets/:ticketId', async (req: Request, res: Response) => {
    const rawId = req.params.id.startsWith('T-') ? parseInt(req.params.id.slice(2), 10) : parseInt(req.params.id, 10);
    if (!Number.isFinite(rawId)) { res.status(400).json({ error: 'ID inválido' }); return; }
    try {
        const ticket = await prisma.orderTicket.findFirst({ where: { id: req.params.ticketId, orderId: rawId } });
        if (!ticket) { res.status(404).json({ error: 'Ticket no encontrado' }); return; }
        res.json(ticket);
    } catch (err) {
        console.error('Error al obtener ticket:', err);
        res.status(500).json({ error: 'Error al obtener ticket' });
    }
});

// POST /api/store-orders/:id/tickets
router.post('/:id/tickets', async (req: Request, res: Response) => {
    const rawId = req.params.id.startsWith('T-') ? parseInt(req.params.id.slice(2), 10) : parseInt(req.params.id, 10);
    if (!Number.isFinite(rawId)) { res.status(400).json({ error: 'ID inválido' }); return; }
    const parsed = storeTicketSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const ticket = await prisma.orderTicket.create({ data: { orderId: rawId, supplierName: TICKET_SUPPLIER, ...parsed.data } });
        res.status(201).json(ticket);
    } catch (err) {
        console.error('Error al crear ticket de tienda:', err);
        res.status(500).json({ error: 'Error al crear ticket' });
    }
});

// DELETE /api/store-orders/:id/tickets/:ticketId
router.delete('/:id/tickets/:ticketId', async (req: Request, res: Response) => {
    try {
        await prisma.orderTicket.delete({ where: { id: req.params.ticketId } });
        res.json({ success: true });
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
            res.status(404).json({ error: 'Ticket no encontrado' }); return;
        }
        console.error('Error al eliminar ticket de tienda:', err);
        res.status(500).json({ error: 'Error al eliminar ticket' });
    }
});

export default router;
