import { prisma } from './prisma';
import { storeClock, type StoreClock } from './storeTime';
import { escapeHtml, getTelegramSettings, sendTelegramMessage, telegramToken } from './telegram';

// Weekly order-day reminders. A one-minute tick checks the store's wall clock;
// each send is claimed in the database first (lastSentOn / lastFollowUpOn), so
// a restart or a second instance during a redeploy never sends it twice.

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

async function sendMorning(r: Reminder, chatId: string, clock: StoreClock) {
    if (!(await claim(r.id, 'lastSentOn', clock.date))) return;
    try {
        await sendTelegramMessage(chatId, `🗓️ <b>Hoy es día de pedido</b>\n${escapeHtml(r.message)}`);
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
        await sendTelegramMessage(chatId, `⏰ <b>Todavía no se registra ningún pedido hoy</b>\n${escapeHtml(r.message)}`);
    } catch (err) {
        await release(r.id, 'lastFollowUpOn', r.lastFollowUpOn);
        throw err;
    }
}

export async function runReminderTick(now: Date = new Date()): Promise<void> {
    if (!telegramToken()) return;
    const settings = await getTelegramSettings();
    if (!settings.chatId) return;

    const clock = storeClock(now);
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
