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
    })).min(1, 'El pedido necesita al menos un artículo'),
});

function formatStoreOrder(o: {
    id: number;
    dateCreated: Date;
    status: string;
    customerName: string;
    customerPhone: string;
    notes: string;
    total: number;
    items: { id: number; orderId: number; articleId: string; name: string; price: number; qty: number; isPurchased: boolean; quantityPurchased: number; imageUrl: string | null; supplierName: string }[];
}) {
    return { ...o, id: `T-${o.id}`, dateCreated: o.dateCreated.toISOString() };
}

router.get('/', async (_req: Request, res: Response) => {
    try {
        const orders = await prisma.storeOrder.findMany({
            include: { items: true },
            orderBy: { dateCreated: 'desc' },
        });
        res.json(orders.map(formatStoreOrder));
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
        res.status(201).json(formatStoreOrder(order));
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
        res.json(formatStoreOrder(order));
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
        res.json(item);
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
