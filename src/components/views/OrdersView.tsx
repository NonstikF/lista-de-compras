import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Order, LineItem, StoreOrder, StoreOrderItem, OrderTicket, Supplier, Article } from '../../types';
import { getOrders, saveItemStatus, completeOrder, AuthError, type OrderStatusType, getSuppliers, getArticles } from '../../services/api';
import { getStoreOrders, completeStoreOrder, getOrderTickets, getOrderTicketContent, createOrderTicket, deleteOrderTicket, getOrderTicketCounts, updateStoreItemStatus, getStoreOrderTickets, getStoreOrderTicketContent, createStoreOrderTicket, deleteStoreOrderTicket, addStoreOrderItem, deleteStoreOrderItem, editStoreOrderItem } from '../../services/api';
import { Modal, Input, Button } from '../ui';
import { CheckCircleIcon, ChevronDownIcon, XMarkIcon, EyeIcon } from '../ui/icons';
import { showToast } from '../ui/Toast';
import { fmt } from '../ui';

type TabMode = OrderStatusType | 'store';


interface OrdersViewProps {
  authToken: string;
  onAuthError: () => void;
}

// --- Modal de Imagen ---
const ProductImageModal: React.FC<{ imageUrl: string; productName: string; onClose: () => void }> = ({ imageUrl, productName, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg mx-auto overflow-hidden" onClick={e => e.stopPropagation()}>
            <button
                onClick={onClose}
                className="absolute top-2 right-2 p-1 bg-white rounded-full text-on-surface-variant hover:bg-surface-container-low focus:outline-none"
                aria-label="Cerrar imagen"
            >
                <XMarkIcon className="w-6 h-6" />
            </button>
            <img src={imageUrl} alt={productName} className="max-h-[80vh] w-full object-contain" />
            <div className="p-3 text-center text-on-surface font-medium border-t border-surface-variant">
                {productName}
            </div>
        </div>
    </div>
);

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center h-64">
        <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
    </div>
);

const EmptyState: React.FC = () => (
    <div className="text-center py-16 px-6 bg-surface-container-low rounded-2xl">
        <CheckCircleIcon className="mx-auto h-12 w-12 text-success-purchased" />
        <h3 className="mt-3 text-xl font-epilogue font-bold text-on-background">¡Todo al día!</h3>
        <p className="mt-1 text-on-surface-variant">No hay pedidos pendientes en este momento</p>
    </div>
);

const EmptyStoreOrders: React.FC = () => (
    <div className="text-center py-16 px-6 bg-surface-container-low rounded-2xl">
        <span className="material-symbols-outlined text-on-surface-variant block text-5xl mb-3">storefront</span>
        <h3 className="text-xl font-epilogue font-bold text-on-background">Sin pedidos de Tienda</h3>
        <p className="mt-1 text-on-surface-variant">Los pedidos creados desde la Tienda aparecerán aquí.</p>
    </div>
);

