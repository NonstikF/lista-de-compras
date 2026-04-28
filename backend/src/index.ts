import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import type { WooCommerceOrder, WooCommerceProduct, WooCommerceLineItem } from './types';

// Inicializar Prisma Client
const prisma = new PrismaClient();

// --- Cache en memoria para productos ---
const PRODUCT_CACHE_TTL = 10 * 60 * 1000; // 10 minutos
interface CachedProduct {
    category: string;
    imageUrl: string | null;
    cachedAt: number;
}
const productCache = new Map<number, CachedProduct>();

function getCachedProduct(productId: number): { category: string; imageUrl: string | null } | null {
    const cached = productCache.get(productId);
    if (!cached) return null;
    if (Date.now() - cached.cachedAt > PRODUCT_CACHE_TTL) {
        productCache.delete(productId);
        return null;
    }
    return { category: cached.category, imageUrl: cached.imageUrl };
}

function setCachedProduct(productId: number, category: string, imageUrl: string | null): void {
    productCache.set(productId, { category, imageUrl, cachedAt: Date.now() });
}

// Inicializar Express App
const app = express();

// Railway (y otros proxies) inyectan X-Forwarded-For
app.set('trust proxy', 1);

// --- Security Middlewares ---
app.use(helmet());

// CORS restrictivo: solo permite el frontend configurado
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
    origin: allowedOrigin,
    credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof Error && 'type' in err && err.type === 'entity.too.large') {
        res.status(413).json({ error: 'La imagen es demasiado grande. Usa una imagen de menos de 500 KB.' });
        return;
    }
    next(err);
});

// Rate limiting general: 100 requests por 15 minutos
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Demasiadas solicitudes. Intenta de nuevo mas tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', generalLimiter);

// Rate limiting estricto para login: 5 intentos por 15 minutos
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// --- Zod Schemas ---
const loginSchema = z.object({
    username: z.string().min(1, 'Username es requerido'),
    password: z.string().min(1, 'Password es requerido'),
});

const itemStatusSchema = z.object({
    lineItemId: z.number({ error: 'lineItemId es requerido' }),
    orderId: z.number({ error: 'orderId es requerido' }),
    isPurchased: z.boolean(),
    quantityPurchased: z.number().int().min(0),
});

// --- JWT Auth Middleware ---
function authenticateToken(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        res.status(401).json({ error: 'Token de acceso requerido' });
        return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('JWT_SECRET no configurado en variables de entorno');
        res.status(500).json({ error: 'Error de configuracion del servidor' });
        return;
    }

    try {
        jwt.verify(token, jwtSecret);
        next();
    } catch {
        res.status(403).json({ error: 'Token invalido o expirado' });
    }
}

// --- Rutas Publicas ---

// Healthcheck para Railway
app.get('/', (_req, res) => {
    res.json({ status: 'ok' });
});

// Login
app.post('/api/login', loginLimiter, (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
    }

    const { username, password } = parsed.data;

    const adminUser = process.env.ADMIN_USER;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUser || !adminPassword) {
        console.error('ADMIN_USER o ADMIN_PASSWORD no configurados');
        res.status(500).json({ error: 'Error de configuracion del servidor' });
        return;
    }

    if (username !== adminUser || password !== adminPassword) {
        res.status(401).json({ error: 'Credenciales invalidas' });
        return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('JWT_SECRET no configurado');
        res.status(500).json({ error: 'Error de configuracion del servidor' });
        return;
    }

    const token = jwt.sign({ user: username }, jwtSecret, { expiresIn: '24h' });
    res.json({ token, user: username });
});

// --- Rutas Protegidas ---
// Todas las rutas /api/* (excepto /api/login) requieren autenticacion
app.use('/api', authenticateToken);

/**
 * RUTA [POST] /api/item-status
 * Guarda o actualiza el estado de un articulo de linea individual.
 */
