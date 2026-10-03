import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { STORE_TIMEZONE } from '../lib/storeTime';
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

router.post('/test', async (_req: Request, res: Response) => {
    try {
        const settings = await getTelegramSettings();
        if (!settings.chatId) { res.status(400).json({ error: 'Primero vincula un grupo' }); return; }
        await sendTelegramMessage(settings.chatId, `✅ <b>Prueba de PlantArte Compras</b>\nEste grupo recibirá los avisos de pedidos y los recordatorios${settings.chatTitle ? ` (${escapeHtml(settings.chatTitle)})` : ''}.`);
        res.json({ ok: true });
    } catch (err) {
        res.status(502).json({ error: err instanceof Error ? err.message : 'Error al enviar mensaje' });
    }
});

export default router;