// --- Tarjeta pedido de Tienda ---
// --- StoreItem ---
const StoreItem = React.memo<{
    item: StoreOrderItem;
    // isToggle=true only when the toggle button is used (full complete/uncomplete)
    onQuantityChange: (itemId: number, newQty: number, isPurchased: boolean, isToggle: boolean) => void;
    onViewImage: (url: string, name: string) => void;
}>(({ item, onQuantityChange, onViewImage }) => {
    const isPurchased = item.isPurchased;
    const displayQty = item.quantityPurchased;
    const purchasedByOthers = item.quantityPurchasedByOthers ?? 0;
    const pendingQty = Math.max(0, item.qty - displayQty - purchasedByOthers);
    const maxPurchasable = item.qty - purchasedByOthers;
    const isInProgress = displayQty > 0 && !isPurchased;

    const handleToggle = () => {
        const newQty = isPurchased ? 0 : maxPurchasable;
        onQuantityChange(item.id, newQty, !isPurchased, true);
    };
    const handleIncrement = () => {
        if (displayQty < maxPurchasable) {
            const newQty = displayQty + 1;
            onQuantityChange(item.id, newQty, newQty >= maxPurchasable, false);
        }
    };
    const handleDecrement = () => {
        if (displayQty > 0) {
            const newQty = displayQty - 1;
            onQuantityChange(item.id, newQty, false, false);
        }
    };

    const bgClass = isPurchased
        ? 'bg-primary/5 text-on-surface-variant'
        : isInProgress
            ? 'bg-secondary-container/60'
            : 'bg-white hover:bg-surface-container-low';

    return (
        <div className={`flex items-center justify-between p-3 transition-all duration-300 ${bgClass}`}>
            <div className="flex items-center gap-4 flex-grow">
                <span className="text-primary font-bold text-lg shrink-0">{item.qty}x</span>
                <div>
                    <p className={`font-semibold text-on-background ${isPurchased ? 'line-through opacity-60' : ''}`}>
                        {item.name}
                    </p>
                    <p className="text-xs text-on-surface-variant">{fmt(item.price)} c/u</p>
                    {purchasedByOthers > 0 && !isPurchased && (
                        <p className="text-xs text-amber-600 font-medium mt-0.5">
                            {purchasedByOthers} surtido por otro proveedor · pendiente: {pendingQty}
                        </p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-3">
                {maxPurchasable > 1 && (
                    <div className="flex items-center gap-2">
                        <button onClick={handleDecrement} disabled={displayQty === 0} className="w-7 h-7 flex items-center justify-center rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-40 transition">-</button>
                        <span className="font-mono text-base font-semibold text-on-background w-8 text-center">{displayQty}</span>
                        <button onClick={handleIncrement} disabled={displayQty >= maxPurchasable} className="w-7 h-7 flex items-center justify-center rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-40 transition">+</button>
                    </div>
                )}
                {item.imageUrl && (
                    <button
                        onClick={() => onViewImage(item.imageUrl!, item.name)}
                        className="p-1 text-on-surface-variant hover:text-primary rounded-full transition"
                        aria-label={`Ver imagen de ${item.name}`}
                    >
                        <EyeIcon className="w-5 h-5" />
                    </button>
                )}
                <button
                    onClick={handleToggle}
                    disabled={!isPurchased && maxPurchasable === 0}
                    aria-label={isPurchased ? 'Marcar como pendiente' : 'Marcar como comprado'}
                    className={`relative w-14 h-8 rounded-full flex items-center transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-40 ${isPurchased ? 'bg-success-purchased focus:ring-success-purchased' : 'bg-surface-container-high focus:ring-primary'}`}
                >
                    <span className={`inline-block w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-300 ${isPurchased ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>
    );
});

// --- StoreOrderTicketModal ---
const StoreOrderTicketModal: React.FC<{
    orderId: string;
    authToken: string;
    onAuthError: () => void;
    onClose: () => void;
    onTicketUploaded: () => void;
    onTicketDeleted: () => void;
}> = ({ orderId, authToken, onAuthError, onClose, onTicketUploaded, onTicketDeleted }) => {
    const [tickets, setTickets] = useState<OrderTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [fileError, setFileError] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [viewingContent, setViewingContent] = useState<string | null>(null);
    const [viewingFilename, setViewingFilename] = useState<string | null>(null);
    const [contentCache, setContentCache] = useState<Record<string, string>>({});
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await getStoreOrderTickets(authToken, orderId);
                if (!cancelled) setTickets(data);
            } catch (err) {
                if (err instanceof AuthError) { onAuthError(); return; }
                if (!cancelled) showToast('error', 'Error al cargar tickets');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [orderId]);

    useEffect(() => {
        const toLoad = tickets.filter(t => t.mimeType !== 'application/pdf' && !contentCache[t.id]);
        if (toLoad.length === 0) return;
        let cancelled = false;
        Promise.all(toLoad.map(t => getStoreOrderTicketContent(authToken, orderId, t.id)))
            .then(results => {
                if (cancelled) return;
                setContentCache(prev => {
                    const next = { ...prev };
                    results.forEach(r => { if (r.content) next[r.id] = r.content; });
                    return next;
                });
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [tickets.length]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        if (!TICKET_ALLOWED_TYPES.includes(file.type)) { setFileError('Solo se permiten archivos JPG, PNG o PDF.'); return; }
        if (file.type === 'application/pdf') {
            if (file.size > 1_000_000) { setFileError('El PDF no puede superar 1 MB.'); return; }
            setFileError('');
            const reader = new FileReader();
            reader.onload = ev => handleUpload(file, ev.target?.result as string, 'application/pdf');
            reader.readAsDataURL(file);
            return;
        }
        setFileError('');
        setUploading(true);
        const reader = new FileReader();
        reader.onload = async ev => {
            try {
                const compressed = await compressImage(ev.target?.result as string);
                await handleUpload(file, compressed, 'image/jpeg');
            } catch {
                setFileError('No se pudo procesar la imagen.');
                setUploading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async (file: File, content: string, mimeType: string) => {
        const approxSize = Math.round((content.length * 3) / 4);
        try {
            const ticket = await createStoreOrderTicket(authToken, orderId, {
                filename: mimeType === 'image/jpeg' && !file.name.match(/\.jpe?g$/i) ? file.name.replace(/\.[^.]+$/, '.jpg') : file.name,
                mimeType,
                size: approxSize,
                content,
            });
            setTickets(prev => [ticket, ...prev]);
            onTicketUploaded();
            showToast('success', 'Ticket subido');
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            showToast('error', err instanceof Error ? err.message : 'Error al subir ticket');
        } finally {
            setUploading(false);
        }
    };

    const handleView = async (ticket: OrderTicket) => {
        try {
            const full = await getStoreOrderTicketContent(authToken, orderId, ticket.id);
            if (!full.content) return;
            if (full.mimeType === 'application/pdf') openPdfBlob(full.content, full.filename);
            else { setViewingContent(full.content); setViewingFilename(full.filename); }
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            showToast('error', 'No se pudo cargar el ticket');
        }
    };

    const handleDelete = async () => {
        if (!confirmDeleteId) return;
        setDeleting(true);
        try {
            await deleteStoreOrderTicket(authToken, orderId, confirmDeleteId);
            setTickets(prev => prev.filter(t => t.id !== confirmDeleteId));
            onTicketDeleted();
            showToast('success', 'Ticket eliminado');
            setConfirmDeleteId(null);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            showToast('error', err instanceof Error ? err.message : 'Error al eliminar');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-surface-variant" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-variant">
                        <div>
                            <h3 className="font-epilogue font-bold text-on-background text-lg">Tickets — Tienda</h3>
                            <p className="text-xs text-on-surface-variant">Pedido {orderId}</p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-low text-on-surface-variant transition">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        <div>
                            <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={handleFileChange} />
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                className="w-full border-2 border-dashed border-outline-variant rounded-2xl p-5 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploading
                                    ? <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                                    : <span className="material-symbols-outlined text-on-surface-variant text-4xl">upload_file</span>
                                }
                                <span className="text-sm text-on-surface-variant">{uploading ? 'Subiendo…' : 'Foto o PDF del ticket'}</span>
                            </button>
                            {fileError && (
                                <p className="mt-1.5 text-sm text-error flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">error</span>
                                    {fileError}
                                </p>
                            )}
                        </div>
                        {isLoading && (
                            <div className="flex justify-center py-6">
                                <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                            </div>
                        )}
                        {!isLoading && tickets.length === 0 && (
                            <div className="flex flex-col items-center py-6 text-on-surface-variant text-sm">
                                <span className="material-symbols-outlined text-4xl mb-1 opacity-40">receipt_long</span>
                                No hay tickets para este pedido
                            </div>
                        )}
                        {!isLoading && tickets.length > 0 && (
                            <div className="grid grid-cols-2 gap-3">
                                {tickets.map(ticket => {
                                    const preview = contentCache[ticket.id];
                                    const isPdf = ticket.mimeType === 'application/pdf';
                                    return (
                                        <div key={ticket.id} className="rounded-2xl border border-surface-variant overflow-hidden bg-white hover:border-primary/30 hover:shadow-sm transition-all">
                                            <div
                                                className={`relative w-full h-36 flex items-center justify-center cursor-pointer ${isPdf ? 'bg-red-50' : 'bg-surface-container-low'}`}
                                                onClick={() => {
                                                    if (isPdf) handleView(ticket);
                                                    else if (preview) { setViewingContent(preview); setViewingFilename(ticket.filename); }
                                                    else handleView(ticket);
                                                }}
                                            >
                                                {isPdf ? (
                                                    <div className="flex flex-col items-center gap-1 text-red-400">
                                                        <span className="material-symbols-outlined text-4xl">picture_as_pdf</span>
                                                        <span className="text-xs font-medium">PDF</span>
                                                    </div>
                                                ) : preview ? (
                                                    <img src={preview} alt={ticket.filename} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="animate-pulse w-8 h-8 rounded-full bg-surface-variant" />
                                                )}
                                                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                                    <div className="bg-black/50 rounded-full p-2">
                                                        <span className="material-symbols-outlined text-white text-xl">zoom_in</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between px-3 py-2">
                                                <p className="text-xs text-on-surface-variant">
                                                    {new Date(ticket.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                                <button onClick={() => setConfirmDeleteId(ticket.id)} className="p-1 text-on-surface-variant hover:text-error hover:bg-error-container/30 rounded-full transition">
                                                    <XMarkIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className="px-6 py-4 border-t border-surface-variant flex justify-end">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-on-surface bg-surface-container rounded-full hover:bg-surface-container-high transition">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
            {confirmDeleteId && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-surface-variant">
                        <p className="text-on-surface font-medium mb-4">¿Eliminar este ticket? Esta acción no se puede deshacer.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmDeleteId(null)} disabled={deleting} className="px-4 py-2 text-sm text-on-surface bg-surface-container rounded-full hover:bg-surface-container-high disabled:opacity-50 transition">
                                Cancelar
                            </button>
                            <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-semibold bg-error text-on-error rounded-full hover:bg-error/90 disabled:opacity-50 transition">
                                {deleting ? 'Eliminando…' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {viewingContent && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewingContent(null)}>
                    <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                        <button className="absolute -top-9 right-0 text-white text-sm flex items-center gap-1 hover:opacity-80" onClick={() => setViewingContent(null)}>
                            <XMarkIcon className="w-4 h-4" /> Cerrar
                        </button>
                        <img src={viewingContent} alt={viewingFilename ?? 'Ticket'} className="w-full rounded-xl object-contain max-h-[80vh]" />
                        <p className="text-center text-white/60 text-xs mt-2">{viewingFilename}</p>
                    </div>
                </div>
            )}
        </>
    );
};

// Draft item: existing items can be edited/deleted; new items added but not yet saved
type DraftItem =
    | { kind: 'existing'; item: StoreOrderItem; edited?: { qty: number; price: number; supplierName: string }; deleted?: true }
    | { kind: 'new'; tempId: string; articleId: string; name: string; price: number; qty: number; imageUrl: string | null; supplierName: string; supplierId: string };

function draftTotal(drafts: DraftItem[]): number {
    const seen = new Set<string>();
    let total = 0;
    for (const d of drafts) {
        if (d.kind === 'existing' && d.deleted) continue;
        const articleId = d.kind === 'existing' ? d.item.articleId : d.articleId;
        const price = d.kind === 'existing' ? (d.edited?.price ?? d.item.price) : d.price;
        const qty = d.kind === 'existing' ? (d.edited?.qty ?? d.item.qty) : d.qty;
        if (!seen.has(articleId)) { seen.add(articleId); total += price * qty; }
    }
    return total;
}

// --- EditStoreOrderModal ---
const EditStoreOrderModal: React.FC<{
    order: StoreOrder;
    authToken: string;
    onAuthError: () => void;
    onClose: () => void;
    onOrderChanged: (updated: StoreOrder) => void;
}> = ({ order, authToken, onAuthError, onClose, onOrderChanged }) => {
    const [drafts, setDrafts] = useState<DraftItem[]>(() =>
        order.items.map(item => ({ kind: 'existing' as const, item }))
    );
    const [editingId, setEditingId] = useState<number | string | null>(null);
    const [editForm, setEditForm] = useState({ qty: 1, price: 0, supplierName: '' });
    const [saving, setSaving] = useState(false);

    // Article search
    const [searchQuery, setSearchQuery] = useState('');
    const [articles, setArticles] = useState<Article[]>([]);
    const [supplierNameMap, setSupplierNameMap] = useState<Record<string, string>>({});
    const [articlesLoaded, setArticlesLoaded] = useState(false);
    const [articlesLoading, setArticlesLoading] = useState(false);
    // Selected = article + already-resolved supplier
    const [selected, setSelected] = useState<{ article: Article; supplierId: string; supplierName: string } | null>(null);
    const [addForm, setAddForm] = useState({ qty: 1, price: 0 });

    const visibleDrafts = drafts.filter(d => !(d.kind === 'existing' && d.deleted));
    const previewTotal = draftTotal(drafts);
    const hasChanges = drafts.some(d => d.kind === 'new' || (d.kind === 'existing' && (d.deleted || d.edited)));

    // Group visible drafts by articleId — multi-supplier items show as one row
    const draftGroups = useMemo(() => {
        const map = new Map<string, DraftItem[]>();
        for (const d of visibleDrafts) {
            const articleId = d.kind === 'existing' ? d.item.articleId : d.articleId;
            if (!map.has(articleId)) map.set(articleId, []);
            map.get(articleId)!.push(d);
        }
        // Preserve insertion order; representative = first item in group
        return [...map.entries()].map(([articleId, items]) => ({ articleId, items, rep: items[0] }));
    }, [visibleDrafts]);

    // Expand each article×supplier into its own row — mirrors StoreView logic
    const articleSupplierRows = useMemo(() => {
        const rows: { article: Article; supplierId: string; supplierName: string }[] = [];
        for (const a of articles) {
            if (a.supplierIds.length === 0) {
                rows.push({ article: a, supplierId: '', supplierName: 'Sin proveedor' });
            } else {
                for (const sid of a.supplierIds) {
                    rows.push({ article: a, supplierId: sid, supplierName: supplierNameMap[sid] || sid });
                }
            }
        }
        return rows;
    }, [articles, supplierNameMap]);

    const filteredRows = useMemo(() => {
        if (!searchQuery.trim()) return articleSupplierRows.slice(0, 40);
        const q = searchQuery.toLowerCase();
        return articleSupplierRows.filter(r =>
            r.article.name.toLowerCase().includes(q) ||
            (r.article.sku ?? '').toLowerCase().includes(q) ||
            r.supplierName.toLowerCase().includes(q)
        ).slice(0, 40);
    }, [articleSupplierRows, searchQuery]);

    // Group filtered rows by supplier for display
    const rowsBySupplier = useMemo(() => {
        const map = new Map<string, { supplierName: string; rows: typeof filteredRows }>();
        for (const r of filteredRows) {
            const key = r.supplierId || '__none__';
            if (!map.has(key)) map.set(key, { supplierName: r.supplierName, rows: [] });
            map.get(key)!.rows.push(r);
        }
        return [...map.entries()].sort(([, a], [, b]) => a.supplierName.localeCompare(b.supplierName, 'es'));
    }, [filteredRows]);

    const loadArticles = async () => {
        if (articlesLoaded || articlesLoading) return;
        setArticlesLoading(true);
        try {
            const [data, suppliers] = await Promise.all([getArticles(authToken), getSuppliers(authToken)]);
            setArticles(data);
            setSupplierNameMap(Object.fromEntries(suppliers.map((s: Supplier) => [s.id, s.name])));
            setArticlesLoaded(true);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            showToast('error', 'Error al cargar artículos');
        } finally {
            setArticlesLoading(false);
        }
    };

    // editingId stores articleId of the group being edited
    const startEdit = (group: { articleId: string; items: DraftItem[] }) => {
        const rep = group.items[0];
        setEditingId(group.articleId);
        setEditForm({
            qty: rep.kind === 'existing' ? (rep.edited?.qty ?? rep.item.qty) : rep.qty,
            price: rep.kind === 'existing' ? (rep.edited?.price ?? rep.item.price) : rep.price,
            supplierName: rep.kind === 'existing' ? (rep.edited?.supplierName ?? rep.item.supplierName) : rep.supplierName,
        });
    };

    const confirmEdit = () => {
        setDrafts(prev => prev.map(d => {
            const articleId = d.kind === 'existing' ? d.item.articleId : d.articleId;
            if (articleId !== editingId) return d;
            if (d.kind === 'existing') return { ...d, edited: { qty: editForm.qty, price: editForm.price, supplierName: d.edited?.supplierName ?? d.item.supplierName } };
            return { ...d, qty: editForm.qty, price: editForm.price };
        }));
        setEditingId(null);
    };

    const markDelete = (group: { articleId: string; items: DraftItem[] }) => {
        setDrafts(prev => prev
            .map(d => {
                const articleId = d.kind === 'existing' ? d.item.articleId : d.articleId;
                if (articleId !== group.articleId) return d;
                if (d.kind === 'existing') return { ...d, deleted: true as const };
                return null;
            })
            .filter((d): d is DraftItem => d !== null)
        );
    };

    const handleSelectRow = (row: { article: Article; supplierId: string; supplierName: string }) => {
        setSelected(row);
        setAddForm({ qty: 1, price: row.article.price });
        setSearchQuery('');
    };

    const handleAddToDraft = () => {
        if (!selected) return;
        const article = selected.article;
        const sids = article.supplierIds;
        const targetsIds = sids.length > 1 ? sids : [selected.supplierId];

        setDrafts(prev => {
            let next = [...prev];
            for (const sid of targetsIds) {
                const supplierName = sids.length > 1 ? (supplierNameMap[sid] || sid) : selected.supplierName;
                // Find existing non-deleted draft for this article+supplier
                const existingIdx = next.findIndex(d => {
                    if (d.kind === 'existing' && !d.deleted)
                        return d.item.articleId === article.id && (d.item.supplierId ?? '') === sid;
                    if (d.kind === 'new')
                        return d.articleId === article.id && d.supplierId === sid;
                    return false;
                });
                if (existingIdx !== -1) {
                    // Merge: add qty to existing draft
                    const d = next[existingIdx];
                    if (d.kind === 'existing') {
                        const currentQty = d.edited?.qty ?? d.item.qty;
                        next[existingIdx] = { ...d, edited: { qty: currentQty + addForm.qty, price: d.edited?.price ?? d.item.price, supplierName: d.edited?.supplierName ?? d.item.supplierName } };
                    } else {
                        next[existingIdx] = { ...d, qty: d.qty + addForm.qty };
                    }
                } else {
                    next.push({
                        kind: 'new',
                        tempId: `new-${Date.now()}-${sid}`,
                        articleId: article.id,
                        name: article.name,
                        price: addForm.price,
                        qty: addForm.qty,
                        imageUrl: article.image,
                        supplierName,
                        supplierId: sid,
                    });
                }
            }
            return next;
        });
        setSelected(null);
        setAddForm({ qty: 1, price: 0 });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const ops: Promise<unknown>[] = [];
            for (const d of drafts) {
                if (d.kind === 'existing' && d.deleted) {
                    ops.push(deleteStoreOrderItem(authToken, order.id, d.item.id));
                } else if (d.kind === 'existing' && d.edited) {
                    ops.push(editStoreOrderItem(authToken, order.id, d.item.id, d.edited));
                } else if (d.kind === 'new') {
                    ops.push(addStoreOrderItem(authToken, order.id, {
                        articleId: d.articleId, name: d.name, price: d.price, qty: d.qty,
                        imageUrl: null, supplierName: d.supplierName, supplierId: d.supplierId || undefined,
                    }));
                }
            }
            await Promise.all(ops);

            // Refetch the order's real items after all mutations
            const freshOrders = await (async () => {
                const { getStoreOrders: fetch } = await import('../../services/api');
                return fetch(authToken);
            })();
            const fresh = freshOrders.find(o => o.id === order.id);
            if (fresh) onOrderChanged(fresh);

            showToast('success', 'Pedido actualizado');
            onClose();
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            showToast('error', 'Error al guardar los cambios');
        } finally {
            setSaving(false);
        }
    };

    const getDraftKey = (d: DraftItem) => d.kind === 'existing' ? `e-${d.item.id}` : d.tempId;
    const getDraftName = (d: DraftItem) => d.kind === 'existing' ? d.item.name : d.name;
    const getDraftQty = (d: DraftItem) => d.kind === 'existing' ? (d.edited?.qty ?? d.item.qty) : d.qty;
    const getDraftPrice = (d: DraftItem) => d.kind === 'existing' ? (d.edited?.price ?? d.item.price) : d.price;
    const getDraftSupplier = (d: DraftItem) => d.kind === 'existing' ? (d.edited?.supplierName ?? d.item.supplierName) : d.supplierName;
    const getDraftImage = (d: DraftItem) => d.kind === 'existing' ? (d.item.imageUrl ?? null) : d.imageUrl;
    const isNew = (d: DraftItem) => d.kind === 'new';
    const isEdited = (d: DraftItem) => d.kind === 'existing' && !!d.edited;

    return (
        <Modal
            open
            onClose={onClose}
            title={
                <div>
                    <span className="font-epilogue font-bold text-on-background">Editar Pedido</span>
                    <span className="ml-2 text-primary font-mono">{order.id}</span>
                </div>
            }
            maxWidth="max-w-2xl"
            footer={
                <>
                    <Button variant="neutral" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        icon="save"
                    >
                        {saving ? 'Guardando…' : 'Guardar cambios'}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-0">
                {/* Panel superior: lista de items */}
                <div className="p-5 border-b border-surface-variant">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Artículos del pedido</h3>
                        <div className="flex items-center gap-2">
                            {hasChanges && (
                                <span className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                    Cambios sin guardar
                                </span>
                            )}
                            <span className="text-sm font-bold text-on-background">
                                Total: <span className={hasChanges ? 'text-primary' : ''}>{fmt(previewTotal)}</span>
                            </span>
                        </div>
                    </div>

                    <div className="rounded-xl border border-surface-variant overflow-hidden divide-y divide-surface-variant">
                        {draftGroups.length === 0 && (
                            <div className="flex flex-col items-center py-8 text-on-surface-variant">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-30">shopping_bag</span>
                                <p className="text-sm">Sin artículos</p>
                            </div>
                        )}
                        {draftGroups.map(group => {
                            const { articleId, items, rep } = group;
                            const isEditing = editingId === articleId;
                            const img = getDraftImage(rep);
                            const name = getDraftName(rep);
                            const qty = getDraftQty(rep);
                            const price = getDraftPrice(rep);
                            const isMultiSupplier = items.length > 1;
                            const supplierNames = items.map(d => getDraftSupplier(d)).filter(s => s && s !== 'Sin proveedor');
                            const hasNew = items.some(d => isNew(d));
                            const hasEdited = items.some(d => isEdited(d));

                            return (
                                <div key={articleId} className={`transition-colors ${hasNew ? 'bg-primary/5' : hasEdited ? 'bg-amber-50/60' : 'bg-white'}`}>
                                    {isEditing ? (
                                        <div className="p-3 space-y-3">
                                            <div className="flex items-center gap-2">
                                                {img ? <img src={img} alt={name} className="w-8 h-8 rounded-lg object-cover shrink-0" /> : <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-xs font-bold text-on-surface-variant">{name.charAt(0)}</div>}
                                                <p className="text-sm font-semibold text-on-background">{name}</p>
                                                {isMultiSupplier && <span className="text-[10px] text-on-surface-variant">· todos los proveedores</span>}
                                            </div>
                                            <div className="flex flex-col gap-1 max-w-[160px]">
                                                <label className="text-xs font-semibold text-on-surface-variant">Cantidad</label>
                                                <Input type="number" min={1} value={editForm.qty} onChange={e => setEditForm(f => ({ ...f, qty: parseInt(e.target.value) || 1 }))} className="w-full" />
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" icon="check" onClick={confirmEdit}>Confirmar</Button>
                                                <Button size="sm" variant="neutral" onClick={() => setEditingId(null)}>Cancelar</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 px-3 py-2.5">
                                            {img ? (
                                                <img src={img} alt={name} className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-sm" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0 text-sm font-bold text-on-surface-variant">
                                                    {name.charAt(0)}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-semibold text-on-background truncate">{name}</p>
                                                    {hasNew && <span className="text-[10px] font-bold uppercase bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">Nuevo</span>}
                                                    {hasEdited && <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Editado</span>}
                                                </div>
                                                <p className="text-xs text-on-surface-variant mt-0.5">
                                                    <span className="font-semibold text-on-surface">{qty}×</span> {fmt(price)} c/u
                                                    {supplierNames.length > 0 && <span className="ml-1">· {supplierNames.join(', ')}</span>}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <span className="text-sm font-bold text-on-background mr-2">{fmt(qty * price)}</span>
                                                <button
                                                    onClick={() => startEdit(group)}
                                                    disabled={editingId !== null}
                                                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition disabled:opacity-30"
                                                    title="Editar"
                                                >
                                                    <span className="material-symbols-outlined text-[18px] leading-none">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => markDelete(group)}
                                                    disabled={editingId !== null}
                                                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/30 transition disabled:opacity-30"
                                                    title="Eliminar"
                                                >
                                                    <XMarkIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Panel inferior: agregar artículo */}
                <div className="p-5 bg-surface-container-low">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">Agregar artículo</h3>

                    {selected ? (
                        <div className="bg-white border border-primary/20 rounded-xl p-4 space-y-3 shadow-sm">
                            <div className="flex items-center gap-3">
                                {selected.article.image ? (
                                    <img src={selected.article.image} alt={selected.article.name} className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-sm" />
                                ) : (
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-lg">
                                        {selected.article.name.charAt(0)}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-on-background truncate">{selected.article.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-on-surface-variant">{fmt(selected.article.price)} precio base</span>
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                            <span className="material-symbols-outlined text-[12px] leading-none">storefront</span>
                                            {selected.supplierName}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => setSelected(null)} className="p-1.5 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/20 transition">
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-1 max-w-[160px]">
                                <label className="text-xs font-semibold text-on-surface-variant">Cantidad</label>
                                <Input type="number" min={1} value={addForm.qty} onChange={e => setAddForm(f => ({ ...f, qty: parseInt(e.target.value) || 1 }))} className="w-full" />
                            </div>

                            <Button icon="add_shopping_cart" onClick={handleAddToDraft} className="w-full">
                                Agregar al pedido
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none">search</span>
                                <Input
                                    placeholder="Buscar por nombre, SKU o proveedor…"
                                    value={searchQuery}
                                    onChange={e => { setSearchQuery(e.target.value); loadArticles(); }}
                                    onFocus={loadArticles}
                                    className="w-full pl-10"
                                />
                            </div>
                            {articlesLoading && (
                                <div className="flex justify-center py-6">
                                    <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                                </div>
                            )}
                            {articlesLoaded && rowsBySupplier.length > 0 && (
                                <div className="max-h-56 overflow-y-auto space-y-3 pr-1">
                                    {rowsBySupplier.map(([suppKey, { supplierName, rows }]) => (
                                        <div key={suppKey}>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="material-symbols-outlined text-[14px] text-on-surface-variant leading-none">storefront</span>
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{supplierName}</span>
                                                <div className="flex-1 h-px bg-surface-variant" />
                                            </div>
                                            <div className="grid grid-cols-1 gap-1">
                                                {rows.map(r => (
                                                    <button
                                                        key={`${r.article.id}-${r.supplierId}`}
                                                        onClick={() => handleSelectRow(r)}
                                                        className="flex items-center gap-3 p-2 rounded-xl border border-surface-variant bg-white hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm transition-all text-left group"
                                                    >
                                                        {r.article.image ? (
                                                            <img src={r.article.image} alt={r.article.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                                                        ) : (
                                                            <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0 text-on-surface-variant text-xs font-bold group-hover:bg-primary/10 group-hover:text-primary transition">
                                                                {r.article.name.charAt(0)}
                                                            </div>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-semibold text-on-background truncate">{r.article.name}</p>
                                                        </div>
                                                        <span className="text-sm font-bold text-primary shrink-0">{fmt(r.article.price)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {articlesLoaded && searchQuery && rowsBySupplier.length === 0 && (
                                <div className="text-center py-6 text-on-surface-variant">
                                    <span className="material-symbols-outlined text-3xl mb-1 opacity-30">search_off</span>
                                    <p className="text-sm">Sin resultados para "{searchQuery}"</p>
                                </div>
                            )}
                            {!articlesLoaded && !articlesLoading && (
                                <p className="text-center text-sm text-on-surface-variant py-2 opacity-60">Escribe para buscar artículos</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

// --- StoreOrderCard ---
const StoreOrderCard: React.FC<{
    order: StoreOrder;
    authToken: string;
    onAuthError: () => void;
    onComplete: (id: string) => void;
    onItemUpdate: (orderId: string, itemId: number, isPurchased: boolean, quantityPurchased: number, quantityPurchasedByOthers?: number) => void;
    onViewImage: (url: string, name: string) => void;
    onOrderEdited: (updated: StoreOrder) => void;
}> = ({ order, authToken, onAuthError, onComplete, onItemUpdate, onViewImage, onOrderEdited }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [ticketModal, setTicketModal] = useState(false);
    const [editModal, setEditModal] = useState(false);
    const [ticketCount, setTicketCount] = useState(0);
    const isPending = order.status === 'pending';
    const date = new Date(order.dateCreated).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    // Deduplicate by articleId — multi-supplier items count as one article
    const uniqueArticleIds = new Set(order.items.map(i => i.articleId));
    const purchasedArticleIds = new Set(order.items.filter(i => i.isPurchased).map(i => i.articleId));
    const purchasedCount = purchasedArticleIds.size;
    const allPurchased = purchasedCount === uniqueArticleIds.size;
    // Recalculate total deduplicating multi-supplier items
    const displayTotal = (() => {
        const seen = new Set<string>();
        return order.items.reduce((s, i) => {
            if (seen.has(i.articleId)) return s;
            seen.add(i.articleId);
            return s + i.price * i.qty;
        }, 0);
    })();

    const statusColor = isPending ? 'bg-secondary-container/60 text-on-secondary-container' : 'bg-success-purchased/15 text-success-purchased';
    const statusLabel = isPending ? 'Pendiente' : 'Completado';

    const handleQuantityChange = useCallback((itemId: number, newQty: number, isPurchased: boolean, isToggle: boolean) => {
        onItemUpdate(order.id, itemId, isPurchased, newQty);
        // Only send isPurchased when it's a full toggle — not during partial increments
        const patch = isToggle
            ? { isPurchased, quantityPurchased: newQty }
            : { quantityPurchased: newQty };
        updateStoreItemStatus(authToken, order.id, itemId, patch)
            .then(({ item: updated, siblingUpdates }) => {
                onItemUpdate(order.id, itemId, updated.isPurchased, updated.quantityPurchased, updated.quantityPurchasedByOthers);
                for (const sibling of siblingUpdates) {
                    onItemUpdate(order.id, sibling.id, sibling.isPurchased, sibling.quantityPurchased, sibling.quantityPurchasedByOthers);
                }
            })
            .catch(err => {
                if (err instanceof AuthError) onAuthError();
                else showToast('error', 'Error al guardar progreso');
            });
    }, [authToken, order.id, onItemUpdate, onAuthError]);

    return (
        <article aria-labelledby={`store-order-heading-${order.id}`} className="bg-white rounded-2xl shadow-sm border border-surface-variant overflow-hidden">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full p-4 bg-surface-container-low border-b border-surface-variant flex justify-between items-center flex-wrap gap-3 hover:bg-surface-container transition-colors ${isExpanded ? '' : 'border-b-0'}`}
            >
                <div className="flex items-center gap-3">
                    <ChevronDownIcon className={`w-5 h-5 text-on-surface-variant transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    <div>
                        <h2 id={`store-order-heading-${order.id}`} className="font-epilogue text-lg md:text-xl font-bold text-on-background text-left">
                            Pedido {order.id}
                        </h2>
                        <p className="text-sm text-on-surface-variant mt-0.5 text-left">
                            {order.customerName} · {order.customerPhone} · {date}
                        </p>
                        {order.notes && (
                            <p className="text-xs text-on-surface-variant/70 italic mt-0.5 text-left">"{order.notes}"</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold text-on-background">{fmt(displayTotal)}</span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full bg-surface-container-high text-on-surface-variant`}>
                        {purchasedCount}/{uniqueArticleIds.size}
                    </span>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusColor}`}>
                        {statusLabel}
                    </span>
                    {isPending && (
                        <button
                            onClick={e => { e.stopPropagation(); onComplete(order.id); }}
                            disabled={!allPurchased}
                            className="px-3 py-1.5 text-sm font-semibold bg-primary text-on-primary rounded-full hover:bg-primary-container shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Completar Pedido
                        </button>
                    )}
                </div>
            </button>

            {isExpanded && (
                <div className="p-4 space-y-3">
                    <div className="flex justify-end gap-2">
                        {isPending && (
                            <button
                                onClick={() => setEditModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition"
                            >
                                <span className="material-symbols-outlined text-sm">edit</span>
                                Editar
                            </button>
                        )}
                        <button
                            onClick={() => setTicketModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition"
                        >
                            <span className="material-symbols-outlined text-sm">receipt_long</span>
                            Tickets{ticketCount > 0 ? ` (${ticketCount})` : ''}
                        </button>
                    </div>
                    {Object.entries(order.items.reduce<Record<string, StoreOrderItem[]>>((acc, item) => {
                        const key = item.supplierName || 'Sin proveedor';
                        (acc[key] ||= []).push(item);
                        return acc;
                    }, {}))
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([supplierName, items]) => {
                            const purchased = items.filter(i => i.isPurchased).length;
                            const groupTotal = items.reduce((s, i) => s + i.price * i.qty, 0);
                            const complete = purchased === items.length;
                            return (
                                <div key={supplierName} className="rounded-xl border border-surface-variant overflow-hidden">
                                    <div className={`px-4 py-2 border-b flex items-center justify-between ${complete ? 'bg-primary/8 border-primary/20' : 'bg-surface-container-low border-surface-variant'}`}>
                                        <h3 className="text-base font-semibold text-on-background">{supplierName}</h3>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-bold ${complete ? 'text-primary' : 'text-on-surface'}`}>{fmt(groupTotal)}</span>
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${complete ? 'bg-primary/15 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                                                {purchased} / {items.length}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-surface-variant">
                                        {items.map(item => (
                                            <StoreItem
                                                key={item.id}
                                                item={item}
                                                onQuantityChange={handleQuantityChange}
                                                onViewImage={onViewImage}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}

            {ticketModal && (
                <StoreOrderTicketModal
                    orderId={order.id}
                    authToken={authToken}
                    onAuthError={onAuthError}
                    onClose={() => setTicketModal(false)}
                    onTicketUploaded={() => setTicketCount(c => c + 1)}
                    onTicketDeleted={() => setTicketCount(c => Math.max(0, c - 1))}
                />
            )}
            {editModal && (
                <EditStoreOrderModal
                    order={order}
                    authToken={authToken}
                    onAuthError={onAuthError}
                    onClose={() => setEditModal(false)}
                    onOrderChanged={onOrderEdited}
                />
            )}
        </article>
    );
};

// --- OrderItem ---
const OrderItem = React.memo<{
    item: LineItem;
    supplierId: string | null;
    onQuantityChange: (itemId: number, newQuantity: number, supplierId: string | null) => void;
    onViewImage: (imageUrl: string, productName: string) => void;
    onDelete: (itemId: number) => void;
}>(({ item, supplierId, onQuantityChange, onViewImage, onDelete }) => {
    const isPurchased = item.isPurchased;

    // For multi-supplier items: available = total - purchased by OTHER suppliers
    const thisSupplierQty = supplierId ? (item.quantityBySupplier[supplierId] ?? 0) : item.quantityPurchased;
    const otherSuppliersQty = supplierId
        ? Object.entries(item.quantityBySupplier).filter(([id]) => id !== supplierId).reduce((s, [, v]) => s + v, 0)
        : 0;
    const availableForThis = item.quantity - otherSuppliersQty;
    const displayQty = supplierId ? thisSupplierQty : item.quantityPurchased;
    const isInProgress = displayQty > 0 && !isPurchased;

    const unitPrice = item.quantity > 0 ? parseFloat(item.total) / item.quantity : 0;

    const handleToggle = () => {
        const newQty = isPurchased ? 0 : availableForThis;
        onQuantityChange(item.id, newQty, supplierId);
    };
    const handleIncrement = () => {
        if (displayQty < availableForThis) onQuantityChange(item.id, displayQty + 1, supplierId);
    };
    const handleDecrement = () => {
        if (displayQty > 0) onQuantityChange(item.id, displayQty - 1, supplierId);
    };
    const handleDelete = () => { if (window.confirm(`¿Eliminar "${item.name}" de este pedido?`)) onDelete(item.id); };

    const bgClass = isPurchased ? 'bg-primary/5 text-on-surface-variant' : isInProgress ? 'bg-secondary-container/60' : 'bg-white hover:bg-surface-container-low';

    return (
        <div className={`flex items-center justify-between p-3 transition-all duration-300 ${bgClass}`}>
            <div className="flex items-center gap-4 flex-grow">
                <span className="text-primary font-bold text-lg shrink-0">{item.quantity}x</span>
                <div>
                    <p className={`font-semibold text-on-background ${isPurchased ? 'line-through opacity-60' : ''}`}>
                        {item.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        {item.sku && <span>SKU: {item.sku}</span>}
                        {item.sku && <span>&bull;</span>}
                        <span className="font-semibold text-on-surface">{fmt(unitPrice)} c/u</span>
                        {supplierId && availableForThis < item.quantity && (
                            <span className="text-primary font-semibold">&bull; Disponibles aquí: {availableForThis}</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {item.quantity > 1 && (
                    <div className="flex items-center gap-2">
                        <button onClick={handleDecrement} disabled={displayQty === 0} className="w-7 h-7 flex items-center justify-center rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-40 transition">-</button>
                        <span className="font-mono text-base font-semibold text-on-background w-8 text-center">{displayQty}</span>
                        <button onClick={handleIncrement} disabled={displayQty >= availableForThis} className="w-7 h-7 flex items-center justify-center rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-40 transition">+</button>
                    </div>
                )}
                {item.imageUrl && (
                    <button
                        onClick={() => onViewImage(item.imageUrl!, item.name)}
                        className="p-1 text-on-surface-variant hover:text-primary rounded-full transition"
                        aria-label={`Ver imagen de ${item.name}`}
                    >
                        <EyeIcon className="w-5 h-5" />
                    </button>
                )}

                <button
                    onClick={handleToggle}
                    aria-label={isPurchased ? 'Marcar como pendiente' : 'Marcar como comprado'}
                    className={`relative w-14 h-8 rounded-full flex items-center transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${isPurchased ? 'bg-success-purchased focus:ring-success-purchased' : 'bg-surface-container-high focus:ring-primary'}`}
                >
                    <span className={`inline-block w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-300 ${isPurchased ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>
    );
});

// --- Helpers tickets ---
function formatTicketSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function openPdfBlob(dataUrl: string, filename: string) {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const TICKET_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_IMAGE_BYTES = 950_000;

function compressImage(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const MAX_DIM = 1920;
            const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas no disponible')); return; }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            let quality = 0.85;
            let result = canvas.toDataURL('image/jpeg', quality);
            while (Math.round((result.length * 3) / 4) > MAX_IMAGE_BYTES && quality > 0.2) {
                quality = Math.round((quality - 0.1) * 10) / 10;
                result = canvas.toDataURL('image/jpeg', quality);
            }
            resolve(result);
        };
        img.onerror = () => reject(new Error('No se pudo leer la imagen'));
        img.src = dataUrl;
    });
}

// --- Modal de tickets ---
const OrderTicketModal: React.FC<{
    orderId: number;
    supplierName: string;
    authToken: string;
    onAuthError: () => void;
    onClose: () => void;
    onTicketUploaded: () => void;
    onTicketDeleted: () => void;
}> = ({ orderId, supplierName, authToken, onAuthError, onClose, onTicketUploaded, onTicketDeleted }) => {
    const [tickets, setTickets] = useState<OrderTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [fileError, setFileError] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [viewingContent, setViewingContent] = useState<string | null>(null);
    const [viewingFilename, setViewingFilename] = useState<string | null>(null);
    const [contentCache, setContentCache] = useState<Record<string, string>>({});
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await getOrderTickets(authToken, orderId, supplierName);
                if (!cancelled) setTickets(data);
            } catch (err) {
                if (err instanceof AuthError) { onAuthError(); return; }
                if (!cancelled) showToast('error', 'Error al cargar tickets');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [orderId, supplierName]);

    // Load previews for image tickets
    useEffect(() => {
        const toLoad = tickets.filter(t => t.mimeType !== 'application/pdf' && !contentCache[t.id]);
        if (toLoad.length === 0) return;
        let cancelled = false;
        Promise.all(toLoad.map(t => getOrderTicketContent(authToken, orderId, t.id)))
            .then(results => {
                if (cancelled) return;
                setContentCache(prev => {
                    const next = { ...prev };
                    results.forEach(r => { if (r.content) next[r.id] = r.content; });
                    return next;
                });
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [tickets.length]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        if (!TICKET_ALLOWED_TYPES.includes(file.type)) { setFileError('Solo se permiten archivos JPG, PNG o PDF.'); return; }
        if (file.type === 'application/pdf') {
            if (file.size > 1_000_000) { setFileError('El PDF no puede superar 1 MB.'); return; }
            setFileError('');
            const reader = new FileReader();
            reader.onload = ev => handleUpload(file, ev.target?.result as string, 'application/pdf');
            reader.readAsDataURL(file);
            return;
        }
        setFileError('');
        setUploading(true);
        const reader = new FileReader();
        reader.onload = async ev => {
            try {
                const compressed = await compressImage(ev.target?.result as string);
                await handleUpload(file, compressed, 'image/jpeg');
            } catch {
                setFileError('No se pudo procesar la imagen.');
                setUploading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async (file: File, content: string, mimeType: string) => {
        const approxSize = Math.round((content.length * 3) / 4);
        try {
            const ticket = await createOrderTicket(authToken, orderId, {
                supplierName,
                filename: mimeType === 'image/jpeg' && !file.name.match(/\.jpe?g$/i) ? file.name.replace(/\.[^.]+$/, '.jpg') : file.name,
                mimeType,
                size: approxSize,
                content,
            });
            setTickets(prev => [ticket, ...prev]);
            onTicketUploaded();
            showToast('success', 'Ticket subido');
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            showToast('error', err instanceof Error ? err.message : 'Error al subir ticket');
        } finally {
            setUploading(false);
        }
    };

    const handleView = async (ticket: OrderTicket) => {
        try {
            const full = await getOrderTicketContent(authToken, orderId, ticket.id);
            if (!full.content) return;
            if (full.mimeType === 'application/pdf') openPdfBlob(full.content, full.filename);
            else { setViewingContent(full.content); setViewingFilename(full.filename); }
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            showToast('error', 'No se pudo cargar el ticket');
        }
    };

    const handleDelete = async () => {
        if (!confirmDeleteId) return;
        setDeleting(true);
        try {
            await deleteOrderTicket(authToken, orderId, confirmDeleteId);
            setTickets(prev => prev.filter(t => t.id !== confirmDeleteId));
            onTicketDeleted();
            showToast('success', 'Ticket eliminado');
            setConfirmDeleteId(null);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            showToast('error', err instanceof Error ? err.message : 'Error al eliminar');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-surface-variant" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-variant">
                        <div>
                            <h3 className="font-epilogue font-bold text-on-background text-lg">Tickets — {supplierName}</h3>
                            <p className="text-xs text-on-surface-variant">Pedido #{orderId}</p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-low text-on-surface-variant transition">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        <div>
                            <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={handleFileChange} />
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                className="w-full border-2 border-dashed border-outline-variant rounded-2xl p-5 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploading
                                    ? <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                                    : <span className="material-symbols-outlined text-on-surface-variant text-4xl">upload_file</span>
                                }
                                <span className="text-sm text-on-surface-variant">{uploading ? 'Subiendo…' : 'Foto o PDF del ticket'}</span>
                            </button>
                            {fileError && (
                                <p className="mt-1.5 text-sm text-error flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">error</span>
                                    {fileError}
                                </p>
                            )}
                        </div>

                        {isLoading && (
                            <div className="flex justify-center py-6">
                                <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                            </div>
                        )}
                        {!isLoading && tickets.length === 0 && (
                            <div className="flex flex-col items-center py-6 text-on-surface-variant text-sm">
                                <span className="material-symbols-outlined text-4xl mb-1 opacity-40">receipt_long</span>
                                No hay tickets para este proveedor
                            </div>
                        )}
                        {!isLoading && tickets.length > 0 && (
                            <div className="grid grid-cols-2 gap-3">
                                {tickets.map(ticket => {
                                    const preview = contentCache[ticket.id];
                                    const isPdf = ticket.mimeType === 'application/pdf';
                                    return (
                                        <div key={ticket.id} className="rounded-2xl border border-surface-variant overflow-hidden bg-white hover:border-primary/30 hover:shadow-sm transition-all">
                                            {/* Preview area */}
                                            <div
                                                className={`relative w-full h-36 flex items-center justify-center cursor-pointer ${isPdf ? 'bg-red-50' : 'bg-surface-container-low'}`}
                                                onClick={() => {
                                                    if (isPdf) handleView(ticket);
                                                    else if (preview) { setViewingContent(preview); setViewingFilename(ticket.filename); }
                                                    else handleView(ticket);
                                                }}
                                            >
                                                {isPdf ? (
                                                    <div className="flex flex-col items-center gap-1 text-red-400">
                                                        <span className="material-symbols-outlined text-4xl">picture_as_pdf</span>
                                                        <span className="text-xs font-medium">PDF</span>
                                                    </div>
                                                ) : preview ? (
                                                    <img src={preview} alt={ticket.filename} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="animate-pulse w-8 h-8 rounded-full bg-surface-variant" />
                                                )}
                                                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                                    <div className="bg-black/50 rounded-full p-2">
                                                        <span className="material-symbols-outlined text-white text-xl">zoom_in</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Footer */}
                                            <div className="flex items-center justify-between px-3 py-2">
                                                <p className="text-xs text-on-surface-variant">
                                                    {new Date(ticket.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                                <button onClick={() => setConfirmDeleteId(ticket.id)} className="p-1 text-on-surface-variant hover:text-error hover:bg-error-container/30 rounded-full transition">
                                                    <XMarkIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 border-t border-surface-variant flex justify-end">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-on-surface bg-surface-container rounded-full hover:bg-surface-container-high transition">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmar eliminar */}
            {confirmDeleteId && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-surface-variant">
                        <p className="text-on-surface font-medium mb-4">¿Eliminar este ticket? Esta acción no se puede deshacer.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmDeleteId(null)} disabled={deleting} className="px-4 py-2 text-sm text-on-surface bg-surface-container rounded-full hover:bg-surface-container-high disabled:opacity-50 transition">
                                Cancelar
                            </button>
                            <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-semibold bg-error text-on-error rounded-full hover:bg-error/90 disabled:opacity-50 transition">
                                {deleting ? 'Eliminando…' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Visor de imagen */}
            {viewingContent && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewingContent(null)}>
                    <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                        <button className="absolute -top-9 right-0 text-white text-sm flex items-center gap-1 hover:opacity-80" onClick={() => setViewingContent(null)}>
                            <XMarkIcon className="w-4 h-4" /> Cerrar
                        </button>
                        <img src={viewingContent} alt={viewingFilename ?? 'Ticket'} className="w-full rounded-xl object-contain max-h-[80vh]" />
                        <p className="text-center text-white/60 text-xs mt-2">{viewingFilename}</p>
                    </div>
                </div>
            )}
        </>
    );
};

// --- CategorySection ---
const CategorySection = React.memo<{
    category: string;
    supplierId: string | null;
    locations: string[];
    items: LineItem[];
    orderId: number;
    ticketCount: number;
    authToken: string;
    onAuthError: () => void;
    onTicketUploaded: (supplierName: string) => void;
    onQuantityChange: (itemId: number, newQuantity: number, supplierId: string | null) => void;
    onViewImage: (imageUrl: string, productName: string) => void;
    onDelete: (itemId: number) => void;
}>(({ category, supplierId, locations, items, orderId, ticketCount, authToken, onAuthError, onTicketUploaded, onQuantityChange, onViewImage, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showTickets, setShowTickets] = useState(false);

    const purchasedCount = items.filter(item => item.isPurchased).length;
    const totalCount = items.length;
    const isComplete = purchasedCount === totalCount;
    const categoryTotal = items.reduce((sum, item) => sum + parseFloat(item.total), 0);

    return (
        <>
            <section aria-labelledby={`category-heading-${category}`}>
                <div className="rounded-xl border border-surface-variant overflow-hidden">
                    <div className={`p-3 flex justify-between items-center transition-colors border-b ${isComplete ? 'bg-primary/8 border-primary/20' : 'bg-surface-container-low border-surface-variant'} ${isExpanded ? '' : 'border-b-0'}`}>
                        <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-2 flex-1 text-left">
                            <ChevronDownIcon className={`w-5 h-5 text-on-surface-variant transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            <h3 id={`category-heading-${category}`} className="text-base font-semibold text-on-background">{category}</h3>
                            {locations.length > 0 && locations[0].startsWith('http') && (
                                <a
                                    href={locations[0]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    title="Ver ubicación"
                                    className="ml-1 text-on-surface-variant hover:text-primary transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px] leading-none">location_on</span>
                                </a>
                            )}
                        </button>

                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${isComplete ? 'text-primary' : 'text-on-surface'}`}>
                                {fmt(categoryTotal)}
                            </span>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isComplete ? 'bg-primary/15 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                                {purchasedCount} / {totalCount}
                            </span>
                            <button
                                type="button"
                                onClick={e => { e.stopPropagation(); setShowTickets(true); }}
                                title="Tickets de compra"
                                className="relative p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                                <span className={`material-symbols-outlined text-xl leading-none ${ticketCount > 0 ? 'text-primary' : ''}`}>receipt_long</span>
                                {ticketCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-primary text-on-primary text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                                        {ticketCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {isExpanded && (
                        <div className="divide-y divide-surface-variant">
                            {items.map(item => (
                                <OrderItem key={item.id} item={item} supplierId={supplierId} onQuantityChange={onQuantityChange} onViewImage={onViewImage} onDelete={onDelete} />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {showTickets && (
                <OrderTicketModal
                    orderId={orderId}
                    supplierName={category}
                    authToken={authToken}
                    onAuthError={onAuthError}
                    onClose={() => setShowTickets(false)}
                    onTicketUploaded={() => onTicketUploaded(category)}
                    onTicketDeleted={() => onTicketUploaded(category)}
                />
            )}
        </>
    );
});

interface SupplierGroup {
    name: string;
    supplierId: string | null;
    items: LineItem[];
}

// --- OrderCard ---
const OrderCard = React.memo<{
    order: Order;
    viewMode: OrderStatusType;
    completingOrderId: number | null;
    authToken: string;
    onAuthError: () => void;
    onQuantityChange: (itemId: number, newQuantity: number, supplierId: string | null) => void;
    onCompleteOrder: (orderId: number) => void;
    onViewImage: (imageUrl: string, productName: string) => void;
    onDelete: (itemId: number) => void;
    supplierLocations: Record<string, string[]>;
}>(({ order, viewMode, completingOrderId, authToken, onAuthError, onQuantityChange, onCompleteOrder, onViewImage, onDelete, supplierLocations }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [ticketCounts, setTicketCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!isExpanded) return;
        let cancelled = false;
        getOrderTicketCounts(authToken, order.id)
            .then(counts => { if (!cancelled) setTicketCounts(counts); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [isExpanded, order.id, authToken]);

    const handleTicketChange = useCallback((_supplierName: string) => {
        getOrderTicketCounts(authToken, order.id)
            .then(counts => setTicketCounts(counts))
            .catch(() => {});
    }, [authToken, order.id]);

    // Build supplier groups: items with PlantArte suppliers appear once per supplier.
    // Items without PlantArte suppliers fall back to category grouping.
    const supplierGroups = React.useMemo<SupplierGroup[]>(() => {
        const map = new Map<string, SupplierGroup>();
        for (const item of order.lineItems) {
            if (item.suppliers && item.suppliers.length > 0) {
                for (const sup of item.suppliers) {
                    const key = `sup:${sup.id}`;
                    if (!map.has(key)) map.set(key, { name: sup.name, supplierId: sup.id, items: [] });
                    map.get(key)!.items.push(item);
                }
            } else {
                const cat = item.category || 'Productos';
                const key = `cat:${cat}`;
                if (!map.has(key)) map.set(key, { name: cat, supplierId: null, items: [] });
                map.get(key)!.items.push(item);
            }
        }
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [order.lineItems]);

    const allItemsPurchased = order.lineItems.every(item => item.isPurchased);

    const statusMap: Record<string, string> = { processing: 'En proceso', completed: 'Completado', 'on-hold': 'En espera' };
    const statusColor: Record<string, string> = {
        processing: 'bg-primary/10 text-primary',
        completed: 'bg-success-purchased/15 text-success-purchased',
        'on-hold': 'bg-secondary-container/60 text-on-secondary-container',
    };

    return (
        <article aria-labelledby={`order-heading-${order.id}`} className="bg-white rounded-2xl shadow-sm border border-surface-variant overflow-hidden">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full p-4 bg-surface-container-low border-b border-surface-variant flex justify-between items-center flex-wrap gap-3 hover:bg-surface-container transition-colors ${isExpanded ? '' : 'border-b-0'}`}
            >
                <div className="flex items-center gap-3">
                    <ChevronDownIcon className={`w-5 h-5 text-on-surface-variant transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    <div>
                        <h2 id={`order-heading-${order.id}`} className="font-epilogue text-lg md:text-xl font-bold text-on-background text-left">
                            Pedido #{order.id}
                        </h2>
                        <p className="text-sm text-on-surface-variant mt-0.5 text-left">
                            {order.customer.firstName} {order.customer.lastName} · {new Date(order.dateCreated).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold text-on-background">{fmt(parseFloat(order.total))}</span>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusColor[order.status] ?? 'bg-surface-container-high text-on-surface-variant'}`}>
                        {statusMap[order.status] ?? order.status}
                    </span>
                    {viewMode === 'processing' && (
                        <button
                            onClick={e => { e.stopPropagation(); onCompleteOrder(order.id); }}
                            disabled={!allItemsPurchased || completingOrderId === order.id}
                            className="px-3 py-1.5 text-sm font-semibold bg-primary text-on-primary rounded-full hover:bg-primary-container shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {completingOrderId === order.id ? 'Completando…' : 'Completar Pedido'}
                        </button>
                    )}
                </div>
            </button>

            {isExpanded && (
                <div className="p-4 space-y-3">
                    {supplierGroups.map(group => {
                        const sortedItems = [...group.items].sort((a, b) =>
                            (a.sku || '').localeCompare(b.sku || '', undefined, { numeric: true, sensitivity: 'base' })
                        );
                        return (
                            <CategorySection
                                key={`${group.supplierId ?? 'cat'}:${group.name}`}
                                category={group.name}
                                supplierId={group.supplierId}
                                locations={group.supplierId ? (supplierLocations[group.supplierId] ?? []) : []}
                                items={sortedItems}
                                orderId={order.id}
                                ticketCount={ticketCounts[group.name] ?? 0}
                                authToken={authToken}
                                onAuthError={onAuthError}
                                onTicketUploaded={handleTicketChange}
                                onQuantityChange={onQuantityChange}
                                onViewImage={onViewImage}
                                onDelete={onDelete}
                            />
                        );
                    })}
                </div>
            )}
        </article>
    );
});

// --- COMPONENTE PRINCIPAL ---
const OrdersView: React.FC<OrdersViewProps> = ({ authToken, onAuthError }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tabMode, setTabMode] = useState<TabMode>('processing');
    const viewMode: OrderStatusType = tabMode === 'store' ? 'processing' : tabMode;
    const [storeOrders, setStoreOrders] = useState<StoreOrder[]>([]);
    const [loadingStoreOrders, setLoadingStoreOrders] = useState(false);
    const [completingOrderId, setCompletingOrderId] = useState<number | null>(null);
    const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
    const [modalProductName, setModalProductName] = useState<string | null>(null);
    const [supplierLocations, setSupplierLocations] = useState<Record<string, string[]>>({});

    const handleViewImage = useCallback((imageUrl: string, productName: string) => {
        setModalImageUrl(imageUrl);
        setModalProductName(productName);
    }, []);
    const handleCloseModal = () => { setModalImageUrl(null); setModalProductName(null); };

    useEffect(() => {
        getSuppliers(authToken)
            .then((suppliers: Supplier[]) => {
                const map: Record<string, string[]> = {};
                for (const s of suppliers) map[s.id] = s.locations ?? [];
                setSupplierLocations(map);
            })
            .catch(() => {});
    }, [authToken]);

    const handleCompleteStoreOrder = useCallback(async (orderId: string) => {
        try {
            const updated = await completeStoreOrder(authToken, orderId);
            setStoreOrders(prev => prev.map(o => o.id === orderId ? updated : o));
            showToast('success', `Pedido ${orderId} completado`);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            showToast('error', 'No se pudo completar el pedido');
        }
    }, [authToken, onAuthError]);

    const handleStoreItemUpdate = useCallback((orderId: string, itemId: number, isPurchased: boolean, quantityPurchased: number, quantityPurchasedByOthers?: number) => {
        setStoreOrders(prev => prev.map(o => {
            if (o.id !== orderId) return o;
            // Update the changed item; also refresh siblings' quantityPurchasedByOthers
            const updatedItems = o.items.map(i => {
                if (i.id === itemId) return { ...i, isPurchased, quantityPurchased, quantityPurchasedByOthers: quantityPurchasedByOthers ?? i.quantityPurchasedByOthers };
                // sibling: recalc its quantityPurchasedByOthers if we have the updated value
                if (quantityPurchasedByOthers !== undefined) {
                    const changedItem = o.items.find(x => x.id === itemId);
                    if (changedItem && i.articleId === changedItem.articleId && i.orderId === changedItem.orderId) {
                        // sibling's others = total purchased by all - sibling's own
                        const ownQty = i.quantityPurchased;
                        const totalByGroup = quantityPurchased + quantityPurchasedByOthers;
                        return { ...i, quantityPurchasedByOthers: totalByGroup - ownQty };
                    }
                }
                return i;
            });
            return { ...o, items: updatedItems };
        }));
    }, []);

    const handleStoreOrderEdited = useCallback((updatedOrder: StoreOrder) => {
        setStoreOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    }, []);

    useEffect(() => {
        if (tabMode !== 'store') return;
        let cancelled = false;
        const load = async () => {
            setLoadingStoreOrders(true);
            try {
                const data = await getStoreOrders(authToken);
                if (!cancelled) setStoreOrders(data);
            } catch (err) {
                if (err instanceof AuthError) { onAuthError(); return; }
                if (!cancelled) showToast('error', 'Error al cargar pedidos de Tienda');
            } finally {
                if (!cancelled) setLoadingStoreOrders(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [tabMode, authToken, onAuthError]);

    useEffect(() => {
        if (tabMode === 'store') return;
        const fetchOrders = async () => {
            try {
                setIsLoading(true);
                setError(null);
                setOrders([]);
                const fetchedOrders = await getOrders(viewMode, authToken);
                setOrders(fetchedOrders.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()));
            } catch (err) {
                if (err instanceof AuthError) { onAuthError(); return; }
                setError(err instanceof Error ? `Error al obtener pedidos: ${err.message}` : 'Error desconocido al obtener pedidos.');
                showToast('error', err instanceof Error ? err.message : 'Error desconocido');
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, [tabMode, viewMode, authToken, onAuthError]);

    const handleQuantityChange = useCallback((itemId: number, newQuantity: number, supplierId: string | null) => {
        setOrders(prevOrders => {
            const foundOrder = prevOrders.find(o => o.lineItems.some(i => i.id === itemId));
            if (!foundOrder) return prevOrders;
            const foundItem = foundOrder.lineItems.find(i => i.id === itemId);
            if (!foundItem) return prevOrders;

            let updatedQtyBySupplier = { ...foundItem.quantityBySupplier };
            let totalPurchased: number;

            if (supplierId) {
                updatedQtyBySupplier[supplierId] = newQuantity;
                totalPurchased = Object.values(updatedQtyBySupplier).reduce((s, v) => s + v, 0);
            } else {
                totalPurchased = newQuantity;
            }

            const isPurchased = totalPurchased >= foundItem.quantity;
            const itemToSave: LineItem = {
                ...foundItem,
                quantityPurchased: totalPurchased,
                isPurchased,
                quantityBySupplier: updatedQtyBySupplier,
            };

            const updatedOrders = prevOrders.map(order => {
                if (order.id !== foundOrder.id) return order;
                return { ...order, lineItems: order.lineItems.map(item => item.id === itemId ? itemToSave : item) };
            });

            saveItemStatus(authToken, {
                lineItemId: itemToSave.id,
                orderId: foundOrder.id,
                isPurchased: itemToSave.isPurchased,
                quantityPurchased: itemToSave.quantityPurchased,
                supplierId: supplierId ?? undefined,
                totalQuantity: foundItem.quantity,
            })
                .then(data => { if (data.success) showToast('success', 'Progreso guardado'); })
                .catch(err => { if (err instanceof AuthError) onAuthError(); else showToast('error', 'Error al guardar el progreso'); });

            return updatedOrders;
        });
    }, [authToken, onAuthError]);

    const handleDeleteItem = useCallback((itemId: number) => {
        setOrders(prev => prev.map(order => ({ ...order, lineItems: order.lineItems.filter(i => i.id !== itemId) })));
        showToast('success', 'Artículo eliminado');
    }, []);

    const handleCompleteOrder = useCallback(async (orderId: number) => {
        setCompletingOrderId(orderId);
        try {
            await completeOrder(authToken, orderId);
            showToast('success', `Pedido #${orderId} completado`);
            setOrders(prev => prev.filter(order => order.id !== orderId));
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            showToast('error', `No se pudo completar el pedido #${orderId}`);
        } finally {
            setCompletingOrderId(null);
        }
    }, [authToken, onAuthError]);

    const tabs: { key: TabMode; label: string }[] = [
        { key: 'processing', label: 'Pendientes' },
        { key: 'completed', label: 'Completados' },
        { key: 'store', label: 'Tienda' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="font-epilogue text-2xl md:text-3xl font-bold text-on-background">Pedidos</h1>
                <p className="text-on-surface-variant text-sm mt-0.5">Gestión de pedidos</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-surface-container-low rounded-xl w-fit border border-surface-variant">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setTabMode(tab.key)}
                        className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
                            tabMode === tab.key
                                ? 'bg-primary text-on-primary shadow-sm'
                                : 'text-on-surface-variant hover:text-primary hover:bg-primary/8'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Tienda */}
            {tabMode === 'store' && (
                <div className="space-y-4">
                    {loadingStoreOrders && <LoadingSpinner />}
                    {!loadingStoreOrders && storeOrders.length === 0 && <EmptyStoreOrders />}
                    {!loadingStoreOrders && storeOrders.map(order => (
                        <StoreOrderCard
                            key={order.id}
                            order={order}
                            authToken={authToken}
                            onAuthError={onAuthError}
                            onComplete={handleCompleteStoreOrder}
                            onItemUpdate={handleStoreItemUpdate}
                            onViewImage={handleViewImage}
                            onOrderEdited={handleStoreOrderEdited}
                        />
                    ))}
                </div>
            )}

            {/* Tabs Pedidos (processing/completed) */}
            {tabMode !== 'store' && (
                <>
                    {isLoading && <LoadingSpinner />}
                    {!isLoading && error && (
                        <div className="flex items-center gap-2 p-4 bg-error-container/30 text-error rounded-xl text-sm">
                            <span className="material-symbols-outlined text-base">error</span>
                            {error}
                        </div>
                    )}
                    {!isLoading && !error && orders.length === 0 && <EmptyState />}
                    {!isLoading && !error && orders.length > 0 && (
                        <div className="space-y-4">
                            {orders.map(order => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    viewMode={viewMode}
                                    completingOrderId={completingOrderId}
                                    authToken={authToken}
                                    onAuthError={onAuthError}
                                    onQuantityChange={handleQuantityChange}
                                    onCompleteOrder={handleCompleteOrder}
                                    onViewImage={handleViewImage}
                                    onDelete={handleDeleteItem}
                                    supplierLocations={supplierLocations}
                                  />
                            ))}
                        </div>
                    )}
                </>
            )}

            {modalImageUrl && modalProductName && (
                <ProductImageModal imageUrl={modalImageUrl} productName={modalProductName} onClose={handleCloseModal} />
            )}
        </div>
    );
};

export default OrdersView;
