import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const updateInventoryItemSchema = z.object({
    stockMin: z.number().optional(),
    unit: z.string().optional(),
    locationId: z.string().nullable().optional(),
});

const createMovementSchema = z.object({
    type: z.enum(['entrada', 'salida', 'ajuste']),
    quantity: z.number().positive('La cantidad debe ser positiva'),
    reason: z.string().default(''),
});

export async function ensureInventoryForAllArticles(): Promise<void> {
    const orphans = await prisma.article.findMany({
        where: { inventory: null },
        select: { id: true },
    });
    if (orphans.length === 0) return;
    await prisma.inventoryItem.createMany({
        data: orphans.map(a => ({ articleId: a.id })),
        skipDuplicates: true,
    });
}

router.get('/', async (_req: Request, res: Response) => {
    try {
        await ensureInventoryForAllArticles();
        const items = await prisma.inventoryItem.findMany({
            include: {
                article: { select: { id: true, name: true, image: true, category: true } },
                location: { select: { id: true, name: true, code: true } },
                _count: { select: { movements: true } },
            },
            orderBy: { article: { name: 'asc' } },
        });
        res.json(items);
    } catch (err) {
        console.error('Error al obtener inventario:', err);
        res.status(500).json({ error: 'Error al obtener inventario' });
    }
});

router.put('/:id', async (req: Request, res: Response) => {
    const parsed = updateInventoryItemSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
    }
    const data: { stockMin?: number; unit?: string; locationId?: string | null } = {};
    if (parsed.data.stockMin !== undefined) data.stockMin = parsed.data.stockMin;
    if (parsed.data.unit !== undefined) data.unit = parsed.data.unit;
    if (parsed.data.locationId !== undefined) data.locationId = parsed.data.locationId;
    try {
        const item = await prisma.inventoryItem.update({
            where: { id: req.params.id },
            data,
            include: {
                article: { select: { id: true, name: true, image: true, category: true } },
                location: { select: { id: true, name: true, code: true } },
                _count: { select: { movements: true } },
            },
        });
        res.json(item);
    } catch {
        res.status(404).json({ error: 'Item de inventario no encontrado' });
    }
});

router.post('/:id/movements', async (req: Request, res: Response) => {
    const parsed = createMovementSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
    }
    const { type, quantity, reason } = parsed.data;
    const userId = req.user!.userId;
    const userName = req.user!.username;
    try {
        const item = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
        if (!item) {
            res.status(404).json({ error: 'Item de inventario no encontrado' });
            return;
        }
        let newStock: number;
        if (type === 'entrada') newStock = item.stock + quantity;
        else if (type === 'salida') newStock = item.stock - quantity;
        else newStock = quantity;

        const [movement] = await prisma.$transaction([
            prisma.inventoryMovement.create({
                data: { inventoryItemId: item.id, type, quantity, reason, userId, userName },
            }),
            prisma.inventoryItem.update({
                where: { id: item.id },
                data: { stock: newStock },
            }),
        ]);
        res.status(201).json(movement);
    } catch (err) {
        console.error('Error al registrar movimiento:', err);
        res.status(500).json({ error: 'Error al registrar movimiento' });
    }
});

router.get('/:id/movements', async (req: Request, res: Response) => {
    try {
        const movements = await prisma.inventoryMovement.findMany({
            where: { inventoryItemId: req.params.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json(movements);
    } catch (err) {
        console.error('Error al obtener movimientos:', err);
        res.status(500).json({ error: 'Error al obtener movimientos' });
    }
});

export default router;
