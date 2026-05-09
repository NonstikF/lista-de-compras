import { Router, Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import type { WooCommerceOrder, WooCommerceProduct, WooCommerceLineItem } from '../types';

const router = Router();

// ---- In-memory product cache ----
const PRODUCT_CACHE_TTL = 10 * 60 * 1000;
interface CachedProduct { category: string; imageUrl: string | null; cachedAt: number; }
const productCache = new Map<number, CachedProduct>();

function getCachedProduct(productId: number): { category: string; imageUrl: string | null } | null {
    const cached = productCache.get(productId);
    if (!cached) return null;
    if (Date.now() - cached.cachedAt > PRODUCT_CACHE_TTL) { productCache.delete(productId); return null; }
    return { category: cached.category, imageUrl: cached.imageUrl };
}

function setCachedProduct(productId: number, category: string, imageUrl: string | null): void {
    productCache.set(productId, { category, imageUrl, cachedAt: Date.now() });
}

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

// GET /api/orders
router.get('/', async (req: Request, res: Response) => {
    const { WOO_URL, WOO_KEY, WOO_SECRET } = process.env;
    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        res.status(500).json({ error: 'Variables de API de WooCommerce no configuradas en el servidor' });
        return;
    }

    const requestedStatus = req.query.status as string;
    const wooStatusString = requestedStatus === 'completed' ? 'completed' : 'processing,on-hold';

    try {
        const ordersResponse = await axios.get(`${WOO_URL}/wp-json/wc/v3/orders`, {
            auth: { username: WOO_KEY, password: WOO_SECRET },
            params: { status: wooStatusString, per_page: 100 },
            timeout: 15000,
        });
        const rawOrders: WooCommerceOrder[] = ordersResponse.data;
        if (rawOrders.length === 0) { res.json([]); return; }

        const productIds = new Set<number>();
        rawOrders.forEach(order => order.line_items.forEach((item: WooCommerceLineItem) => {
            if (item.product_id) productIds.add(item.product_id);
        }));

        const productDetailsMap = new Map<number, { category: string; imageUrl: string | null }>();
        const uncachedIds: number[] = [];

        for (const id of productIds) {
            const cached = getCachedProduct(id);
            if (cached) productDetailsMap.set(id, cached);
            else uncachedIds.push(id);
        }

        console.log(`Products: ${productIds.size} total, ${productIds.size - uncachedIds.length} from cache, ${uncachedIds.length} to fetch`);

        if (uncachedIds.length > 0) {
            const BATCH_SIZE = 100;
            const batches: number[][] = [];
            for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) batches.push(uncachedIds.slice(i, i + BATCH_SIZE));

            const batchResponses = await Promise.all(
                batches.map(batch => axios.get(`${WOO_URL}/wp-json/wc/v3/products`, {
                    auth: { username: WOO_KEY, password: WOO_SECRET },
                    params: { include: batch.join(','), per_page: 100, status: 'any' },
                }))
            );

            const rawProducts: WooCommerceProduct[] = batchResponses.flatMap(r => r.data);
            rawProducts.forEach(product => {
                const categoryName = product.categories?.length ? product.categories[0].name : 'Uncategorized';
                const imageUrl = product.images?.length ? product.images[0].src : null;
                productDetailsMap.set(product.id, { category: categoryName, imageUrl });
                setCachedProduct(product.id, categoryName, imageUrl);
            });

            const missingIds = uncachedIds.filter(id => !productDetailsMap.has(id));
            if (missingIds.length > 0) console.warn(`Productos no encontrados: [${missingIds.join(', ')}]`);
        }

        const allLineItemIds: number[] = [];
        rawOrders.forEach(order => order.line_items.forEach(item => allLineItemIds.push(item.id)));

        const savedStatus = await prisma.purchaseStatus.findMany({ where: { lineItemId: { in: allLineItemIds } } });
        const statusMap = new Map<number, { isPurchased: boolean; quantityPurchased: number }>();
        savedStatus.forEach(s => statusMap.set(s.lineItemId, { isPurchased: s.isPurchased, quantityPurchased: s.quantityPurchased }));

        // Per-supplier quantities
        const supplierStatus = await prisma.purchaseStatusBySupplier.findMany({ where: { lineItemId: { in: allLineItemIds } } });
        const supplierStatusMap = new Map<string, number>(); // key: `${lineItemId}:${supplierId}`
        supplierStatus.forEach(s => supplierStatusMap.set(`${s.lineItemId}:${s.supplierId}`, s.quantity));

        // Match wooProductId → Article suppliers
        const allProductIds = [...productIds];
        const articles = await prisma.article.findMany({
            where: { wooProductId: { in: allProductIds } },
            select: { wooProductId: true, suppliers: { select: { supplierId: true, supplier: { select: { id: true, name: true } } } } },
        });
        const articleSupplierMap = new Map<number, { id: string; name: string }[]>();
        articles.forEach(a => {
            if (a.wooProductId != null) {
                articleSupplierMap.set(a.wooProductId, a.suppliers.map(s => ({ id: s.supplier.id, name: s.supplier.name })));
            }
        });

        const finalOrders = rawOrders.map(order => ({
            id: order.id,
            dateCreated: order.date_created,
            status: order.status,
            total: order.total,
            customer: { firstName: order.billing.first_name, lastName: order.billing.last_name },
            lineItems: order.line_items.map((item: WooCommerceLineItem) => {
                const savedItemStatus = statusMap.get(item.id);
                const productDetails = productDetailsMap.get(item.product_id);
                const suppliers = articleSupplierMap.get(item.product_id) ?? [];
                const quantityBySupplier: Record<string, number> = {};
                suppliers.forEach(s => {
                    quantityBySupplier[s.id] = supplierStatusMap.get(`${item.id}:${s.id}`) ?? 0;
                });
                return {
                    id: item.id,
                    name: item.name,
                    productId: item.product_id,
                    quantity: item.quantity,
                    sku: item.sku,
                    total: item.total,
                    isPurchased: savedItemStatus?.isPurchased ?? false,
                    quantityPurchased: savedItemStatus?.quantityPurchased ?? 0,
                    category: productDetails?.category ?? 'Sin Categoria',
                    imageUrl: productDetails?.imageUrl ?? null,
                    suppliers,
                    quantityBySupplier,
                };
            }),
        }));

        res.json(finalOrders);
    } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: unknown }; message?: string };
        console.error('Error al contactar WooCommerce:', axiosErr.response?.data || axiosErr.message);
        res.status(500).json({ error: 'No se pudo obtener los pedidos de WooCommerce' });
    }
});

