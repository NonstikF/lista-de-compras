import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { resolveLocationSkuToId } from '../lib/locations';

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
    smartDay: z.boolean().default(false),
    supplierIds: z.array(z.string()).default([]),
    supplierZones: z.record(z.string(), z.string()).default({}),
    locationSku: z.string().nullable().optional(),
});

type ArticleRow = {
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
    smartDay: boolean;
    createdAt: Date;
    updatedAt: Date;
    suppliers: { supplierId: string; zone: string }[];
    inventory: { location: { code: string } | null } | null;
};

function formatArticle(a: ArticleRow) {
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
        smartDay: a.smartDay,
        supplierIds: a.suppliers.map((s) => s.supplierId),
        supplierZones: Object.fromEntries(a.suppliers.map((s) => [s.supplierId, s.zone])),
        locationSku: a.inventory?.location?.code ?? '',
        createdAt: a.createdAt,
    };
}

const articleInclude = {
    suppliers: { select: { supplierId: true, zone: true } },
    inventory: { select: { location: { select: { code: true } } } },
} as const;

router.get('/', async (_req: Request, res: Response) => {
    try {
        const articles = await prisma.article.findMany({
            include: articleInclude,
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
    const { legacyWooProductId, name, image, price, sku, barcode, category, description, stockStatus, smartDay, supplierIds, supplierZones, locationSku } = parsed.data;
    let locationId: string | null = null;
    if (locationSku !== undefined) {
        try {
            locationId = await resolveLocationSkuToId(locationSku);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al asignar ubicación';
            res.status(409).json({ error: message });
            return;
        }
    }
    try {
        const article = await prisma.article.create({
            data: {
                legacyWooProductId, name, image, price, sku, barcode, category, description, stockStatus, smartDay,
                suppliers: { create: supplierIds.map((sid: string) => ({ supplierId: sid, zone: supplierZones[sid] ?? '' })) },
                inventory: { create: { locationId } },
            },
            include: articleInclude,
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
    const { legacyWooProductId, name, image, price, sku, barcode, category, description, stockStatus, smartDay, supplierIds, supplierZones, locationSku } = parsed.data;
    try {
        const article = await prisma.article.update({
            where: { id: req.params.id },
            data: {
                legacyWooProductId, name, image, price, sku, barcode, category, description, stockStatus, smartDay,
                suppliers: { deleteMany: {}, create: supplierIds.map((sid: string) => ({ supplierId: sid, zone: supplierZones[sid] ?? '' })) },
            },
            include: articleInclude,
        });

        if (locationSku !== undefined) {
            let locationId: string | null;
            try {
                locationId = await resolveLocationSkuToId(locationSku);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Error al asignar ubicación';
                res.status(409).json({ error: message });
                return;
            }
            await prisma.inventoryItem.upsert({
                where: { articleId: article.id },
                create: { articleId: article.id, locationId },
                update: { locationId },
            });
            const refreshed = await prisma.article.findUniqueOrThrow({
                where: { id: article.id },
                include: articleInclude,
            });
            res.json(formatArticle(refreshed));
            return;
        }

        res.json(formatArticle(article));
    } catch (err) {
        console.error('Error al actualizar artículo:', err);
        res.status(500).json({ error: 'Error al actualizar artículo' });
    }
});

const bulkSchema = z.object({
    ids: z.array(z.string().min(1)).min(1, 'Selecciona al menos un artículo'),
    action: z.discriminatedUnion('type', [
        z.object({ type: z.literal('smartDay'), value: z.boolean() }),
        z.object({ type: z.literal('addSupplier'), supplierId: z.string().min(1), zone: z.string().default('') }),
    ]),
});

router.patch('/bulk', async (req: Request, res: Response) => {
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { ids, action } = parsed.data;

    try {
        if (action.type === 'smartDay') {
            let targetIds = ids;
            let skipped = 0;
            // Al marcar SmartDay solo aplican artículos con algún proveedor que tenga SmartDay habilitado.
            if (action.value) {
                const articles = await prisma.article.findMany({
                    where: { id: { in: ids } },
                    select: { id: true, suppliers: { select: { supplier: { select: { smartDayEnabled: true } } } } },
                });
                const eligible = articles.filter((a) => a.suppliers.some((s) => s.supplier.smartDayEnabled));
                targetIds = eligible.map((a) => a.id);
                skipped = ids.length - targetIds.length;
            }
            if (targetIds.length > 0) {
                await prisma.article.updateMany({
                    where: { id: { in: targetIds } },
                    data: { smartDay: action.value },
                });
            }
            res.json({ updated: targetIds.length, skipped });
            return;
        }

        // addSupplier: agrega el proveedor a los artículos que no lo tengan ya
        const existing = await prisma.articleSupplier.findMany({
            where: { articleId: { in: ids }, supplierId: action.supplierId },
            select: { articleId: true },
        });
        const alreadyHas = new Set(existing.map((e) => e.articleId));
        const toAdd = ids.filter((id) => !alreadyHas.has(id));
        if (toAdd.length > 0) {
            await prisma.articleSupplier.createMany({
                data: toAdd.map((articleId) => ({ articleId, supplierId: action.supplierId, zone: action.zone })),
            });
        }
        res.json({ updated: toAdd.length, skipped: ids.length - toAdd.length });
    } catch (err) {
        console.error('Error en actualización masiva de artículos:', err);
        res.status(500).json({ error: 'Error en la actualización masiva' });
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
