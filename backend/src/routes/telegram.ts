import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { STORE_TIMEZONE } from '../lib/storeTime';
import { buildNewOrderMessage, loadHighlightRule, type NewOrder } from '../lib/orderNotifications';
import { followUpText, reminderText } from '../lib/reminders';
import { escapeHtml, getBotUsername, getRecentChats, getTelegramSettings, sendTelegramMessage, telegramToken } from '../lib/telegram';

const router = Router();

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (usa HH:MM)');

const reminderSchema = z.object({
    id: z.string().optional(),
    weekday: z.number().int().min(0).max(6),
    time: HHMM,
    message: z.string().trim().min(1, 'El recordatorio necesita un mensaje').max(1000),
    followUpTime: HHMM.nullable().default(null),
    enabled: z.boolean().default(true),
});

const updateSchema = z.object({
    chatId: z.string().nullable().optional(),
    chatTitle: z.string().optional(),
    notifyNewOrders: z.boolean().optional(),
    highlightSupplierIds: z.array(z.string()).optional(),
    reminders: z.array(reminderSchema).optional(),
});

async function buildConfig() {
    const [settings, reminders, suppliers] = await Promise.all([
        getTelegramSettings(),
        prisma.orderReminder.findMany({ orderBy: [{ weekday: 'asc' }, { time: 'asc' }] }),
        prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    const tokenConfigured = !!telegramToken();
    let botUsername: string | null = null;
    let botError: string | null = null;
    if (tokenConfigured) {
        try { botUsername = await getBotUsername(); } catch (err) { botError = err instanceof Error ? err.message : 'Error de Telegram'; }
    }
    return {
        tokenConfigured,
        botUsername,
        botError,
        timezone: STORE_TIMEZONE,
        ...settings,
        suppliers,
        reminders: reminders.map(r => ({
            id: r.id, weekday: r.weekday, time: r.time, message: r.message,
            followUpTime: r.followUpTime, enabled: r.enabled,
        })),
    };
}

router.get('/', async (_req: Request, res: Response) => {
    try {
        res.json(await buildConfig());
    } catch (err) {
        console.error('Error al obtener configuración de Telegram:', err);
        res.status(500).json({ error: 'Error al obtener configuración de Telegram' });
    }
});

router.put('/', async (req: Request, res: Response) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { reminders, highlightSupplierIds, ...rest } = parsed.data;
    try {
        await prisma.$transaction(async (tx) => {
            const data = {
                ...rest,
                ...(highlightSupplierIds !== undefined && { highlightSupplierIds: JSON.stringify([...new Set(highlightSupplierIds)]) }),
            };
            await tx.telegramSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });

            if (reminders !== undefined) {
                const keepIds = reminders.map(r => r.id).filter((id): id is string => !!id);
                await tx.orderReminder.deleteMany({ where: { id: { notIn: keepIds } } });
                for (const { id, ...r } of reminders) {
                    // Updating keeps lastSentOn, so editing a reminder does not resend it today.
                    if (id) await tx.orderReminder.update({ where: { id }, data: r });
                    else await tx.orderReminder.create({ data: r });
                }
            }
        });
        res.json(await buildConfig());
    } catch (err) {
        console.error('Error al guardar configuración de Telegram:', err);
        res.status(500).json({ error: 'Error al guardar configuración de Telegram' });
    }
});

// Chats the bot was recently added to or received "/start" in.
router.post('/detect-chats', async (_req: Request, res: Response) => {
    try {
        res.json(await getRecentChats());
    } catch (err) {
        res.status(502).json({ error: err instanceof Error ? err.message : 'Error al consultar Telegram' });
    }
});

const testSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('connection') }),
    z.object({ kind: z.literal('order') }),
    z.object({ kind: z.literal('highlightedOrder') }),
    z.object({ kind: z.literal('reminder'), message: z.string().trim().min(1, 'El recordatorio necesita un mensaje').max(1000) }),
    z.object({ kind: z.literal('followUp'), message: z.string().trim().min(1, 'El recordatorio necesita un mensaje').max(1000) }),
]);

const TEST_BANNER = '🧪 <i>Mensaje de prueba — así se verá en el grupo</i>\n\n';

// A sample order built from real suppliers and a couple of their articles, so
// the preview looks like what the group will actually receive.
async function sampleOrder(highlightIds: string[], withHighlighted: boolean, customerName: string): Promise<NewOrder> {
    const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const highlighted = suppliers.filter(s => highlightIds.includes(s.id)).slice(0, 2);
    const regular = suppliers.filter(s => !highlightIds.includes(s.id)).slice(0, withHighlighted ? 1 : 2);
    const chosen = [...(withHighlighted ? highlighted : []), ...regular];
    if (chosen.length === 0) chosen.push({ id: '', name: 'PROVEEDOR DE EJEMPLO' });

    const items: NewOrder['items'] = [];
    let total = 0;
    for (const s of chosen) {
        const articles = s.id
            ? await prisma.article.findMany({ where: { suppliers: { some: { supplierId: s.id } } }, select: { id: true, name: true, price: true }, take: 2, orderBy: { name: 'asc' } })
            : [];
        const picks = articles.length > 0 ? articles : [{ id: `sample-${s.name}`, name: 'Artículo de ejemplo', price: 0 }];
        picks.forEach((a, i) => { total += a.price * (i + 1); items.push({ articleId: a.id, name: a.name, qty: i + 1, supplierName: s.name, supplierId: s.id || null }); });
    }
    const last = await prisma.storeOrder.findFirst({ select: { id: true }, orderBy: { id: 'desc' } });
    return { id: (last?.id ?? 0) + 1, customerName, notes: '', total, items };
}

// Sends a sample of each message type to the linked group. Reminder samples use
// the text from the form, so unsaved edits can be previewed.
router.post('/test', async (req: Request, res: Response) => {
    const parsed = testSchema.safeParse(req.body?.kind ? req.body : { kind: 'connection' });
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const test = parsed.data;
    try {
        const settings = await getTelegramSettings();
        if (!settings.chatId) { res.status(400).json({ error: 'Primero vincula un grupo' }); return; }

        if (test.kind === 'connection') {
            await sendTelegramMessage(settings.chatId, `✅ <b>Prueba de PlantArte Compras</b>\nEste grupo recibirá los avisos de pedidos y los recordatorios${settings.chatTitle ? ` (${escapeHtml(settings.chatTitle)})` : ''}.`);
        } else if (test.kind === 'order' || test.kind === 'highlightedOrder') {
            const withHighlighted = test.kind === 'highlightedOrder';
            if (withHighlighted && settings.highlightSupplierIds.length === 0) {
                res.status(400).json({ error: 'Marca y guarda al menos un proveedor resaltado' });
                return;
            }
            const order = await sampleOrder(settings.highlightSupplierIds, withHighlighted, req.user?.nombre || 'Ejemplo');
            const highlight = await loadHighlightRule(settings.highlightSupplierIds);
            const { text, highlighted } = buildNewOrderMessage(order, highlight, process.env.FRONTEND_URL);
            // Same sound setting as the real message, so the test also shows whether it rings.
            await sendTelegramMessage(settings.chatId, TEST_BANNER + text, { silent: !highlighted });
        } else {
            const text = test.kind === 'reminder' ? reminderText(test.message) : followUpText(test.message);
            await sendTelegramMessage(settings.chatId, TEST_BANNER + text);
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(502).json({ error: err instanceof Error ? err.message : 'Error al enviar mensaje' });
    }
});

export default router;
