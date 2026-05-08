import { Router, Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { ensureInventoryForAllArticles } from './inventory';
import type { WooCommerceProduct } from '../types';

const router = Router();

const articleSchema = z.object({
    wooProductId: z.number().int().positive().nullable().optional(),
    name: z.string().min(1, 'Nombre requerido'),
    image: z.string().nullable().default(null),
    price: z.number().min(0, 'Precio inválido'),
    sku: z.string().default(''),
    category: z.string().default(''),
    description: z.string().default(''),
    stockStatus: z.string().default(''),
    supplierIds: z.array(z.string()).default([]),
});

function formatArticle(a: {
    id: string;
    wooProductId: number | null;
    name: string;
    image: string | null;
    price: number;
    sku: string;
    category: string;
    description: string;
    stockStatus: string;
    createdAt: Date;
    updatedAt: Date;
    suppliers: { supplierId: string }[];
}) {
    return {
        id: a.id,
        wooProductId: a.wooProductId,
        name: a.name,
        image: a.image,
        price: a.price,
        sku: a.sku,
        category: a.category,
        description: a.description,
        stockStatus: a.stockStatus,
        supplierIds: a.suppliers.map((s: { supplierId: string }) => s.supplierId),
        createdAt: a.createdAt,
    };
}

function stripHtml(value: string | undefined): string {
    return (value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function productPrice(product: WooCommerceProduct): number {
    const raw = product.price || product.sale_price || product.regular_price || '0';
    const price = Number.parseFloat(raw);
    return Number.isFinite(price) && price >= 0 ? price : 0;
}

function mapWooProductToArticle(product: WooCommerceProduct) {
    return {
        wooProductId: product.id,
        name: product.name.trim(),
        image: product.images?.[0]?.src || null,
        price: productPrice(product),
        sku: product.sku || '',
        category: product.categories?.[0]?.name || '',
        description: stripHtml(product.short_description || product.description),
        stockStatus: product.stock_status || '',
    };
}

async function fetchWooProducts(): Promise<WooCommerceProduct[]> {
    const { WOO_URL, WOO_KEY, WOO_SECRET } = process.env;
    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        throw new Error('Variables de API de WooCommerce no configuradas en el servidor');
    }

    const products: WooCommerceProduct[] = [];
    const perPage = 100;
    let page = 1;

    while (true) {
        const response = await axios.get(`${WOO_URL}/wp-json/wc/v3/products`, {
            auth: { username: WOO_KEY, password: WOO_SECRET },
            params: { page, per_page: perPage, status: 'publish' },
            timeout: 20000,
        });
        const batch: WooCommerceProduct[] = response.data;
        products.push(...batch);
        if (batch.length < perPage) break;
        page += 1;
    }

    return products;
}

router.get('/', async (_req: Request, res: Response) => {
    try {
        const articles = await prisma.article.findMany({
            include: { suppliers: { select: { supplierId: true } } },
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
    const { wooProductId, name, image, price, sku, category, description, stockStatus, supplierIds } = parsed.data;
    try {
        const article = await prisma.article.create({
            data: {
                wooProductId, name, image, price, sku, category, description, stockStatus,
                suppliers: { create: supplierIds.map((sid: string) => ({ supplierId: sid })) },
                inventory: { create: {} },
            },
            include: { suppliers: { select: { supplierId: true } } },
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
    const { wooProductId, name, image, price, sku, category, description, stockStatus, supplierIds } = parsed.data;
    try {
        const article = await prisma.article.update({
            where: { id: req.params.id },
            data: {
                wooProductId, name, image, price, sku, category, description, stockStatus,
                suppliers: { deleteMany: {}, create: supplierIds.map((sid: string) => ({ supplierId: sid })) },
            },
            include: { suppliers: { select: { supplierId: true } } },
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

router.post('/import-woocommerce', async (_req: Request, res: Response) => {
    try {
        const products = await fetchWooProducts();
        let created = 0, updated = 0, skipped = 0;

        for (const product of products) {
            const data = mapWooProductToArticle(product);
            if (!data.name) { skipped += 1; continue; }

            const existing = await prisma.article.findFirst({
                where: { OR: [{ wooProductId: data.wooProductId }, { name: data.name }] },
                select: { id: true },
            });

            if (existing) {
                await prisma.article.update({ where: { id: existing.id }, data });
                updated += 1;
            } else {
                await prisma.article.create({ data: { ...data, inventory: { create: {} } } });
                created += 1;
            }
        }

        await ensureInventoryForAllArticles();

        const articles = await prisma.article.findMany({
            include: { suppliers: { select: { supplierId: true } } },
            orderBy: { createdAt: 'asc' },
        });

        res.json({ created, updated, skipped, total: products.length, articles: articles.map(formatArticle) });
    } catch (err) {
        const axiosErr = err as { response?: { data?: unknown }; message?: string };
        console.error('Error al importar de WooCommerce:', axiosErr.response?.data || axiosErr.message || err);
        res.status(500).json({ error: axiosErr.message || 'No se pudieron importar productos de WooCommerce' });
    }
});

export default router;
