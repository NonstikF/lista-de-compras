import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

// Inicializar Prisma Client
const prisma = new PrismaClient();

// Inicializar Express App
const app = express();

// --- Security Middlewares ---
app.use(helmet());

// CORS restrictivo: solo permite el frontend configurado
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
    origin: allowedOrigin,
    credentials: true,
}));

app.use(express.json());

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
            }
        );
        const rawOrders: any[] = ordersResponse.data;

        if (rawOrders.length === 0) {
            res.json([]);
            return;
        }

        // --- 4. OBTENER PRODUCTOS (PARA CATEGORIAS E IMAGENES) ---
        const productIds = new Set<number>();
        rawOrders.forEach(order => {
            order.line_items.forEach((item: any) => {
                if (item.product_id) productIds.add(item.product_id);
            });
        });
        console.log(`Product IDs a buscar: [${Array.from(productIds).join(', ')}]`);

        // Mapa para guardar detalles del producto
        const productDetailsMap = new Map<number, { category: string, imageUrl: string | null }>();
        if (productIds.size > 0) {
            const productIdArray = Array.from(productIds);
            const BATCH_SIZE = 100;
            const batches: number[][] = [];
            for (let i = 0; i < productIdArray.length; i += BATCH_SIZE) {
                batches.push(productIdArray.slice(i, i + BATCH_SIZE));
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

            const rawProducts: any[] = batchResponses.flatMap(r => r.data);
            rawProducts.forEach(product => {
                const categoryName = product.categories && product.categories.length > 0
                    ? product.categories[0].name
                    : 'Uncategorized';

                const imageUrl = product.images && product.images.length > 0
                    ? product.images[0].src
                    : null;

                productDetailsMap.set(product.id, { category: categoryName, imageUrl: imageUrl });
            });

            const missingIds = productIdArray.filter(id => !productDetailsMap.has(id));
            if (missingIds.length > 0) {
                console.warn(`Productos no encontrados en WooCommerce API: [${missingIds.join(', ')}]`);
            }
        }

        // --- 5. OBTENER PROGRESO DE NUESTRA BASE DE DATOS ---
        const savedStatus = await prisma.purchaseStatus.findMany();
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
            lineItems: order.line_items.map((item: any) => {
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

    } catch (error: any) {
        console.error('Error al contactar API de WooCommerce:', error.response?.data || error.message);
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


// --- Iniciar el Servidor ---
const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`Servidor Backend escuchando en http://localhost:${port}`);
});
