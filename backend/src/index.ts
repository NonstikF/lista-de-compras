import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

// Inicializar Prisma Client
const prisma = new PrismaClient();

// Inicializar Express App
const app = express();

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- Rutas de nuestra API ---

/**
 * RUTA [POST] /api/item-status
 * Guarda o actualiza el estado de un artículo de línea individual.
 */
app.post('/api/item-status', async (req, res) => {
    const { lineItemId, orderId, isPurchased, quantityPurchased } = req.body;

    if (typeof lineItemId === 'undefined') {
        return res.status(400).json({ error: 'lineItemId es requerido' });
    }

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

    } catch (error) { // <-- Corregido (sin la 'S')
        console.error('Error al guardar estado:', error);
        res.status(500).json({ error: 'No se pudo guardar el estado' });
    }
});


/**
 * RUTA [GET] /api/orders
 * Obtiene pedidos (pendientes o completados) de WooCommerce
 * Y los combina con el progreso de la DB, imágenes y totales.
 */
app.get('/api/orders', async (req, res) => {

    // 1. Cargar las claves seguras
    const { WOO_URL, WOO_KEY, WOO_SECRET } = process.env;

    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        return res.status(500).json({ error: 'Variables de API de WooCommerce no configuradas en el servidor' });
    }

    // 2. Determinar qué estado de pedido quiere el frontend
    const requestedStatus = req.query.status as string; // 'completed' o 'processing'

    let wooStatusString: string;
    if (requestedStatus === 'completed') {
        wooStatusString = 'completed';
    } else {
        // Por defecto, mostramos los pendientes
        wooStatusString = 'processing,on-hold';
    }

    try {
        // --- 3. OBTENER PEDIDOS DE WOOCOMMERCE ---
        const ordersResponse = await axios.get(
            `${WOO_URL}/wp-json/wc/v3/orders`,
            {
                auth: { // Basic Auth
                    username: WOO_KEY,
                    password: WOO_SECRET,
                },
                params: {
                    status: wooStatusString, // Estado dinámico
                    per_page: 100,
                },
            }
        );
        const rawOrders: any[] = ordersResponse.data;

        if (rawOrders.length === 0) {
            return res.json([]);
        }

        // --- 4. OBTENER PRODUCTOS (PARA CATEGORÍAS E IMÁGENES) ---
        const productIds = new Set<number>();
        rawOrders.forEach(order => {
            order.line_items.forEach((item: any) => {
                // Agregar product_id (producto principal)
                if (item.product_id) productIds.add(item.product_id);
            });
        });
        console.log(`📦 Product IDs a buscar: [${Array.from(productIds).join(', ')}]`);

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

            // Log de productos que no se encontraron en el API
            const missingIds = productIdArray.filter(id => !productDetailsMap.has(id));
            if (missingIds.length > 0) {
                console.warn(`⚠️ Productos no encontrados en WooCommerce API: [${missingIds.join(', ')}]`);
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
            total: order.total, // Total del pedido
            customer: {
                firstName: order.billing.first_name,
                lastName: order.billing.last_name,
            },
            lineItems: order.line_items.map((item: any) => {
                const savedItemStatus = statusMap.get(item.id);
                const productDetails = productDetailsMap.get(item.product_id);

                // Fallback: intentar obtener categoría del parent product si es variación
                let category = 'Sin Categoría';
                if (productDetails) {
                    category = productDetails.category;
                } else if (item.parent_name) {
                    // Para variaciones, WooCommerce puede no devolver el producto hijo,
                    // pero el parent puede estar en el mapa
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
app.post('/api/orders/:id/complete', async (req, res) => {
    const { id: orderIdParam } = req.params;

    // Validación básica del ID
    if (!orderIdParam) return res.status(400).json({ error: 'orderId requerido en la URL' });
    const orderIdNum = Number(orderIdParam);
    if (!Number.isFinite(orderIdNum)) {
        // WooCommerce usa IDs numéricos; si usas strings (UUID) ajusta esto.
        return res.status(400).json({ error: 'orderId inválido. Debe ser numérico' });
    }

    const { WOO_URL, WOO_KEY, WOO_SECRET } = process.env;
    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        console.error('Missing WOO_* env vars');
        return res.status(500).json({ error: 'Variables de API de WooCommerce no configuradas' });
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
                timeout: 15000, // evita waits indefinidos
                validateStatus: (s) => true // permitimos capturar respuestas no-2xx manualmente
            }
        );

        // Si WooCommerce devolvió un status 2xx, todo ok
        if (response.status >= 200 && response.status < 300) {
            return res.status(200).json({ success: true, updatedOrder: response.data });
        }

        // Si no fue 2xx: log detallado y devolver info útil al frontend (temporal)
        console.error(`WooCommerce responded ${response.status} for order ${orderIdNum}:`, {
            status: response.status,
            data: response.data,
            headers: response.headers
        });

        // Mapear códigos comunes a respuestas HTTP claras
        if (response.status === 401 || response.status === 403) {
            return res.status(502).json({ error: 'Auth falló al contactar WooCommerce', details: response.data });
        }
        if (response.status === 404) {
            return res.status(404).json({ error: 'Pedido no encontrado en WooCommerce', details: response.data });
        }
        // otros errores de Woo -> 502 Bad Gateway
        return res.status(502).json({ error: 'WooCommerce devolvió un error', status: response.status, details: response.data });

    } catch (err) {
        // Diferentes tipos de error de axios/prerequest
        if (axios.isAxiosError(err)) {
            console.error('Axios error al completar pedido:', {
                message: err.message,
                code: err.code,
                config: err.config && { url: err.config.url, method: err.config.method },
                response: err.response && { status: err.response.status, data: err.response.data }
            });
            // Si no hay response, es error de conexión/timeout
            if (!err.response) {
                return res.status(504).json({ error: 'No se pudo conectar a WooCommerce (timeout/conn error)', details: err.message });
            }
            // Si hay response, propagar su status/data
            return res.status(502).json({ error: 'Error de WooCommerce', status: err.response.status, details: err.response.data });
        }

        // Error inesperado (no-axios)
        console.error('Error inesperado al completar pedido:', err);
        return res.status(500).json({
            error: 'Error interno completando pedido',
            details: String(err)
        });
    }
});


// --- Iniciar el Servidor ---
const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`🚀 Servidor Backend escuchando en http://localhost:${port}`);
});