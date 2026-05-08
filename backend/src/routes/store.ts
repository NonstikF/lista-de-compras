import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

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
    items: { id: number; orderId: number; articleId: string; name: string; price: number; qty: number }[];
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

export default router;