app.post('/api/item-status', async (req: Request, res: Response) => {
    const parsed = itemStatusSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
    }

    const { lineItemId, orderId, isPurchased, quantityPurchased } = parsed.data;

    try {
        const status = await prisma.purchaseStatus.upsert({
            where: {
                lineItemId: lineItemId,
            },
            update: {
                isPurchased: isPurchased,
                quantityPurchased: quantityPurchased,
            },
            create: {
                lineItemId: lineItemId,
                orderId: orderId,
                isPurchased: isPurchased,
                quantityPurchased: quantityPurchased,
            },
        });

        res.json({ success: true, status: status });

    } catch (error) {
        console.error('Error al guardar estado:', error);
        res.status(500).json({ error: 'No se pudo guardar el estado' });
    }
});


/**
 * RUTA [GET] /api/orders
 * Obtiene pedidos (pendientes o completados) de WooCommerce
 * Y los combina con el progreso de la DB, imagenes y totales.
 */
app.get('/api/orders', async (req: Request, res: Response) => {

    // 1. Cargar las claves seguras
    const { WOO_URL, WOO_KEY, WOO_SECRET } = process.env;

    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        res.status(500).json({ error: 'Variables de API de WooCommerce no configuradas en el servidor' });
        return;
    }

    // 2. Determinar que estado de pedido quiere el frontend
    const requestedStatus = req.query.status as string;

    let wooStatusString: string;
    if (requestedStatus === 'completed') {
        wooStatusString = 'completed';
    } else {
        wooStatusString = 'processing,on-hold';
    }

    try {
        // --- 3. OBTENER PEDIDOS DE WOOCOMMERCE ---
        const ordersResponse = await axios.get(
            `${WOO_URL}/wp-json/wc/v3/orders`,
            {
                auth: {
                    username: WOO_KEY,
                    password: WOO_SECRET,
                },
                params: {
                    status: wooStatusString,
                    per_page: 100,
                },
                timeout: 15000,
            }
        );
        const rawOrders: WooCommerceOrder[] = ordersResponse.data;

        if (rawOrders.length === 0) {
            res.json([]);
            return;
        }

        // --- 4. OBTENER PRODUCTOS (PARA CATEGORIAS E IMAGENES) CON CACHE ---
        const productIds = new Set<number>();
        rawOrders.forEach(order => {
            order.line_items.forEach((item: WooCommerceLineItem) => {
                if (item.product_id) productIds.add(item.product_id);
            });
        });

        const productDetailsMap = new Map<number, { category: string, imageUrl: string | null }>();
        const uncachedIds: number[] = [];

        // Separar productos cacheados de los que necesitan fetch
        for (const id of productIds) {
            const cached = getCachedProduct(id);
            if (cached) {
                productDetailsMap.set(id, cached);
            } else {
                uncachedIds.push(id);
            }
        }

        const fromCache = productIds.size - uncachedIds.length;
        console.log(`Products: ${productIds.size} total, ${fromCache} from cache, ${uncachedIds.length} to fetch`);

        // Solo fetch de WooCommerce para productos NO cacheados
        if (uncachedIds.length > 0) {
            const BATCH_SIZE = 100;
            const batches: number[][] = [];
            for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
                batches.push(uncachedIds.slice(i, i + BATCH_SIZE));
            }

            const batchResponses = await Promise.all(
                batches.map(batch =>
                    axios.get(
                        `${WOO_URL}/wp-json/wc/v3/products`,
                        {
                            auth: {
                                username: WOO_KEY,
                                password: WOO_SECRET,
                            },
                            params: {
                                include: batch.join(','),
                                per_page: 100,
                                status: 'any',
                            },
                        }
                    )
                )
            );

            const rawProducts: WooCommerceProduct[] = batchResponses.flatMap(r => r.data);
            rawProducts.forEach(product => {
                const categoryName = product.categories && product.categories.length > 0
                    ? product.categories[0].name
                    : 'Uncategorized';

                const imageUrl = product.images && product.images.length > 0
                    ? product.images[0].src
                    : null;

                productDetailsMap.set(product.id, { category: categoryName, imageUrl: imageUrl });
                setCachedProduct(product.id, categoryName, imageUrl);
            });

            const missingIds = uncachedIds.filter(id => !productDetailsMap.has(id));
            if (missingIds.length > 0) {
                console.warn(`Productos no encontrados en WooCommerce API: [${missingIds.join(', ')}]`);
            }
        }

        // --- 5. OBTENER PROGRESO DE NUESTRA BASE DE DATOS ---
        const allLineItemIds: number[] = [];
        rawOrders.forEach((order) => {
            order.line_items.forEach((item) => {
                allLineItemIds.push(item.id);
            });
        });

        const savedStatus = await prisma.purchaseStatus.findMany({
            where: { lineItemId: { in: allLineItemIds } },
        });
        const statusMap = new Map<number, { isPurchased: boolean, quantityPurchased: number }>();
        savedStatus.forEach(status => {
            statusMap.set(status.lineItemId, {
                isPurchased: status.isPurchased,
                quantityPurchased: status.quantityPurchased
            });
        });

        // --- 6. COMBINAR TODO Y RESPONDER AL FRONTEND ---
        const finalOrders = rawOrders.map(order => ({
            id: order.id,
            dateCreated: order.date_created,
            status: order.status,
            total: order.total,
            customer: {
                firstName: order.billing.first_name,
                lastName: order.billing.last_name,
            },
            lineItems: order.line_items.map((item: WooCommerceLineItem) => {
                const savedItemStatus = statusMap.get(item.id);
                const productDetails = productDetailsMap.get(item.product_id);

                let category = 'Sin Categoria';
                if (productDetails) {
                    category = productDetails.category;
                } else if (item.parent_name) {
                    const parentProduct = productDetailsMap.get(item.product_id);
                    if (parentProduct) category = parentProduct.category;
                }

                return {
                    id: item.id,
                    name: item.name,
                    productId: item.product_id,
                    quantity: item.quantity,
                    sku: item.sku,
                    total: item.total,
                    isPurchased: savedItemStatus ? savedItemStatus.isPurchased : false,
                    quantityPurchased: savedItemStatus ? savedItemStatus.quantityPurchased : 0,
                    category: category,
                    imageUrl: productDetails ? productDetails.imageUrl : null,
                };
            }),
        }));

        res.json(finalOrders);

    } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: unknown }; message?: string };
        console.error('Error al contactar API de WooCommerce:', axiosErr.response?.data || axiosErr.message);
        res.status(500).json({ error: 'No se pudo obtener los pedidos de WooCommerce' });
    }
});


