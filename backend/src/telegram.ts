import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import type { WooCommerceOrder, WooCommerceLineItem } from './types';

// --- Tipos internos ---
interface ProcessedLineItem {
    id: number;
    name: string;
    category: string;
    quantity: number;
    sku: string;
    total: string;
    isPurchased: boolean;
    quantityPurchased: number;
}

interface ProcessedOrder {
    id: number;
    dateCreated: string;
    status: string;
    total: string;
    customer: string;
    lineItems: ProcessedLineItem[];
}

interface BotConfig {
    token: string;
    chatId: string;
    allowedChatIds: string[];
    staleHours: number;
}

// --- Cache de categorías de productos (TTL 5 horas) ---
const productCategoryCache = new Map<number, { category: string; cachedAt: number }>();
const CATEGORY_CACHE_TTL = 5 * 60 * 60 * 1000;

// --- Instancia activa del bot ---
let activeBotInstance: TelegramBot | null = null;
let activeIntervals: ReturnType<typeof setInterval>[] = [];

// --- Leer configuración desde DB (con fallback a env vars) ---
async function getBotConfig(prisma: PrismaClient): Promise<BotConfig | null> {
    try {
        const dbConfig = await prisma.telegramConfig.findUnique({ where: { id: 1 } });
        if (dbConfig && dbConfig.enabled && dbConfig.botToken) {
            return {
                token: dbConfig.botToken,
                chatId: dbConfig.chatId,
                allowedChatIds: dbConfig.allowedChatIds.split(',').map(s => s.trim()).filter(Boolean),
                staleHours: dbConfig.staleHours,
            };
        }
    } catch (err) {
        console.error('Telegram: Error leyendo config de DB, usando env vars:', err);
    }

    // Fallback a variables de entorno
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return null;

    return {
        token,
        chatId: process.env.TELEGRAM_CHAT_ID || '',
        allowedChatIds: (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '')
            .split(',').map(s => s.trim()).filter(Boolean),
        staleHours: 2,
    };
}

// --- Helpers WooCommerce ---
function getWooConfig() {
    const { WOO_URL, WOO_KEY, WOO_SECRET } = process.env;
    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        throw new Error('Variables de WooCommerce no configuradas');
    }
    return { WOO_URL, WOO_KEY, WOO_SECRET };
}

async function fetchOrders(prisma: PrismaClient, status = 'processing,on-hold'): Promise<ProcessedOrder[]> {
    const { WOO_URL, WOO_KEY, WOO_SECRET } = getWooConfig();

    const ordersResponse = await axios.get(`${WOO_URL}/wp-json/wc/v3/orders`, {
        auth: { username: WOO_KEY, password: WOO_SECRET },
        params: { status, per_page: 100 },
        timeout: 15000,
    });

    const rawOrders: WooCommerceOrder[] = ordersResponse.data;
    if (rawOrders.length === 0) return [];

    // Obtener categorías de productos (con cache)
    const productIds = new Set<number>();
    rawOrders.forEach(o => o.line_items.forEach((i: WooCommerceLineItem) => {
        if (i.product_id) productIds.add(i.product_id);
    }));

    const categoryMap = new Map<number, string>();
    const uncachedIds: number[] = [];

    for (const id of productIds) {
        const cached = productCategoryCache.get(id);
        if (cached && Date.now() - cached.cachedAt < CATEGORY_CACHE_TTL) {
            categoryMap.set(id, cached.category);
        } else {
            uncachedIds.push(id);
        }
    }

    if (uncachedIds.length > 0) {
        try {
            const productsResponse = await axios.get(`${WOO_URL}/wp-json/wc/v3/products`, {
                auth: { username: WOO_KEY, password: WOO_SECRET },
                params: { include: uncachedIds.join(','), per_page: 100, status: 'any' },
                timeout: 15000,
            });
            for (const product of productsResponse.data) {
                const category: string = product.categories?.[0]?.name || 'Sin categoría';
                categoryMap.set(product.id, category);
                productCategoryCache.set(product.id, { category, cachedAt: Date.now() });
            }
        } catch {
            // Si falla el fetch de categorías, continuamos sin ellas
        }
    }

    const allLineItemIds = rawOrders.flatMap(o => o.line_items.map((i: WooCommerceLineItem) => i.id));
    const savedStatuses = await prisma.purchaseStatus.findMany({
        where: { lineItemId: { in: allLineItemIds } },
    });
    const statusMap = new Map(savedStatuses.map(s => [s.lineItemId, s]));

    return rawOrders.map(order => ({
        id: order.id,
        dateCreated: order.date_created,
        status: order.status,
        total: order.total,
        customer: `${order.billing.first_name} ${order.billing.last_name}`.trim(),
        lineItems: order.line_items.map((item: WooCommerceLineItem) => {
            const saved = statusMap.get(item.id);
            return {
                id: item.id,
                name: item.name,
                category: categoryMap.get(item.product_id) || 'Sin categoría',
                quantity: item.quantity,
                sku: item.sku,
                total: item.total,
                isPurchased: saved?.isPurchased ?? false,
                quantityPurchased: saved?.quantityPurchased ?? 0,
            };
        }),
    }));
}

