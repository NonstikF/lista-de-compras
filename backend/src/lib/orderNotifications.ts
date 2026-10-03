import { prisma } from './prisma';
import { escapeHtml, getTelegramSettings, sendTelegramMessage, telegramToken } from './telegram';

export type NewOrder = {
    id: number;
    customerName: string;
    notes: string;
    total: number;
    items: { articleId: string; name: string; qty: number; supplierName: string; supplierId: string | null }[];
};

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const articles = (n: number) => `${n} artículo${n !== 1 ? 's' : ''}`;

// The notice names the suppliers involved but never the products: a list in
// the chat invited people to fill the order from Telegram, where it goes stale
// and mistakes slip in. The order is managed in the app.
//
// Telegram has no colours, so a highlighted order gets a 🚨 header, its
// suppliers listed first and marked 🔴, and it is the only kind that rings —
// regular orders arrive silently.
export function buildNewOrderMessage(order: NewOrder, highlight: HighlightRule, appUrl?: string): { text: string; highlighted: boolean } {
    const groups = new Map<string, { name: string; highlighted: boolean; articleIds: Set<string> }>();
    for (const item of order.items) {
        const name = item.supplierName || 'Sin proveedor';
        const key = name.toLowerCase();
        const isHighlighted = (!!item.supplierId && highlight.ids.has(item.supplierId)) || highlight.names.has(key);
        const group = groups.get(key) ?? { name, highlighted: false, articleIds: new Set<string>() };
        group.highlighted ||= isHighlighted;
        group.articleIds.add(item.articleId);
        groups.set(key, group);
    }
    const ordered = [...groups.values()].sort((a, b) => Number(b.highlighted) - Number(a.highlighted) || a.name.localeCompare(b.name));
    const highlightedNames = ordered.filter(g => g.highlighted).map(g => g.name);
    const articleCount = new Set(order.items.map(i => i.articleId)).size;

    const lines: string[] = [];
    if (highlightedNames.length > 0) {
        lines.push(`🚨🚨 <b>PEDIDO CON ${escapeHtml(highlightedNames.join(' / ').toUpperCase())}</b> 🚨🚨`, '');
    }
    lines.push(`🛒 <b>Nuevo pedido T-${order.id}</b>`);
    lines.push(`👤 ${escapeHtml(order.customerName)} · ${articles(articleCount)} · ${money(order.total)}`);
    if (order.notes.trim()) lines.push(`📝 ${escapeHtml(order.notes.trim())}`);

    lines.push('', '<b>Proveedores</b>');
    for (const g of ordered) {
        lines.push(g.highlighted
            ? `🔴 <b>${escapeHtml(g.name)}</b> · ${articles(g.articleIds.size)}`
            : `• ${escapeHtml(g.name)} · ${articles(g.articleIds.size)}`);
    }

    lines.push('', appUrl
        ? `👉 <a href="${escapeHtml(appUrl)}">Abrir en la app</a>`
        : '👉 Revisa el pedido en la app.');

    return { text: lines.join('\n'), highlighted: highlightedNames.length > 0 };
}

export type HighlightRule = { ids: Set<string>; names: Set<string> };

export async function loadHighlightRule(highlightSupplierIds: string[]): Promise<HighlightRule> {
    const suppliers = highlightSupplierIds.length > 0
        ? await prisma.supplier.findMany({ where: { id: { in: highlightSupplierIds } }, select: { name: true } })
        : [];
    return { ids: new Set(highlightSupplierIds), names: new Set(suppliers.map(s => s.name.toLowerCase())) };
}

// Fire-and-forget: a Telegram outage must never fail the order itself.
export function notifyNewOrder(order: NewOrder): void {
    void (async () => {
        if (!telegramToken()) return;
        const settings = await getTelegramSettings();
        if (!settings.chatId || !settings.notifyNewOrders) return;
        const highlight = await loadHighlightRule(settings.highlightSupplierIds);
        const { text, highlighted } = buildNewOrderMessage(order, highlight, process.env.FRONTEND_URL);
        await sendTelegramMessage(settings.chatId, text, { silent: !highlighted });
    })().catch(err => console.error('Error al notificar pedido por Telegram:', err instanceof Error ? err.message : err));
}