// POST /api/orders/:id/complete
router.post('/:id/complete', async (req: Request, res: Response) => {
    const orderIdNum = Number(req.params.id);
    if (!Number.isFinite(orderIdNum)) {
        res.status(400).json({ error: 'orderId invalido. Debe ser numerico' });
        return;
    }

    const { WOO_URL, WOO_KEY, WOO_SECRET } = process.env;
    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        res.status(500).json({ error: 'Variables de API de WooCommerce no configuradas' });
        return;
    }

    try {
        const response = await axios.put(
            `${WOO_URL}/wp-json/wc/v3/orders/${orderIdNum}`,
            { status: 'completed' },
            { auth: { username: WOO_KEY, password: WOO_SECRET }, timeout: 15000, validateStatus: () => true }
        );

        if (response.status >= 200 && response.status < 300) {
            res.status(200).json({ success: true, updatedOrder: response.data });
            return;
        }
        if (response.status === 401 || response.status === 403) {
            res.status(502).json({ error: 'Auth fallo al contactar WooCommerce', details: response.data });
            return;
        }
        if (response.status === 404) {
            res.status(404).json({ error: 'Pedido no encontrado en WooCommerce', details: response.data });
            return;
        }
        res.status(502).json({ error: 'WooCommerce devolvio un error', status: response.status, details: response.data });
    } catch (err) {
        if (axios.isAxiosError(err)) {
            if (!err.response) {
                res.status(504).json({ error: 'No se pudo conectar a WooCommerce', details: err.message });
                return;
            }
            res.status(502).json({ error: 'Error de WooCommerce', status: err.response.status, details: err.response.data });
            return;
        }
        console.error('Error inesperado al completar pedido:', err);
        res.status(500).json({ error: 'Error interno completando pedido', details: String(err) });
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
            select: { id: true, orderId: true, supplierName: true, filename: true, mimeType: true, size: true, createdAt: true },
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

export default router;
