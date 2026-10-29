import { prisma } from './prisma';
import { storeClock, type StoreClock } from './storeTime';
import { escapeHtml, getTelegramSettings, sendTelegramMessage, telegramToken, type TelegramSettingsRow } from './telegram';
import { nextSmartDay, smartDayDateLabel } from './smartDay';

// Weekly order-day reminders and Smart Day notices. A one-minute tick checks
// the store's wall clock; each send is claimed in the database first
// (lastSentOn / lastFollowUpOn / smartDayNotifiedOn), so a restart or a second
// instance during a redeploy never sends it twice.

const TICK_MS = 60_000;

type Reminder = {
    id: string; weekday: number; time: string; message: string;
    followUpTime: string | null; lastSentOn: string | null; lastFollowUpOn: string | null;
};

// Marks the reminder as handled for today. Returns false if another tick or
// instance got there first.
async function claim(id: string, field: 'lastSentOn' | 'lastFollowUpOn', today: string): Promise<boolean> {
    const { count } = await prisma.orderReminder.updateMany({
        where: { id, OR: [{ [field]: null }, { [field]: { not: today } }] },
        data: { [field]: today },
    });
    return count === 1;
}

async function release(id: string, field: 'lastSentOn' | 'lastFollowUpOn', previous: string | null) {
    await prisma.orderReminder.update({ where: { id }, data: { [field]: previous } }).catch(() => undefined);
}

// Shared with the test buttons in Configuración so a preview matches the real thing.
export function reminderText(message: string): string {
    return `🗓️ <b>Hoy es día de pedido</b>\n${escapeHtml(message)}`;
}

export function followUpText(message: string): string {
    return `⏰ <b>Todavía no se registra ningún pedido hoy</b>\n${escapeHtml(message)}`;
}

async function sendMorning(r: Reminder, chatId: string, clock: StoreClock) {
    if (!(await claim(r.id, 'lastSentOn', clock.date))) return;
    try {
        await sendTelegramMessage(chatId, reminderText(r.message));
    } catch (err) {
        // Let the next tick retry instead of losing today's reminder.
        await release(r.id, 'lastSentOn', r.lastSentOn);
        throw err;
    }
}

async function sendFollowUp(r: Reminder, chatId: string, clock: StoreClock) {
    if (!(await claim(r.id, 'lastFollowUpOn', clock.date))) return;
    try {
        const ordersToday = await prisma.storeOrder.count({ where: { dateCreated: { gte: clock.startOfDay } } });
        if (ordersToday > 0) return;
        await sendTelegramMessage(chatId, followUpText(r.message));
    } catch (err) {
        await release(r.id, 'lastFollowUpOn', r.lastFollowUpOn);
        throw err;
    }
}

// Like new-order notices, it names no products: the Smart Day list lives in
// the Tienda, where it stays current.
export function smartDayText(supplierName: string, date: string, daysLeft: number, articleCount: number, appUrl?: string): string {
    const name = escapeHtml(supplierName);
    const header = daysLeft <= 0 ? `⚡ <b>¡Hoy es Smart Day de ${name}!</b>`
        : daysLeft === 1 ? `⚡ <b>Mañana es Smart Day de ${name}</b>`
        : `⚡ <b>Smart Day de ${name} en ${daysLeft} días</b>`;
    const label = smartDayDateLabel(date);
    const lines = [header, `📅 ${label.charAt(0).toUpperCase()}${label.slice(1)}`];
    if (articleCount > 0) lines.push(`🏷️ ${articleCount} artículo${articleCount !== 1 ? 's' : ''} marcado${articleCount !== 1 ? 's' : ''} como Smart Day`);
    lines.push(daysLeft <= 0 ? 'Hoy se hacen las compras de Smart Day.' : 'Revisen qué hace falta y agréguenlo al pedido en la Tienda.');
    if (appUrl) lines.push('', `👉 <a href="${escapeHtml(appUrl.replace(/\/+$/, ''))}">Abrir PlantArte Compras</a>`);
    return lines.join('\n');
}

export function smartDayArticleCount(supplierId: string): Promise<number> {
    return prisma.article.count({ where: { smartDay: true, suppliers: { some: { supplierId } } } });
}

// Every day from smartDayLeadDays before the supplier's Smart Day up to the
// day itself, once a day from smartDayTime on.
async function runSmartDayNotices(settings: TelegramSettingsRow, chatId: string, clock: StoreClock) {
    if (!settings.smartDayReminders || clock.time < settings.smartDayTime) return;
    const suppliers = await prisma.supplier.findMany({
        where: { smartDayEnabled: true, OR: [{ smartDayNotifiedOn: null }, { smartDayNotifiedOn: { not: clock.date } }] },
    });
    for (const s of suppliers) {
        const next = nextSmartDay(s, clock.date);
        if (!next || next.daysLeft > s.smartDayLeadDays) continue;
        try {
            const { count } = await prisma.supplier.updateMany({
                where: { id: s.id, OR: [{ smartDayNotifiedOn: null }, { smartDayNotifiedOn: { not: clock.date } }] },
                data: { smartDayNotifiedOn: clock.date },
            });
            if (count !== 1) continue;
            try {
                const text = smartDayText(s.name, next.date, next.daysLeft, await smartDayArticleCount(s.id), process.env.FRONTEND_URL);
                await sendTelegramMessage(chatId, text);
            } catch (err) {
                await prisma.supplier.update({ where: { id: s.id }, data: { smartDayNotifiedOn: s.smartDayNotifiedOn } }).catch(() => undefined);
                throw err;
            }
        } catch (err) {
            console.error('Error al enviar aviso de Smart Day:', err instanceof Error ? err.message : err);
        }
    }
}

export async function runReminderTick(now: Date = new Date()): Promise<void> {
    if (!telegramToken()) return;
    const settings = await getTelegramSettings();
    if (!settings.chatId) return;

    const clock = storeClock(now);
    await runSmartDayNotices(settings, settings.chatId, clock);
    const reminders = await prisma.orderReminder.findMany({ where: { enabled: true, weekday: clock.weekday } });
    for (const r of reminders) {
        try {
            // The morning reminder is skipped once the follow-up is due — a late
            // restart should not announce the day at 11 pm.
            const morningDue = r.time <= clock.time && r.lastSentOn !== clock.date
                && (!r.followUpTime || clock.time < r.followUpTime);
            if (morningDue) await sendMorning(r, settings.chatId, clock);

            const followUpDue = !!r.followUpTime && r.followUpTime <= clock.time && r.lastFollowUpOn !== clock.date;
            if (followUpDue) await sendFollowUp(r, settings.chatId, clock);
        } catch (err) {
            console.error('Error al enviar recordatorio de Telegram:', err instanceof Error ? err.message : err);
        }
    }
}

export function startReminderScheduler(): void {
    const tick = () => { runReminderTick().catch(err => console.error('Error en recordatorios:', err instanceof Error ? err.message : err)); };
    tick();
    setInterval(tick, TICK_MS).unref();
}
