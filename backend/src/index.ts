import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import axios from 'axios'; // ¡NUEVA IMPORTACIÓN!

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
 * (Esta ruta ya la tenías y es correcta)
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
 * ¡NUEVA RUTA! [GET] /api/orders
 * Obtiene pedidos de WooCommerce Y el progreso de la DB,
 * los combina y los devuelve al frontend.
 */
app.get('/api/orders', async (req, res) => {

    // 1. Cargar las claves seguras desde las variables de entorno de Railway
    const { WOO_URL, WOO_KEY, WOO_SECRET } = process.env;

    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        return res.status(500).json({ error: 'Variables de API de WooCommerce no configuradas en el servidor' });
    }

    const wooAuth = {
        consumerKey: WOO_KEY,
        consumerSecret: WOO_SECRET,
    };

    try {
        // --- 2. OBTENER PEDIDOS DE WOOCOMMERCE ---
        const ordersResponse = await axios.get(
            `${WOO_URL}/wp-json/wc/v3/orders`,
            {
                params: {
                    ...wooAuth,
                    status: 'processing,on-hold',
                    per_page: 100,
                },
            }
        );
        const rawOrders: any[] = ordersResponse.data;

        if (rawOrders.length === 0) {
            return res.json([]); // No hay pedidos, devolvemos un array vacío
        }

        // --- 3. OBTENER PRODUCTOS (PARA CATEGORÍAS) ---
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
                    params: {
                        ...wooAuth,
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

        // --- 4. OBTENER PROGRESO DE NUESTRA BASE DE DATOS ---
        const savedStatus = await prisma.purchaseStatus.findMany();
        const statusMap = new Map<number, { isPurchased: boolean, quantityPurchased: number }>();
        savedStatus.forEach(status => {
            statusMap.set(status.lineItemId, {
                isPurchased: status.isPurchased,
                quantityPurchased: status.quantityPurchased
            });
        });

        // --- 5. COMBINAR TODO Y RESPONDER AL FRONTEND ---
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

        res.json(finalOrders); // ¡Enviamos la lista combinada al frontend!

    } catch (error: any) {
        console.error('Error al contactar API de WooCommerce:', error.response?.data || error.message);
        res.status(500).json({ error: 'No se pudo obtener los pedidos de WooCommerce' });
    }
});


// --- Iniciar el Servidor ---
const port = process.env.PORT || 4000; // Railway proveerá la variable PORT
app.listen(port, () => {
    console.log(`🚀 Servidor Backend escuchando en http://localhost:${port}`);
});