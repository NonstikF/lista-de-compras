import { prisma } from './prisma';

// Minimal Telegram Bot API client. The bot only sends messages — it never
// listens — so there is no polling loop and nothing that can collide when
// Railway runs two instances during a redeploy.
//
// The token is a secret: it comes from TELEGRAM_BOT_TOKEN and is never stored
// in the database, returned by the API or logged.

const API = 'https://api.telegram.org';

export function telegramToken(): string | null {
    return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

// When a group is upgraded to a supergroup its chat id changes, and Telegram
// answers messages to the old id with the new one in migrate_to_chat_id.
class TelegramError extends Error {
    constructor(message: string, readonly migrateToChatId?: string) {
        super(message);
    }
}

async function callTelegram<T>(method: string, body: Record<string, unknown> = {}): Promise<T> {
    const token = telegramToken();
    if (!token) throw new Error('Falta la variable TELEGRAM_BOT_TOKEN');
    let res: Response;
    try {
        res = await fetch(`${API}/bot${token}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15_000),
        });
    } catch {
        // The request URL carries the token; never surface the raw error.
        throw new Error('No se pudo conectar con Telegram');
    }
    const data = await res.json().catch(() => null) as {
        ok: boolean; result?: T; description?: string; parameters?: { migrate_to_chat_id?: number };
    } | null;
    if (!data?.ok) {
        const migrateTo = data?.parameters?.migrate_to_chat_id;
        throw new TelegramError(`Telegram: ${data?.description ?? `error ${res.status}`}`, migrateTo ? String(migrateTo) : undefined);
    }
    return data.result as T;
}

export function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function getBotUsername(): Promise<string> {
    const me = await callTelegram<{ username: string }>('getMe');
    return me.username;
}

// `silent` delivers without sound, so only highlighted messages ring.
// A group upgraded to a supergroup is followed to its new id, which is saved
// so later messages go straight there.
export async function sendTelegramMessage(chatId: string, html: string, opts: { silent?: boolean } = {}): Promise<void> {
    const send = (to: string) => callTelegram('sendMessage', {
        chat_id: to,
        text: html,
        parse_mode: 'HTML',
        disable_notification: opts.silent ?? false,
        link_preview_options: { is_disabled: true },
    });
    try {
        await send(chatId);
    } catch (err) {
        if (!(err instanceof TelegramError) || !err.migrateToChatId) throw err;
        await prisma.telegramSettings.updateMany({ where: { chatId }, data: { chatId: err.migrateToChatId } });
        await send(err.migrateToChatId);
    }
}

export type TelegramChat = { id: string; title: string; type: string };

type ChatLike = { id: number; type: string; title?: string; first_name?: string; last_name?: string; username?: string };
type Update = {
    message?: { chat: ChatLike };
    channel_post?: { chat: ChatLike };
    my_chat_member?: { chat: ChatLike };
};

// Chats that talked to the bot recently (Telegram keeps updates ~24 h).
// Adding the bot to a group produces a my_chat_member update; with privacy mode
// on, a "/start" typed in the group is also delivered.
export async function getRecentChats(): Promise<TelegramChat[]> {
    const updates = await callTelegram<Update[]>('getUpdates', { allowed_updates: ['message', 'channel_post', 'my_chat_member'] });
    const chats = new Map<string, TelegramChat>();
    for (const u of updates) {
        const chat = u.message?.chat ?? u.channel_post?.chat ?? u.my_chat_member?.chat;
        if (!chat) continue;
        const title = chat.title ?? ([chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || String(chat.id));
        chats.set(String(chat.id), { id: String(chat.id), title, type: chat.type });
    }
    return [...chats.values()];
}

export type TelegramSettingsRow = {
    chatId: string | null;
    chatTitle: string;
    notifyNewOrders: boolean;
    highlightSupplierIds: string[];
};

export async function getTelegramSettings(): Promise<TelegramSettingsRow> {
    const row = await prisma.telegramSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    let highlightSupplierIds: string[] = [];
    try {
        const parsed: unknown = JSON.parse(row.highlightSupplierIds);
        if (Array.isArray(parsed)) highlightSupplierIds = parsed.filter((v): v is string => typeof v === 'string');
    } catch { /* keep empty */ }
    return { chatId: row.chatId, chatTitle: row.chatTitle, notifyNewOrders: row.notifyNewOrders, highlightSupplierIds };
}