/**
 * RUTA [POST] /api/orders/:id/complete
 * Actualiza el estado de un pedido en WooCommerce a "completed".
 */
app.post('/api/orders/:id/complete', async (req: Request, res: Response) => {
    const { id: orderIdParam } = req.params;

    if (!orderIdParam) {
        res.status(400).json({ error: 'orderId requerido en la URL' });
        return;
    }
    const orderIdNum = Number(orderIdParam);
    if (!Number.isFinite(orderIdNum)) {
        res.status(400).json({ error: 'orderId invalido. Debe ser numerico' });
        return;
    }

    const { WOO_URL, WOO_KEY, WOO_SECRET } = process.env;
    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        console.error('Missing WOO_* env vars');
        res.status(500).json({ error: 'Variables de API de WooCommerce no configuradas' });
        return;
    }

    const dataToUpdate = { status: 'completed' };

    try {
        const response = await axios.put(
            `${WOO_URL}/wp-json/wc/v3/orders/${orderIdNum}`,
            dataToUpdate,
            {
                auth: {
                    username: WOO_KEY,
                    password: WOO_SECRET,
                },
                timeout: 15000,
                validateStatus: (s) => true
            }
        );

        if (response.status >= 200 && response.status < 300) {
            res.status(200).json({ success: true, updatedOrder: response.data });
            return;
        }

        console.error(`WooCommerce responded ${response.status} for order ${orderIdNum}:`, {
            status: response.status,
            data: response.data,
            headers: response.headers
        });

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
            console.error('Axios error al completar pedido:', {
                message: err.message,
                code: err.code,
                config: err.config && { url: err.config.url, method: err.config.method },
                response: err.response && { status: err.response.status, data: err.response.data }
            });
            if (!err.response) {
                res.status(504).json({ error: 'No se pudo conectar a WooCommerce (timeout/conn error)', details: err.message });
                return;
            }
            res.status(502).json({ error: 'Error de WooCommerce', status: err.response.status, details: err.response.data });
            return;
        }

        console.error('Error inesperado al completar pedido:', err);
        res.status(500).json({
            error: 'Error interno completando pedido',
            details: String(err)
        });
    }
});


