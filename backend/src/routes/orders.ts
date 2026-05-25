import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const orderTicketSchema = z.object({
    supplierName: z.string().min(1, 'Nombre de proveedor requerido'),
    filename: z.string().min(1, 'Nombre de archivo requerido'),
    mimeType: z.string().refine(
        v => ['image/jpeg', 'image/png', 'application/pdf'].includes(v),
        { message: 'Tipo de archivo no permitido. Usa JPG, PNG o PDF.' }
    ),
    size: z.number().int().min(1).max(1_000_000, 'El archivo no puede superar 1 MB'),
    content: z.string().min(1, 'Contenido requerido'),
});

// Adapter: traduce StoreOrder -> formato Order (compat retro con UI Woo).
// Soporta query ?status=processing|completed (mapea processing -> pending).
router.get('/', async (req: Request, res: Response) => {
    const requestedStatus = req.query.status as string;
    const statusFilter = requestedStatus === 'completed' ? 'completed' : 'pending';

    try {
        const orders = await prisma.storeOrder.findMany({
            where: { status: statusFilter },
            include: { items: true },
            orderBy: { dateCreated: 'desc' },
        });

        const articleIds = [...new Set(orders.flatMap(o => o.items.map(i => i.articleId).filter(Boolean)))];
        const articles = articleIds.length > 0
            ? await prisma.article.findMany({
                where: { id: { in: articleIds } },
                select: {
                    id: true, image: true, category: true,
                    suppliers: { select: { supplierId: true, supplier: { select: { id: true, name: true } } } },
                },
            })
            : [];
        const articleMap = new Map(articles.map(a => [a.id, a]));

        const result = orders.map(o => {
            const nameParts = o.customerName.split(/\s+/);
            return {
                id: o.id,
                dateCreated: o.dateCreated.toISOString(),
                status: o.status === 'completed' ? 'completed' : 'processing',
                total: o.total.toFixed(2),
                customer: { firstName: nameParts[0] ?? '', lastName: nameParts.slice(1).join(' ') },
                lineItems: o.items.map(item => {
                    const art = articleMap.get(item.articleId);
                    const suppliers = art?.suppliers.map(s => ({ id: s.supplier.id, name: s.supplier.name })) ?? [];
                    const quantityBySupplier: Record<string, number> = {};
                    if (item.supplierId && suppliers.some(s => s.id === item.supplierId)) {
                        quantityBySupplier[item.supplierId] = item.quantityPurchased;
                    }
                    return {
                        id: item.id,
                        name: item.name,
                        productId: 0,
                        quantity: item.qty,
                        sku: '',
                        total: (item.price * item.qty).toFixed(2),
                        isPurchased: item.isPurchased,
                        quantityPurchased: item.quantityPurchased,
                        category: art?.category || 'Sin Categoria',
                        imageUrl: item.imageUrl ?? art?.image ?? null,
                        suppliers,
                        quantityBySupplier,
                    };
                }),
            };
        });

        res.json(result);
    } catch (error: unknown) {
        console.error('Error al obtener pedidos:', error);
        res.status(500).json({ error: 'No se pudieron obtener pedidos' });
    }
});

// POST /api/orders/:id/complete
router.post('/:id/complete', async (req: Request, res: Response) => {
    const orderIdNum = Number(req.params.id);
    if (!Number.isFinite(orderIdNum)) {
        res.status(400).json({ error: 'orderId invalido. Debe ser numerico' });
        return;
    }
    try {
        const order = await prisma.storeOrder.update({
            where: { id: orderIdNum },
            data: { status: 'completed' },
        });
        res.status(200).json({ success: true, updatedOrder: order });
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
            res.status(404).json({ error: 'Pedido no encontrado' });
            return;
        }
        console.error('Error al completar pedido:', err);
        res.status(500).json({ error: 'Error interno completando pedido' });
    }
});

// GET /api/orders/:orderId/ticket-counts
router.get('/:orderId/ticket-counts', async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) { res.status(400).json({ error: 'orderId inválido' }); return; }
    try {
        const rows = await prisma.orderTicket.groupBy({
            by: ['supplierName'],
            where: { orderId },
            _count: { id: true },
        });
        const counts: Record<string, number> = {};
        for (const row of rows) counts[row.supplierName] = row._count.id;
        res.json(counts);
    } catch (err) {
        console.error('Error al obtener conteos de tickets:', err);
        res.status(500).json({ error: 'Error al obtener conteos' });
    }
});

// GET /api/orders/:orderId/tickets
router.get('/:orderId/tickets', async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) { res.status(400).json({ error: 'orderId inválido' }); return; }
    const { supplierName } = req.query;
    try {
        const tickets = await prisma.orderTicket.findMany({
            where: { orderId, ...(supplierName ? { supplierName: String(supplierName) } : {}) },
            select: { id: true, orderId: true, supplierName: true, invoiced: true, filename: true, mimeType: true, size: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(tickets);
    } catch (err) {
        console.error('Error al obtener tickets de pedido:', err);
        res.status(500).json({ error: 'Error al obtener tickets' });
    }
});

// GET /api/orders/:orderId/tickets/:ticketId
router.get('/:orderId/tickets/:ticketId', async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) { res.status(400).json({ error: 'orderId inválido' }); return; }
    try {
        const ticket = await prisma.orderTicket.findFirst({ where: { id: req.params.ticketId, orderId } });
        if (!ticket) { res.status(404).json({ error: 'Ticket no encontrado' }); return; }
        res.json(ticket);
    } catch (err) {
        console.error('Error al obtener ticket:', err);
        res.status(500).json({ error: 'Error al obtener ticket' });
    }
});

// POST /api/orders/:orderId/tickets
router.post('/:orderId/tickets', async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) { res.status(400).json({ error: 'orderId inválido' }); return; }
    const parsed = orderTicketSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const ticket = await prisma.orderTicket.create({ data: { orderId, ...parsed.data } });
        res.status(201).json(ticket);
    } catch (err) {
        console.error('Error al crear ticket:', err);
        res.status(500).json({ error: 'Error al crear ticket' });
    }
});

// DELETE /api/orders/:orderId/tickets/:ticketId
router.delete('/:orderId/tickets/:ticketId', async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) { res.status(400).json({ error: 'orderId inválido' }); return; }
    try {
        await prisma.orderTicket.delete({ where: { id: req.params.ticketId } });
        res.json({ success: true });
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
            res.status(404).json({ error: 'Ticket no encontrado' }); return;
        }
        console.error('Error al eliminar ticket:', err);
        res.status(500).json({ error: 'Error al eliminar ticket' });
    }
});

// PATCH /api/orders/:orderId/tickets/:ticketId — toggle invoiced
router.patch('/:orderId/tickets/:ticketId', async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) { res.status(400).json({ error: 'orderId inválido' }); return; }
    const parsed = z.object({ invoiced: z.boolean() }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invoiced debe ser boolean' }); return; }
    try {
        const ticket = await prisma.orderTicket.update({
            where: { id: req.params.ticketId },
            data: { invoiced: parsed.data.invoiced },
            select: { id: true, orderId: true, supplierName: true, invoiced: true, filename: true, mimeType: true, size: true, createdAt: true },
        });
        res.json(ticket);
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
            res.status(404).json({ error: 'Ticket no encontrado' }); return;
        }
        console.error('Error al actualizar ticket:', err);
        res.status(500).json({ error: 'Error al actualizar ticket' });
    }
});

export default router;