// --- Formateo de mensajes ---
function escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

function formatOrderMessage(order: ProcessedOrder, detailed = false): string {
    const date = new Date(order.dateCreated).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

    const purchasedCount = order.lineItems.filter(i => i.isPurchased).length;
    const totalCount = order.lineItems.length;

    let msg = `🛒 *Pedido \\#${order.id}* \\— ${escapeMarkdown(order.customer)}\n`;
    msg += `💰 $${escapeMarkdown(order.total)} \\| 📅 ${escapeMarkdown(date)}\n`;
    msg += `📦 ${purchasedCount}/${totalCount} ítems comprados\n`;

    if (detailed) {
        // Agrupar ítems por categoría
        const byCategory = new Map<string, ProcessedLineItem[]>();
        for (const item of order.lineItems) {
            const cat = item.category || 'Sin categoría';
            if (!byCategory.has(cat)) byCategory.set(cat, []);
            byCategory.get(cat)!.push(item);
        }

        msg += '\n';
        for (const [cat, items] of byCategory) {
            msg += `*${escapeMarkdown(cat)}*\n`;
            for (const item of items) {
                const icon = item.isPurchased ? '✅' : '⬜';
                msg += `  ${icon} ${escapeMarkdown(item.name)} x${item.quantity}`;
                if (item.quantityPurchased > 0 && !item.isPurchased) {
                    msg += ` _\\(${item.quantityPurchased} comprados\\)_`;
                }
                msg += '\n';
            }
            msg += '\n';
        }
    }

    return msg;
}

// --- Stop del bot activo ---
async function stopActiveBot(): Promise<void> {
    for (const interval of activeIntervals) {
        clearInterval(interval);
    }
    activeIntervals = [];

    if (activeBotInstance) {
        try {
            await activeBotInstance.stopPolling();
        } catch {}
        activeBotInstance = null;
    }
}