// ============================================================
// PROVEEDORES
// ============================================================

const supplierSchema = z.object({
    name: z.string().min(1, 'Nombre requerido'),
    contact: z.string().default(''),
    phone: z.string().default(''),
});

app.get('/api/suppliers', async (_req: Request, res: Response) => {
    try {
        const suppliers = await prisma.supplier.findMany({ orderBy: { createdAt: 'asc' } });
        res.json(suppliers);
    } catch (err) {
        console.error('Error al obtener proveedores:', err);
        res.status(500).json({ error: 'Error al obtener proveedores' });
    }
});

app.post('/api/suppliers', async (req: Request, res: Response) => {
    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const supplier = await prisma.supplier.create({ data: parsed.data });
        res.status(201).json(supplier);
    } catch (err) {
        console.error('Error al crear proveedor:', err);
        res.status(500).json({ error: 'Error al crear proveedor' });
    }
});

app.put('/api/suppliers/:id', async (req: Request, res: Response) => {
    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: parsed.data });
        res.json(supplier);
    } catch (err) {
        console.error('Error al actualizar proveedor:', err);
        res.status(500).json({ error: 'Error al actualizar proveedor' });
    }
});

app.delete('/api/suppliers/:id', async (req: Request, res: Response) => {
    try {
        await prisma.supplier.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        console.error('Error al eliminar proveedor:', err);
        res.status(500).json({ error: 'Error al eliminar proveedor' });
    }
});

// ============================================================
// TICKETS DE PROVEEDOR
// ============================================================

const ticketSchema = z.object({
    filename: z.string().min(1, 'Nombre de archivo requerido'),
    mimeType: z.string().refine(
        v => ['image/jpeg', 'image/png', 'application/pdf'].includes(v),
        { message: 'Tipo de archivo no permitido. Usa JPG, PNG o PDF.' }
    ),
    size: z.number().int().min(1).max(1_000_000, 'El archivo no puede superar 1 MB'),
    content: z.string().min(1, 'Contenido requerido'),
});

app.get('/api/suppliers/:id/tickets', async (req: Request, res: Response) => {
    try {
        const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id }, select: { id: true } });
        if (!supplier) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }
        const tickets = await prisma.supplierTicket.findMany({
            where: { supplierId: req.params.id },
            select: { id: true, supplierId: true, filename: true, mimeType: true, size: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(tickets);
    } catch (err) {
        console.error('Error al obtener tickets:', err);
        res.status(500).json({ error: 'Error al obtener tickets' });
    }
});

app.get('/api/suppliers/:id/tickets/:ticketId', async (req: Request, res: Response) => {
    try {
        const ticket = await prisma.supplierTicket.findFirst({
            where: { id: req.params.ticketId, supplierId: req.params.id },
        });
        if (!ticket) { res.status(404).json({ error: 'Ticket no encontrado' }); return; }
        res.json(ticket);
    } catch (err) {
        console.error('Error al obtener ticket:', err);
        res.status(500).json({ error: 'Error al obtener ticket' });
    }
});

