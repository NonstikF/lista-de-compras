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

const storeOrderItemShape = z.object({
    articleId: z.string(),
    name: z.string(),
    price: z.number(),
    qty: z.number().int().min(1),
    imageUrl: z.string().nullable().optional(),
    supplierName: z.string().default('Sin proveedor'),
    supplierId: z.string().optional(),
});

const storeOrderSchema = z.object({
    customerName: z.string().min(1, 'Nombre requerido'),
    customerPhone: z.string().default(''),
    notes: z.string().default(''),
    items: z.array(storeOrderItemShape).min(1, 'El pedido necesita al menos un artículo'),
});

function recalcOrderTotal(items: { articleId: string; price: number; qty: number }[]): number {
    const seen = new Set<string>();
    return items.reduce((s, i) => {
        if (seen.has(i.articleId)) return s;
        seen.add(i.articleId);
        return s + i.price * i.qty;
    }, 0);
}

type ArticleInfo = { image: string | null };

async function getArticleInfoMap(articleIds: string[]): Promise<Record<string, ArticleInfo>> {
    if (articleIds.length === 0) return {};
    const articles = await prisma.article.findMany({
        where: { id: { in: articleIds } },
        select: { id: true, image: true },
    });
    return Object.fromEntries(articles.map(a => [a.id, { image: a.image }]));
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
                supplierName: item.supplierName || 'Sin proveedor',
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
    const total = recalcOrderTotal(items);
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
// Returns { item, siblingUpdates } where siblingUpdates contains any sibling items that were auto-updated
router.patch('/:id/items/:itemId', async (req: Request, res: Response) => {
    const itemId = parseInt(req.params.itemId, 10);
    if (!Number.isFinite(itemId)) { res.status(400).json({ error: 'itemId inválido' }); return; }
    const parsed = z.object({
        isPurchased: z.boolean().optional(),
        quantityPurchased: z.number().int().min(0).optional(),
        qty: z.number().int().min(1).optional(),
        price: z.number().min(0).optional(),
        supplierName: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }

    const isStructuralEdit = parsed.data.qty !== undefined || parsed.data.price !== undefined || parsed.data.supplierName !== undefined;

    if (isStructuralEdit) {
        try {
            const { qty, price, supplierName } = parsed.data;
            const item = await prisma.storeOrderItem.update({
                where: { id: itemId },
                data: { ...(qty !== undefined && { qty }), ...(price !== undefined && { price }), ...(supplierName !== undefined && { supplierName }) },
            });
            const allItems = await prisma.storeOrderItem.findMany({ where: { orderId: item.orderId } });
            const newTotal = recalcOrderTotal(allItems);
            await prisma.storeOrder.update({ where: { id: item.orderId }, data: { total: newTotal } });
            const itemsWithCross = addCrossSupplierInfo(allItems);
            const updatedItem = itemsWithCross.find(i => i.id === itemId)!;
            const totalByOthers = itemsWithCross.filter(i => i.articleId === item.articleId && i.id !== itemId).reduce((s, i) => s + i.quantityPurchased, 0);
            res.json({ item: { ...updatedItem, quantityPurchasedByOthers: totalByOthers }, order: { total: newTotal } });
        } catch (err) {
            console.error('Error al editar item de tienda:', err);
            res.status(500).json({ error: 'Error al editar item' });
        }
        return;
    }

    try {
        const item = await prisma.storeOrderItem.update({
            where: { id: itemId },
            data: { isPurchased: parsed.data.isPurchased, quantityPurchased: parsed.data.quantityPurchased },
        });
        let siblingUpdates: typeof item[] = [];

        if (parsed.data.isPurchased === true || parsed.data.isPurchased === false) {
            // Full toggle: sync all siblings to the same isPurchased state
            const siblings = await prisma.storeOrderItem.findMany({
                where: { orderId: item.orderId, articleId: item.articleId, id: { not: itemId } },
            });
            if (siblings.length > 0) {
                await prisma.storeOrderItem.updateMany({
                    where: { orderId: item.orderId, articleId: item.articleId, id: { not: itemId } },
                    data: { isPurchased: parsed.data.isPurchased, quantityPurchased: parsed.data.isPurchased ? item.qty : 0 },
                });
                siblingUpdates = siblings.map(s => ({
                    ...s,
                    isPurchased: parsed.data.isPurchased!,
                    quantityPurchased: parsed.data.isPurchased ? s.qty : 0,
                }));
            }
        } else if (parsed.data.quantityPurchased !== undefined) {
            // Partial increment/decrement: check if total across all siblings covers the required qty
            const siblings = await prisma.storeOrderItem.findMany({
                where: { orderId: item.orderId, articleId: item.articleId, id: { not: itemId } },
            });
            const siblingsTotal = siblings.reduce((s, r) => s + r.quantityPurchased, 0);
            const grandTotal = item.quantityPurchased + siblingsTotal;
            // item.qty is the total required quantity for this article
            if (grandTotal >= item.qty && !item.isPurchased) {
                // All units covered — mark all as purchased
                await prisma.storeOrderItem.update({ where: { id: itemId }, data: { isPurchased: true } });
                item.isPurchased = true;
                if (siblings.length > 0) {
                    await prisma.storeOrderItem.updateMany({
                        where: { orderId: item.orderId, articleId: item.articleId, id: { not: itemId } },
                        data: { isPurchased: true },
                    });
                    siblingUpdates = siblings.map(s => ({ ...s, isPurchased: true }));
                }
            } else if (grandTotal < item.qty && item.isPurchased) {
                // Units no longer fully covered — unmark all
                await prisma.storeOrderItem.update({ where: { id: itemId }, data: { isPurchased: false } });
                item.isPurchased = false;
                if (siblings.length > 0) {
                    await prisma.storeOrderItem.updateMany({
                        where: { orderId: item.orderId, articleId: item.articleId, id: { not: itemId } },
                        data: { isPurchased: false },
                    });
                    siblingUpdates = siblings.map(s => ({ ...s, isPurchased: false }));
                }
            } else {
                siblingUpdates = siblings;
            }
        }

        const siblings = siblingUpdates.length > 0
            ? siblingUpdates
            : await prisma.storeOrderItem.findMany({
                where: { orderId: item.orderId, articleId: item.articleId, id: { not: itemId } },
            });
        const totalByOthers = siblings.reduce((s, r) => s + r.quantityPurchased, 0);
        res.json({ item: { ...item, quantityPurchasedByOthers: totalByOthers }, siblingUpdates: siblings.map(s => ({ ...s, quantityPurchasedByOthers: item.quantityPurchased })) });
    } catch (err) {
        console.error('Error al actualizar item de tienda:', err);
        res.status(500).json({ error: 'Error al actualizar item' });
    }
});

// POST /api/store-orders/:id/items — add a new item to an existing pending order
router.post('/:id/items', async (req: Request, res: Response) => {
    const rawId = req.params.id.startsWith('T-') ? parseInt(req.params.id.slice(2), 10) : parseInt(req.params.id, 10);
    if (!Number.isFinite(rawId)) { res.status(400).json({ error: 'ID inválido' }); return; }
    const parsed = storeOrderItemShape.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const order = await prisma.storeOrder.findUnique({ where: { id: rawId } });
        if (!order) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
        if (order.status !== 'pending') { res.status(409).json({ error: 'Solo se pueden editar pedidos pendientes' }); return; }
        const newItem = await prisma.storeOrderItem.create({ data: { orderId: rawId, ...parsed.data } });
        const allItems = await prisma.storeOrderItem.findMany({ where: { orderId: rawId } });
        const newTotal = recalcOrderTotal(allItems);
        await prisma.storeOrder.update({ where: { id: rawId }, data: { total: newTotal } });
        const itemsWithCross = addCrossSupplierInfo(allItems);
        const articleMap = await getArticleInfoMap([newItem.articleId]);
        const crossItem = itemsWithCross.find(i => i.id === newItem.id)!;
        const totalByOthers = itemsWithCross.filter(i => i.articleId === newItem.articleId && i.id !== newItem.id).reduce((s, i) => s + i.quantityPurchased, 0);
        res.status(201).json({
            item: { ...crossItem, imageUrl: articleMap[newItem.articleId]?.image ?? newItem.imageUrl, quantityPurchasedByOthers: totalByOthers },
            order: { total: newTotal },
        });
    } catch (err) {
        console.error('Error al agregar item a pedido de tienda:', err);
        res.status(500).json({ error: 'Error al agregar item' });
    }
});

// DELETE /api/store-orders/:id/items/:itemId — remove an item from a pending order
router.delete('/:id/items/:itemId', async (req: Request, res: Response) => {
    const rawId = req.params.id.startsWith('T-') ? parseInt(req.params.id.slice(2), 10) : parseInt(req.params.id, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (!Number.isFinite(rawId) || !Number.isFinite(itemId)) { res.status(400).json({ error: 'ID inválido' }); return; }
    try {
        const item = await prisma.storeOrderItem.findUnique({ where: { id: itemId } });
        if (!item || item.orderId !== rawId) { res.status(404).json({ error: 'Item no encontrado' }); return; }
        const order = await prisma.storeOrder.findUnique({ where: { id: rawId } });
        if (!order || order.status !== 'pending') { res.status(409).json({ error: 'Solo se pueden editar pedidos pendientes' }); return; }
        await prisma.storeOrderItem.delete({ where: { id: itemId } });
        const remaining = await prisma.storeOrderItem.findMany({ where: { orderId: rawId } });
        const newTotal = recalcOrderTotal(remaining);
        await prisma.storeOrder.update({ where: { id: rawId }, data: { total: newTotal } });
        res.json({ success: true, order: { total: newTotal } });
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
            res.status(404).json({ error: 'Item no encontrado' }); return;
        }
        console.error('Error al eliminar item de tienda:', err);
        res.status(500).json({ error: 'Error al eliminar item' });
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