// --- Inicialización del bot ---
export async function initTelegramBot(prisma: PrismaClient): Promise<TelegramBot | null> {
    await stopActiveBot();

    const configOrNull = await getBotConfig(prisma);
    if (!configOrNull) {
        console.log('Telegram: Bot deshabilitado (sin token configurado).');
        return null;
    }
    const config: BotConfig = configOrNull;

    function isAuthorized(chatId: number): boolean {
        if (config.allowedChatIds.length === 0) return true;
        return config.allowedChatIds.includes(String(chatId));
    }

    const bot = new TelegramBot(config.token, { polling: true });
    activeBotInstance = bot;

    // --- Guardar chats en DB para detección automática ---
    async function saveChat(chat: { id: number; type: string; first_name?: string; last_name?: string; title?: string; username?: string }) {
        const id = String(chat.id);
        let name = '';
        if (chat.type === 'private') {
            name = [chat.first_name, chat.last_name].filter(Boolean).join(' ');
        } else {
            name = chat.title || chat.username || `Grupo ${id}`;
        }
        await prisma.telegramKnownChat.upsert({
            where: { id },
            update: { name, type: chat.type },
            create: { id, name, type: chat.type },
        }).catch(() => {});
    }

    bot.on('message', (msg) => { saveChat(msg.chat); });
    bot.on('channel_post', (msg) => { saveChat(msg.chat); });

    // --- /start ---
    bot.onText(/\/start/, (msg) => {
        if (!isAuthorized(msg.chat.id)) return;
        const welcomeMsg =
            `👋 *Bot de PlantArte*\n\n` +
            `Comandos disponibles:\n\n` +
            `/pedidos — Ver pedidos pendientes\n` +
            `/pedido \\[id\\] — Detalle de un pedido\n` +
            `/buscar \\[texto\\] — Buscar en pedidos activos\n` +
            `/comprado \\[item\\_id\\] \\[cantidad\\] — Marcar ítem como comprado\n` +
            `/completar \\[order\\_id\\] — Marcar pedido como completado\n` +
            `/resumen — Resumen del día`;
        bot.sendMessage(msg.chat.id, welcomeMsg, { parse_mode: 'MarkdownV2' });
    });

    // --- /pedidos ---
    bot.onText(/\/pedidos/, async (msg) => {
        if (!isAuthorized(msg.chat.id)) return;
        try {
            await bot.sendMessage(msg.chat.id, '⏳ Consultando pedidos\\.\\.\\.');
            const orders = await fetchOrders(prisma);

            if (orders.length === 0) {
                await bot.sendMessage(msg.chat.id, '✅ No hay pedidos pendientes\\.');
                return;
            }

            await bot.sendMessage(msg.chat.id, `📋 *${orders.length} pedido\\(s\\) pendiente\\(s\\):*`, { parse_mode: 'MarkdownV2' });
            for (const order of orders) {
                await bot.sendMessage(msg.chat.id, formatOrderMessage(order, true), { parse_mode: 'MarkdownV2' });
            }
        } catch (err) {
            await bot.sendMessage(msg.chat.id, '❌ Error al obtener pedidos\\.');
            console.error('Telegram /pedidos error:', err);
        }
    });

    // --- /pedido [id] ---
    bot.onText(/\/pedido (.+)/, async (msg, match) => {
        if (!isAuthorized(msg.chat.id)) return;
        const orderId = match?.[1]?.trim();

        if (!orderId || isNaN(Number(orderId))) {
            await bot.sendMessage(msg.chat.id, '⚠️ Uso: `/pedido 123`', { parse_mode: 'MarkdownV2' });
            return;
        }

        try {
            await bot.sendMessage(msg.chat.id, `⏳ Buscando pedido \\#${orderId}\\.\\.\\.`, { parse_mode: 'MarkdownV2' });
            const { WOO_URL, WOO_KEY, WOO_SECRET } = getWooConfig();

            const response = await axios.get(`${WOO_URL}/wp-json/wc/v3/orders/${orderId}`, {
                auth: { username: WOO_KEY, password: WOO_SECRET },
                timeout: 10000,
            });
            const raw: WooCommerceOrder = response.data;

            const allLineItemIds = raw.line_items.map((i: WooCommerceLineItem) => i.id);
            const savedStatuses = await prisma.purchaseStatus.findMany({
                where: { lineItemId: { in: allLineItemIds } },
            });
            const statusMap = new Map(savedStatuses.map(s => [s.lineItemId, s]));

            const order: ProcessedOrder = {
                id: raw.id,
                dateCreated: raw.date_created,
                status: raw.status,
                total: raw.total,
                customer: `${raw.billing.first_name} ${raw.billing.last_name}`.trim(),
                lineItems: raw.line_items.map((item: WooCommerceLineItem) => {
                    const saved = statusMap.get(item.id);
                    return {
                        id: item.id,
                        name: item.name,
                        quantity: item.quantity,
                        sku: item.sku,
                        total: item.total,
                        isPurchased: saved?.isPurchased ?? false,
                        quantityPurchased: saved?.quantityPurchased ?? 0,
                    };
                }),
            };

            await bot.sendMessage(msg.chat.id, formatOrderMessage(order, true), { parse_mode: 'MarkdownV2' });
        } catch (err: unknown) {
            const axiosErr = err as { response?: { status?: number } };
            if (axiosErr?.response?.status === 404) {
                await bot.sendMessage(msg.chat.id, `❌ Pedido \\#${orderId} no encontrado\\.`, { parse_mode: 'MarkdownV2' });
            } else {
                await bot.sendMessage(msg.chat.id, '❌ Error al buscar el pedido\\.');
                console.error('Telegram /pedido error:', err);
            }
        }
    });

    // --- /buscar [texto] ---
    bot.onText(/\/buscar (.+)/, async (msg, match) => {
        if (!isAuthorized(msg.chat.id)) return;
        const searchTerm = match?.[1]?.trim().toLowerCase();

        if (!searchTerm) {
            await bot.sendMessage(msg.chat.id, '⚠️ Uso: `/buscar rosa`', { parse_mode: 'MarkdownV2' });
            return;
        }

        try {
            await bot.sendMessage(msg.chat.id, `⏳ Buscando _${escapeMarkdown(searchTerm)}_\\.\\.\\.`, { parse_mode: 'MarkdownV2' });
            const orders = await fetchOrders(prisma);
            const results: string[] = [];

            orders.forEach(order => {
                const matchingItems = order.lineItems.filter(item =>
                    item.name.toLowerCase().includes(searchTerm) ||
                    (item.sku && item.sku.toLowerCase().includes(searchTerm))
                );
                if (matchingItems.length > 0) {
                    let result = `🛒 *Pedido \\#${order.id}* — ${escapeMarkdown(order.customer)}\n`;
                    matchingItems.forEach(item => {
                        const icon = item.isPurchased ? '✅' : '⬜';
                        result += `${icon} ${escapeMarkdown(item.name)} x${item.quantity} — ID: \`${item.id}\`\n`;
                    });
                    results.push(result);
                }
            });

            if (results.length === 0) {
                await bot.sendMessage(msg.chat.id, `🔍 No se encontró _${escapeMarkdown(searchTerm)}_ en pedidos pendientes\\.`, { parse_mode: 'MarkdownV2' });
                return;
            }

            const header = `🔍 *${results.length} pedido\\(s\\) con _${escapeMarkdown(searchTerm)}_:*\n\n`;
            await bot.sendMessage(msg.chat.id, header + results.join('\n'), { parse_mode: 'MarkdownV2' });
        } catch (err) {
            await bot.sendMessage(msg.chat.id, '❌ Error al buscar\\.');
            console.error('Telegram /buscar error:', err);
        }
    });

    // --- /comprado [item_id] [cantidad] ---
    bot.onText(/\/comprado (.+)/, async (msg, match) => {
        if (!isAuthorized(msg.chat.id)) return;
        const parts = match?.[1]?.trim().split(/\s+/);
        const itemId = Number(parts?.[0]);
        const cantidadArg = parts?.[1] !== undefined ? Number(parts[1]) : null;

        if (!Number.isFinite(itemId) || itemId <= 0) {
            await bot.sendMessage(msg.chat.id, '⚠️ Uso: `/comprado 456 3` o `/comprado 456` para cantidad total', { parse_mode: 'MarkdownV2' });
            return;
        }

        try {
            await bot.sendMessage(msg.chat.id, `⏳ Actualizando ítem \\#${itemId}\\.\\.\\.`, { parse_mode: 'MarkdownV2' });
            const orders = await fetchOrders(prisma);

            let foundItem: ProcessedLineItem | null = null;
            let foundOrder: ProcessedOrder | null = null;

            for (const order of orders) {
                for (const item of order.lineItems) {
                    if (item.id === itemId) {
                        foundItem = item;
                        foundOrder = order;
                        break;
                    }
                }
                if (foundItem) break;
            }

            if (!foundItem || !foundOrder) {
                await bot.sendMessage(msg.chat.id, `❌ Ítem \\#${itemId} no encontrado en pedidos pendientes\\.`, { parse_mode: 'MarkdownV2' });
                return;
            }

            const quantityToSet = (cantidadArg !== null && Number.isFinite(cantidadArg))
                ? Math.min(cantidadArg, foundItem.quantity)
                : foundItem.quantity;

            const isPurchased = quantityToSet >= foundItem.quantity;

            await prisma.purchaseStatus.upsert({
                where: { lineItemId: itemId },
                update: { isPurchased, quantityPurchased: quantityToSet },
                create: {
                    lineItemId: itemId,
                    orderId: foundOrder.id,
                    isPurchased,
                    quantityPurchased: quantityToSet,
                },
            });

            const statusText = isPurchased
                ? '✅ Completamente comprado'
                : `⏳ Parcialmente comprado \\(${quantityToSet}/${foundItem.quantity}\\)`;

            await bot.sendMessage(
                msg.chat.id,
                `${statusText}\n📦 *${escapeMarkdown(foundItem.name)}* — Pedido \\#${foundOrder.id}`,
                { parse_mode: 'MarkdownV2' }
            );
        } catch (err) {
            await bot.sendMessage(msg.chat.id, '❌ Error al actualizar el ítem\\.');
            console.error('Telegram /comprado error:', err);
        }
    });

    // --- /completar [order_id] ---
    bot.onText(/\/completar (.+)/, async (msg, match) => {
        if (!isAuthorized(msg.chat.id)) return;
        const orderId = match?.[1]?.trim();

        if (!orderId || isNaN(Number(orderId))) {
            await bot.sendMessage(msg.chat.id, '⚠️ Uso: `/completar 123`', { parse_mode: 'MarkdownV2' });
            return;
        }

        try {
            await bot.sendMessage(msg.chat.id, `⏳ Completando pedido \\#${orderId}\\.\\.\\.`, { parse_mode: 'MarkdownV2' });
            const { WOO_URL, WOO_KEY, WOO_SECRET } = getWooConfig();

            await axios.put(
                `${WOO_URL}/wp-json/wc/v3/orders/${orderId}`,
                { status: 'completed' },
                {
                    auth: { username: WOO_KEY, password: WOO_SECRET },
                    timeout: 15000,
                }
            );

            await bot.sendMessage(msg.chat.id, `✅ Pedido \\#${orderId} marcado como completado\\.`, { parse_mode: 'MarkdownV2' });
        } catch (err: unknown) {
            const axiosErr = err as { response?: { status?: number } };
            if (axiosErr?.response?.status === 404) {
                await bot.sendMessage(msg.chat.id, `❌ Pedido \\#${orderId} no encontrado\\.`, { parse_mode: 'MarkdownV2' });
            } else {
                await bot.sendMessage(msg.chat.id, '❌ Error al completar el pedido\\.');
                console.error('Telegram /completar error:', err);
            }
        }
    });

    // --- /resumen ---
    bot.onText(/\/resumen/, async (msg) => {
        if (!isAuthorized(msg.chat.id)) return;
        try {
            await bot.sendMessage(msg.chat.id, '⏳ Generando resumen\\.\\.\\.');

            const [pendingOrders, completedOrders] = await Promise.all([
                fetchOrders(prisma, 'processing,on-hold'),
                fetchOrders(prisma, 'completed'),
            ]);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const completedToday = completedOrders.filter(o => new Date(o.dateCreated) >= today);

            const totalPendingItems = pendingOrders.reduce((sum, o) =>
                sum + o.lineItems.reduce((s, i) => s + i.quantity, 0), 0);
            const purchasedItems = pendingOrders.reduce((sum, o) =>
                sum + o.lineItems.filter(i => i.isPurchased).reduce((s, i) => s + i.quantityPurchased, 0), 0);

            let summaryMsg = `📊 *Resumen del día*\n\n`;
            summaryMsg += `📋 *Pedidos pendientes:* ${pendingOrders.length}\n`;
            summaryMsg += `📦 *Progreso de compras:* ${purchasedItems}/${totalPendingItems} ítems\n`;
            summaryMsg += `✅ *Completados hoy:* ${completedToday.length}\n`;

            if (pendingOrders.length > 0) {
                summaryMsg += `\n*Pedidos activos:*\n`;
                pendingOrders.slice(0, 8).forEach(o => {
                    const purchased = o.lineItems.filter(i => i.isPurchased).length;
                    summaryMsg += `• \\#${o.id} — ${escapeMarkdown(o.customer)} \\(${purchased}/${o.lineItems.length}\\)\n`;
                });
                if (pendingOrders.length > 8) {
                    summaryMsg += `_\\.\\.\\.y ${pendingOrders.length - 8} más_\n`;
                }
            }

            await bot.sendMessage(msg.chat.id, summaryMsg, { parse_mode: 'MarkdownV2' });
        } catch (err) {
            await bot.sendMessage(msg.chat.id, '❌ Error al generar resumen\\.');
            console.error('Telegram /resumen error:', err);
        }
    });

    // --- Notificaciones automáticas ---
    if (config.chatId) {
        const knownOrderIds = new Set<number>();
        let isInitialized = false;

        // Cargar pedidos existentes al iniciar para no re-notificar
        fetchOrders(prisma).then(orders => {
            orders.forEach(o => knownOrderIds.add(o.id));
            isInitialized = true;
            console.log(`Telegram: ${knownOrderIds.size} pedidos existentes registrados`);
        }).catch(err => {
            console.error('Telegram: Error inicializando pedidos conocidos:', err);
            isInitialized = true;
        });

        // Polling cada 2 minutos para detectar nuevos pedidos
        const newOrderInterval = setInterval(async () => {
            if (!isInitialized) return;
            try {
                const orders = await fetchOrders(prisma);
                const newOrders = orders.filter(o => !knownOrderIds.has(o.id));
                for (const order of newOrders) {
                    knownOrderIds.add(order.id);
                    const appUrl = process.env.FRONTEND_URL;
                    const link = appUrl ? `\n🔗 [Abrir en PlantArte](${appUrl}?pedido=${order.id})` : '';
                    const notifMsg = `🆕 *Nuevo pedido recibido\\!*\n\n` + formatOrderMessage(order, true) + link;
                    await bot.sendMessage(config.chatId, notifMsg, { parse_mode: 'MarkdownV2' });
                }
            } catch (err) {
                console.error('Telegram: Error en polling de nuevos pedidos:', err);
            }
        }, 2 * 60 * 1000);

        // Alerta cada 30 minutos si hay pedidos sin atender
        const staleOrderInterval = setInterval(async () => {
            try {
                const orders = await fetchOrders(prisma);
                const now = Date.now();
                const threshold = config.staleHours * 60 * 60 * 1000;

                const staleOrders = orders.filter(o => {
                    return now - new Date(o.dateCreated).getTime() > threshold;
                });

                if (staleOrders.length > 0) {
                    let alertMsg = `⚠️ *${staleOrders.length} pedido\\(s\\) sin atender por más de ${config.staleHours}h:*\n\n`;
                    staleOrders.forEach(o => {
                        const hours = Math.floor((now - new Date(o.dateCreated).getTime()) / (60 * 60 * 1000));
                        alertMsg += `• \\#${o.id} — ${escapeMarkdown(o.customer)} \\(hace ${hours}h\\)\n`;
                    });
                    await bot.sendMessage(config.chatId, alertMsg, { parse_mode: 'MarkdownV2' });
                }
            } catch (err) {
                console.error('Telegram: Error verificando pedidos sin atender:', err);
            }
        }, 30 * 60 * 1000);

        activeIntervals.push(newOrderInterval, staleOrderInterval);
    }

    console.log('Bot de Telegram iniciado correctamente.');
    return bot;
}