app.post('/api/suppliers/:id/tickets', async (req: Request, res: Response) => {
    const parsed = ticketSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id }, select: { id: true } });
        if (!supplier) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }
        const ticket = await prisma.supplierTicket.create({
            data: { supplierId: req.params.id, ...parsed.data },
        });
        res.status(201).json(ticket);
    } catch (err) {
        console.error('Error al crear ticket:', err);
        res.status(500).json({ error: 'Error al crear ticket' });
    }
});

app.delete('/api/suppliers/:id/tickets/:ticketId', async (req: Request, res: Response) => {
    try {
        await prisma.supplierTicket.delete({ where: { id: req.params.ticketId } });
        res.json({ success: true });
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
            res.status(404).json({ error: 'Ticket no encontrado' }); return;
        }
        console.error('Error al eliminar ticket:', err);
        res.status(500).json({ error: 'Error al eliminar ticket' });
    }
});

// ============================================================
// ARTÍCULOS
// ============================================================

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

app.get('/api/articles', async (_req: Request, res: Response) => {
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

app.post('/api/articles', async (req: Request, res: Response) => {
    const parsed = articleSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { wooProductId, name, image, price, sku, category, description, stockStatus, supplierIds } = parsed.data;
    try {
        const article = await prisma.article.create({
            data: {
                wooProductId, name, image, price, sku, category, description, stockStatus,
                suppliers: { create: supplierIds.map((sid: string) => ({ supplierId: sid })) },
            },
            include: { suppliers: { select: { supplierId: true } } },
        });
        res.status(201).json(formatArticle(article));
    } catch (err) {
        console.error('Error al crear artículo:', err);
        res.status(500).json({ error: 'Error al crear artículo' });
    }
});

app.put('/api/articles/:id', async (req: Request, res: Response) => {
    const parsed = articleSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { wooProductId, name, image, price, sku, category, description, stockStatus, supplierIds } = parsed.data;
    try {
        const article = await prisma.article.update({
            where: { id: req.params.id },
            data: {
                wooProductId, name, image, price, sku, category, description, stockStatus,
                suppliers: {
                    deleteMany: {},
                    create: supplierIds.map((sid: string) => ({ supplierId: sid })),
                },
            },
            include: { suppliers: { select: { supplierId: true } } },
        });
        res.json(formatArticle(article));
    } catch (err) {
        console.error('Error al actualizar artículo:', err);
        res.status(500).json({ error: 'Error al actualizar artículo' });
    }
});

app.post('/api/articles/import-woocommerce', async (_req: Request, res: Response) => {
    try {
        const products = await fetchWooProducts();
        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const product of products) {
            const data = mapWooProductToArticle(product);
            if (!data.name) {
                skipped += 1;
                continue;
            }

            const existing = await prisma.article.findFirst({
                where: {
                    OR: [
                        { wooProductId: data.wooProductId },
                        { name: data.name },
                    ],
                },
                select: { id: true },
            });

            if (existing) {
                await prisma.article.update({
                    where: { id: existing.id },
                    data,
                });
                updated += 1;
            } else {
                await prisma.article.create({ data });
                created += 1;
            }
        }

        const articles = await prisma.article.findMany({
            include: { suppliers: { select: { supplierId: true } } },
            orderBy: { createdAt: 'asc' },
        });

        res.json({
            created,
            updated,
            skipped,
            total: products.length,
            articles: articles.map(formatArticle),
        });
    } catch (err) {
        const axiosErr = err as { response?: { data?: unknown }; message?: string };
        console.error('Error al importar productos de WooCommerce:', axiosErr.response?.data || axiosErr.message || err);
        res.status(500).json({ error: axiosErr.message || 'No se pudieron importar productos de WooCommerce' });
    }
});

app.delete('/api/articles/:id', async (req: Request, res: Response) => {
    try {
        await prisma.article.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        console.error('Error al eliminar artículo:', err);
        res.status(500).json({ error: 'Error al eliminar artículo' });
    }
});

// ============================================================
// RECETAS
// ============================================================

const recipeCategories = ['caliente', 'fria', 'especial'] as const;
type RecipeCategory = typeof recipeCategories[number];

function normalizeRecipeCategory(category: unknown): RecipeCategory {
    return recipeCategories.includes(category as RecipeCategory) ? category as RecipeCategory : 'especial';
}

function formatRecipe(recipe: {
    id: string;
    name: string;
    description: string;
    category: string;
    image: string | null;
    instructions: string;
    servings: number;
    createdAt: Date;
    updatedAt: Date;
    ingredients: { name: string; quantity: string; unit: string }[];
}) {
    return {
        ...recipe,
        category: normalizeRecipeCategory(recipe.category),
        image: recipe.image ?? null,
        description: recipe.description ?? '',
        instructions: recipe.instructions ?? '',
        servings: Math.max(1, Number(recipe.servings) || 1),
        ingredients: recipe.ingredients ?? [],
    };
}

const recipeSchema = z.object({
    name: z.string().min(1, 'Nombre requerido'),
    description: z.string().default(''),
    category: z.string().default('especial').transform(normalizeRecipeCategory),
    image: z.string().nullable().default(null),
    instructions: z.string().default(''),
    servings: z.number().int().min(1).default(1),
    ingredients: z.array(z.object({
        name: z.string(),
        quantity: z.string(),
        unit: z.string(),
    })).default([]),
});

app.get('/api/recipes', async (_req: Request, res: Response) => {
    try {
        const recipes = await prisma.recipe.findMany({
            include: { ingredients: true },
            orderBy: { createdAt: 'asc' },
        });
        res.json(recipes.map(formatRecipe));
    } catch (err) {
        console.error('Error al obtener recetas:', err);
        res.status(500).json({ error: 'Error al obtener recetas' });
    }
});

app.post('/api/recipes', async (req: Request, res: Response) => {
    const parsed = recipeSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { ingredients, ...rest } = parsed.data;
    try {
        const recipe = await prisma.recipe.create({
            data: { ...rest, ingredients: { create: ingredients } },
            include: { ingredients: true },
        });
        res.status(201).json(formatRecipe(recipe));
    } catch (err) {
        console.error('Error al crear receta:', err);
        res.status(500).json({ error: 'Error al crear receta' });
    }
});

app.put('/api/recipes/:id', async (req: Request, res: Response) => {
    const parsed = recipeSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { ingredients, ...rest } = parsed.data;
    try {
        const recipe = await prisma.recipe.update({
            where: { id: req.params.id },
            data: {
                ...rest,
                ingredients: { deleteMany: {}, create: ingredients },
            },
            include: { ingredients: true },
        });
        res.json(formatRecipe(recipe));
    } catch (err) {
        console.error('Error al actualizar receta:', err);
        res.status(500).json({ error: 'Error al actualizar receta' });
    }
});

app.delete('/api/recipes/:id', async (req: Request, res: Response) => {
    try {
        await prisma.recipe.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        console.error('Error al eliminar receta:', err);
        res.status(500).json({ error: 'Error al eliminar receta' });
    }
});

// ============================================================
// PEDIDOS DE TIENDA
// ============================================================

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

function formatStoreOrder(o: { id: number; dateCreated: Date; status: string; customerName: string; customerPhone: string; notes: string; total: number; items: { id: number; orderId: number; articleId: string; name: string; price: number; qty: number }[] }) {
    return { ...o, id: `T-${o.id}`, dateCreated: o.dateCreated.toISOString() };
}

app.get('/api/store-orders', async (_req: Request, res: Response) => {
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

app.post('/api/store-orders', async (req: Request, res: Response) => {
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

app.patch('/api/store-orders/:id/complete', async (req: Request, res: Response) => {
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

// --- Iniciar el Servidor ---
const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`Servidor Backend escuchando en http://localhost:${port}`);
});
