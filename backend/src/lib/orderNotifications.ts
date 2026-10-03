import { prisma } from './prisma';
import { escapeHtml, getTelegramSettings, sendTelegramMessage, telegramToken } from './telegram';

type NewOrder = {
    id: number;
    customerName: string;
    notes: string;
    total: number;
    items: { articleId: string; name: string; qty: number; supplierName: string; supplierId: string | null }[];
};

// Telegram rejects messages over 4096 characters.
const MAX_LENGTH = 3800;

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Telegram has no colours, so a highlighted order gets a 🚨 header, its
// suppliers listed first and marked 🔴, and it is the only kind that rings —
// regular orders arrive silently.
export function buildNewOrderMessage(order: NewOrder, highlight: { ids: Set<string>; names: Set<string> }, appUrl?: string): { text: string; highlighted: boolean } {
    const groups = new Map<string, { name: string; highlighted: boolean; items: NewOrder['items'] }>();
    for (const item of order.items) {
        const name = item.supplierName || 'Sin proveedor';
        const key = name.toLowerCase();
        const isHighlighted = (!!item.supplierId && highlight.ids.has(item.supplierId)) || highlight.names.has(key);
        const group = groups.get(key) ?? { name, highlighted: false, items: [] };
        group.highlighted ||= isHighlighted;
        group.items.push(item);
        groups.set(key, group);
    }
    const ordered = [...groups.values()].sort((a, b) => Number(b.highlighted) - Number(a.highlighted) || a.name.localeCompare(b.name));
    const highlightedNames = ordered.filter(g => g.highlighted).map(g => g.name);
    const articleCount = new Set(order.items.map(i => i.articleId)).size;

    const head: string[] = [];
    if (highlightedNames.length > 0) {
        head.push(`🚨🚨 <b>PEDIDO CON ${escapeHtml(highlightedNames.join(' / ').toUpperCase())}</b> 🚨🚨`, '');
    }
    head.push(`🛒 <b>Nuevo pedido T-${order.id}</b>`);
    head.push(`👤 ${escapeHtml(order.customerName)} · ${articleCount} artículo${articleCount !== 1 ? 's' : ''} · ${money(order.total)}`);
    if (order.notes.trim()) head.push(`📝 ${escapeHtml(order.notes.trim())}`);

    const tail = appUrl ? `\n\n<a href="${escapeHtml(appUrl)}">Abrir en la app</a>` : '';
    let body = '';
    let omitted = 0;
    for (const g of ordered) {
        const lines = [`\n<b>${g.highlighted ? '🔴 ' : ''}${escapeHtml(g.name)}</b>`, ...g.items.map(i => `• ${i.qty} × ${escapeHtml(i.name)}`)];
        for (const line of lines) {
            if (head.join('\n').length + body.length + line.length + tail.length + 40 > MAX_LENGTH) { omitted++; continue; }
            body += `\n${line}`;
        }
    }
    if (omitted > 0) body += `\n… y más artículos, revisa el pedido en la app.`;

    return { text: head.join('\n') + body + tail, highlighted: highlightedNames.length > 0 };
}

// Fire-and-forget: a Telegram outage must never fail the order itself.
export function notifyNewOrder(order: NewOrder): void {
    void (async () => {
        if (!telegramToken()) return;
        const settings = await getTelegramSettings();
        if (!settings.chatId || !settings.notifyNewOrders) return;
        const suppliers = settings.highlightSupplierIds.length > 0
            ? await prisma.supplier.findMany({ where: { id: { in: settings.highlightSupplierIds } }, select: { name: true } })
            : [];
        const highlight = {
            ids: new Set(settings.highlightSupplierIds),
            names: new Set(suppliers.map(s => s.name.toLowerCase())),
        };
        const { text, highlighted } = buildNewOrderMessage(order, highlight, process.env.FRONTEND_URL);
        await sendTelegramMessage(settings.chatId, text, { silent: !highlighted });
    })().catch(err => console.error('Error al notificar pedido por Telegram:', err instanceof Error ? err.message : err));
}
