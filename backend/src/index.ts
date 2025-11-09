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

    } catch (error) {
        console.error('Error al guardar estado:', error);
        res.status(500).json({ error: 'No se pudo guardar el estado' });
    }
});


/**
 * RUTA [GET] /api/orders
 * Obtiene pedidos (pendientes o completados) de WooCommerce
 * Y los combina con el progreso de la DB.
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

        // --- 4. OBTENER PRODUCTOS (PARA CATEGORÍAS) ---
        const productIds = new Set<number>();
        rawOrders.forEach(order => {
            order.line_items.forEach((item: any) => {
                if (item.product_id) productIds.add(item.product_id);
            });
        });

        const productCategoryMap = new Map<number, string>();
        if (productIds.size > 0) {
            const productsResponse = await axios.get(
                `${WOO_URL}/wp-json/wc/v3/products`,
                {
                    auth: {
                        username: WOO_KEY,
                        password: WOO_SECRET,
                    },
                    params: {
                        include: Array.from(productIds).join(','),
                        per_page: 100,
                    },
                }
            );
            const rawProducts: any[] = productsResponse.data;
            rawProducts.forEach(product => {
                const categoryName = product.categories && product.categories.length > 0
                    ? product.categories[0].name
                    : 'Uncategorized';
                productCategoryMap.set(product.id, categoryName);
            });
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
            customer: {
                firstName: order.billing.first_name,
                lastName: order.billing.last_name,
            },
            lineItems: order.line_items.map((item: any) => {
                const savedItemStatus = statusMap.get(item.id);
                return {
                    id: item.id,
                    name: item.name,
                    productId: item.product_id,
                    quantity: item.quantity,
                    sku: item.sku,
                    isPurchased: savedItemStatus ? savedItemStatus.isPurchased : false,
                    quantityPurchased: savedItemStatus ? savedItemStatus.quantityPurchased : 0,
                    category: productCategoryMap.get(item.product_id) || 'Products',
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
 * ¡NUEVA RUTA! [POST] /api/orders/:id/complete
 * Actualiza el estado de un pedido en WooCommerce a "completed".
 */
app.post('/api/orders/:id/complete', async (req, res) => {
    // 1. Obtenemos el ID del pedido desde los parámetros de la URL
    const { id: orderId } = req.params;

    // 2. Cargamos las claves seguras
    const { WOO_URL, WOO_KEY, WOO_SECRET } = process.env;

    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        return res.status(500).json({ error: 'Variables de API de WooCommerce no configuradas' });
    }

    // 3. Preparamos los datos que queremos enviar a WooCommerce
    const dataToUpdate = {
        status: 'completed'
    };

    try {
        // 4. Hacemos una petición PUT (actualizar) a WooCommerce
        const response = await axios.put(
            `${WOO_URL}/wp-json/wc/v3/orders/${orderId}`, // <-- URL del pedido específico
            dataToUpdate, // <-- Los datos a cambiar (status: "completed")
            {
                // Usamos la misma Basic Auth
                auth: {
                    username: WOO_KEY,
                    password: WOO_SECRET,
                }
            }
        );

        // 5. Devolvemos la respuesta exitosa al frontend
        res.json({ success: true, updatedOrder: response.data });

    } catch (error: any) {
        console.error(`Error al completar el pedido #${orderId}:`, error.response?.data || error.message);
        res.status(500).json({ error: 'No se pudo actualizar el pedido en WooCommerce' });
    }
});


// --- Iniciar el Servidor ---
const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`🚀 Servidor Backend escuchando en http://localhost:${port}`);
});