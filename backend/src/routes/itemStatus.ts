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

router.post('/', async (req: Request, res: Response) => {
    const parsed = itemStatusSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
    }
    const { lineItemId, orderId, supplierId, totalQuantity } = parsed.data;
    let { isPurchased, quantityPurchased } = parsed.data;

    try {
        if (supplierId !== undefined) {
            // Update per-supplier quantity
            await prisma.purchaseStatusBySupplier.upsert({
                where: { lineItemId_supplierId: { lineItemId, supplierId } },
                update: { quantity: quantityPurchased },
                create: { lineItemId, supplierId, orderId, quantity: quantityPurchased },
            });

            // Recalculate total from all suppliers
            const allSupplierRows = await prisma.purchaseStatusBySupplier.findMany({ where: { lineItemId } });
            const totalPurchased = allSupplierRows.reduce((sum, r) => sum + r.quantity, 0);
            const total = totalQuantity ?? totalPurchased;
            quantityPurchased = totalPurchased;
            isPurchased = totalPurchased >= total && total > 0;
        }

        const status = await prisma.purchaseStatus.upsert({
            where: { lineItemId },
            update: { isPurchased, quantityPurchased },
            create: { lineItemId, orderId, isPurchased, quantityPurchased },
        });
        res.json({ success: true, status });
    } catch (error) {
        console.error('Error al guardar estado:', error);
        res.status(500).json({ error: 'No se pudo guardar el estado' });
    }
});

export default router;