// --- Reinicialización (llamado desde API al guardar config) ---
export async function reinitTelegramBot(prisma: PrismaClient): Promise<void> {
    await initTelegramBot(prisma);
}

// --- Notificación de faltantes al completar un pedido ---
export async function notifyMissingItems(
    prisma: PrismaClient,
    orderId: number,
    customer: string,
    missingItems: Array<{ name: string; category: string; quantity: number; quantityPurchased: number }>
): Promise<void> {
    const config = await getBotConfig(prisma);
    if (!config?.chatId || !activeBotInstance) return;

    let msg = `⚠️ *Pedido \\#${orderId} completado con faltantes*\n`;
    msg += `👤 ${escapeMarkdown(customer)}\n\n`;

    // Agrupar faltantes por categoría
    const byCategory = new Map<string, typeof missingItems>();
    for (const item of missingItems) {
        const cat = item.category || 'Sin categoría';
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat)!.push(item);
    }

    for (const [cat, items] of byCategory) {
        msg += `*${escapeMarkdown(cat)}*\n`;
        for (const item of items) {
            const faltante = item.quantity - item.quantityPurchased;
            msg += `  • ${escapeMarkdown(item.name)} \\— falta ${faltante}/${item.quantity}\n`;
        }
        msg += '\n';
    }

    await activeBotInstance.sendMessage(config.chatId, msg, { parse_mode: 'MarkdownV2' });
}
