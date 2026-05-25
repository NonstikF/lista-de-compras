import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const articleSchema = z.object({
    legacyWooProductId: z.number().int().positive().nullable().optional(),
    name: z.string().min(1, 'Nombre requerido'),
    image: z.string().nullable().default(null),
    price: z.number().min(0, 'Precio inválido'),
    sku: z.string().default(''),
    barcode: z.string().default(''),
    category: z.string().default(''),
    description: z.string().default(''),
    stockStatus: z.string().default(''),
    supplierIds: z.array(z.string()).default([]),
    supplierZones: z.record(z.string(), z.string()).default({}),
});

function formatArticle(a: {
    id: string;
    legacyWooProductId: number | null;
    name: string;
    image: string | null;
    price: number;
    sku: string;
    barcode: string;
    category: string;
    description: string;
    stockStatus: string;
    createdAt: Date;
    updatedAt: Date;
    suppliers: { supplierId: string; zone: string }[];
}) {
    return {
        id: a.id,
        legacyWooProductId: a.legacyWooProductId,
        name: a.name,
        image: a.image,
        price: a.price,
        sku: a.sku,
        barcode: a.barcode,
        category: a.category,
        description: a.description,
        stockStatus: a.stockStatus,
        supplierIds: a.suppliers.map((s) => s.supplierId),
        supplierZones: Object.fromEntries(a.suppliers.map((s) => [s.supplierId, s.zone])),
        createdAt: a.createdAt,
    };
}

router.get('/', async (_req: Request, res: Response) => {
    try {
        const articles = await prisma.article.findMany({
            include: { suppliers: { select: { supplierId: true, zone: true } } },
            orderBy: { createdAt: 'asc' },
        });
        res.json(articles.map(formatArticle));
    } catch (err) {
        console.error('Error al obtener artículos:', err);
        res.status(500).json({ error: 'Error al obtener artículos' });
    }
});

router.post('/', async (req: Request, res: Response) => {
    const parsed = articleSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { legacyWooProductId, name, image, price, sku, barcode, category, description, stockStatus, supplierIds, supplierZones } = parsed.data;
    try {
        const article = await prisma.article.create({
            data: {
                legacyWooProductId, name, image, price, sku, barcode, category, description, stockStatus,
                suppliers: { create: supplierIds.map((sid: string) => ({ supplierId: sid, zone: supplierZones[sid] ?? '' })) },
                inventory: { create: {} },
            },
            include: { suppliers: { select: { supplierId: true, zone: true } } },
        });
        res.status(201).json(formatArticle(article));
    } catch (err) {
        console.error('Error al crear artículo:', err);
        res.status(500).json({ error: 'Error al crear artículo' });
    }
});

router.put('/:id', async (req: Request, res: Response) => {
    const parsed = articleSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { legacyWooProductId, name, image, price, sku, barcode, category, description, stockStatus, supplierIds, supplierZones } = parsed.data;
    try {
        const article = await prisma.article.update({
            where: { id: req.params.id },
            data: {
                legacyWooProductId, name, image, price, sku, barcode, category, description, stockStatus,
                suppliers: { deleteMany: {}, create: supplierIds.map((sid: string) => ({ supplierId: sid, zone: supplierZones[sid] ?? '' })) },
            },
            include: { suppliers: { select: { supplierId: true, zone: true } } },
        });
        res.json(formatArticle(article));
    } catch (err) {
        console.error('Error al actualizar artículo:', err);
        res.status(500).json({ error: 'Error al actualizar artículo' });
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await prisma.article.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        console.error('Error al eliminar artículo:', err);
        res.status(500).json({ error: 'Error al eliminar artículo' });
    }
});

export default router;
