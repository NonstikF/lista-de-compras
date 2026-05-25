import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const itemStatusSchema = z.object({
    lineItemId: z.number({ error: 'lineItemId es requerido' }),
    orderId: z.number({ error: 'orderId es requerido' }),
    isPurchased: z.boolean(),
    quantityPurchased: z.number().int().min(0),
    supplierId: z.string().optional(),
    totalQuantity: z.number().int().min(0).optional(),
});

// POST /api/item-status
// Actualiza estado de compra de un StoreOrderItem.
// lineItemId aqui = StoreOrderItem.id (post-migracion Woo).
// supplierId es informativo: el nuevo modelo no rastrea por proveedor (StoreOrderItem ya esta segmentado).
router.post('/', async (req: Request, res: Response) => {
    const parsed = itemStatusSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
    }
    const { lineItemId, isPurchased, quantityPurchased } = parsed.data;

    try {
        const item = await prisma.storeOrderItem.update({
            where: { id: lineItemId },
            data: { isPurchased, quantityPurchased },
        });
        res.json({ success: true, status: item });
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
            res.status(404).json({ error: 'Item no encontrado' });
            return;
        }
        console.error('Error al guardar estado:', err);
        res.status(500).json({ error: 'No se pudo guardar el estado' });
    }
});

export default router;
