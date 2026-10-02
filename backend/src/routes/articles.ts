import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { resolveLocationSkuToId } from '../lib/locations';
import { articleIdsWithImage, articleImagePath, isArticleImageUrl } from '../lib/articleImages';

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

function formatArticle(a: ArticleRow, withImage: Set<string>) {
    return {
        id: a.id,
        legacyWooProductId: a.legacyWooProductId,
        name: a.name,
        image: withImage.has(a.id) ? articleImagePath(a) : null,
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

// `image` holds a base64 blob and is deliberately not selected — articles carry
// a URL to routes/articleImages.ts instead. See lib/articleImages.ts.
const articleSelect = {
    id: true, legacyWooProductId: true, name: true, price: true, sku: true, barcode: true,
    category: true, description: true, stockStatus: true, smartDay: true, createdAt: true, updatedAt: true,
    suppliers: { select: { supplierId: true, zone: true } },
    inventory: { select: { location: { select: { code: true } } } },
} as const;

async function formatArticles(rows: ArticleRow[]) {
    const withImage = await articleIdsWithImage(rows.map(a => a.id));
    return rows.map(a => formatArticle(a, withImage));
}

async function formatOne(row: ArticleRow) {
    return (await formatArticles([row]))[0];
}

router.get('/', async (_req: Request, res: Response) => {
    try {
        const articles = await prisma.article.findMany({
            select: articleSelect,
            orderBy: { createdAt: 'asc' },
        });
        res.json(await formatArticles(articles));
    } catch (err) {
        console.error('Error al obtener artículos:', err);
        res.status(500).json({ error: 'Error al obtener artículos' });
    }
});

router.post('/', async (req: Request, res: Response) => {
    const parsed = articleSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { legacyWooProductId, name, price, sku, barcode, category, description, stockStatus, smartDay, supplierIds, supplierZones, locationSku } = parsed.data;
    const image = parsed.data.image && isArticleImageUrl(parsed.data.image) ? null : parsed.data.image;
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
            select: articleSelect,
        });
        res.status(201).json(await formatOne(article));
    } catch (err) {
        console.error('Error al crear artículo:', err);
        res.status(500).json({ error: 'Error al crear artículo' });
    }
});

router.put('/:id', async (req: Request, res: Response) => {
    const parsed = articleSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { legacyWooProductId, name, image, price, sku, barcode, category, description, stockStatus, smartDay, supplierIds, supplierZones, locationSku } = parsed.data;
    // The form sends the picture back as the URL it received. Writing that would
    // replace the image with a link to itself, so leave the column untouched.
    const imageUpdate = image && isArticleImageUrl(image) ? {} : { image };
    try {
        const article = await prisma.article.update({
            where: { id: req.params.id },
            data: {
                ...imageUpdate,
                legacyWooProductId, name, price, sku, barcode, category, description, stockStatus, smartDay,
                suppliers: { deleteMany: {}, create: supplierIds.map((sid: string) => ({ supplierId: sid, zone: supplierZones[sid] ?? '' })) },
            },
            select: articleSelect,
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
                select: articleSelect,
            });
            res.json(await formatOne(refreshed));
            return;
        }

        res.json(await formatOne(article));
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
