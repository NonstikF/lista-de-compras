import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Order, LineItem, StoreOrder, OrderTicket } from '../types';
import { getOrders, saveItemStatus, completeOrder, AuthError, type OrderStatusType } from '../services/woocommerceService';
import { getStoreOrders, completeStoreOrder, getOrderTickets, getOrderTicketContent, createOrderTicket, deleteOrderTicket } from '../services/catalogService';
import { CheckCircleIcon, ChevronDownIcon, XMarkIcon, EyeIcon } from './icons';
import { showToast } from './Toast';
import { fmt } from './ui';

type TabMode = OrderStatusType | 'store';

interface GroupedItems {
  [category: string]: LineItem[];
}

interface OrdersViewProps {
  authToken: string;
  onAuthError: () => void;
}

// --- Componente Modal de Imagen ---
const ProductImageModal: React.FC<{ imageUrl: string; productName: string; onClose: () => void }> = ({ imageUrl, productName, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4" onClick={onClose}>
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg mx-auto overflow-hidden" onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1 bg-white rounded-full text-slate-700 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    aria-label="Cerrar imagen"
                >
                    <XMarkIcon className="w-6 h-6" />
                </button>
                <img src={imageUrl} alt={productName} className="max-h-[80vh] w-full object-contain" />
                <div className="p-3 text-center text-slate-700 font-medium border-t border-slate-200">
                    {productName}
                </div>
            </div>
        </div>
    );
};

// --- (LoadingSpinner y EmptyState) ---
const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
);
const EmptyState: React.FC = () => (
    <div className="text-center py-16 px-6 bg-slate-100 rounded-lg">
        <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
        <h3 className="mt-2 text-xl font-medium text-slate-900">Todo al dia!</h3>
        <p className="mt-1 text-slate-500">No hay pedidos pendientes en este momento</p>
    </div>
);

// --- Estado vacío pedidos de Tienda ---
const EmptyStoreOrders: React.FC = () => (
    <div className="text-center py-16 px-6 bg-slate-100 rounded-lg">
        <span className="material-symbols-outlined mx-auto h-12 w-12 text-slate-400 block text-5xl">storefront</span>
        <h3 className="mt-2 text-xl font-medium text-slate-900">Sin pedidos de Tienda</h3>
        <p className="mt-1 text-slate-500">Los pedidos creados desde la Tienda aparecerán aquí.</p>
    </div>
);

// --- Tarjeta de pedido de Tienda ---
const StoreOrderCard: React.FC<{
    order: StoreOrder;
    onComplete: (id: string) => void;
}> = ({ order, onComplete }) => {
    const isPending = order.status === 'pending';
    const date = new Date(order.dateCreated).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    return (
        <article className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-lg">{order.id}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPending ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                            {isPending ? 'Pendiente' : 'Completado'}
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{order.customerName} · {order.customerPhone} · {date}</p>
                    {order.notes && <p className="text-xs text-slate-400 italic mt-0.5">"{order.notes}"</p>}
                </div>
                <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-800 text-lg">{fmt(order.total)}</span>
                    {isPending && (
                        <button
                            onClick={() => onComplete(order.id)}
                            className="px-3 py-1 text-sm font-medium bg-green-500 text-white rounded-md hover:bg-green-600 transition"
                        >
                            Completar
                        </button>
                    )}
                </div>
            </div>
            <div className="divide-y divide-slate-100">
                {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between px-4 py-2 text-sm">
                        <span className="text-slate-700">{item.name}</span>
                        <span className="text-slate-500">{item.qty} × {fmt(item.price)} = <strong className="text-slate-700">{fmt(item.price * item.qty)}</strong></span>
                    </div>
                ))}
            </div>
        </article>
    );
};

// --- Componente OrderItem ---
const OrderItem = React.memo<{
    item: LineItem;
    onQuantityChange: (itemId: number, newQuantity: number) => void;
    onViewImage: (imageUrl: string, productName: string) => void;
    onDelete: (itemId: number) => void;
}>(({ item, onQuantityChange, onViewImage, onDelete }) => {
    const isPurchased = item.isPurchased;
    const isInProgress = item.quantityPurchased > 0 && !isPurchased;

    const unitPrice = item.quantity > 0 ? parseFloat(item.total) / item.quantity : 0;

    const handleToggle = () => {
        const newQuantity = isPurchased ? 0 : item.quantity;
        onQuantityChange(item.id, newQuantity);
    };
    const handleIncrement = () => {
        if (item.quantityPurchased < item.quantity) {
            onQuantityChange(item.id, item.quantityPurchased + 1);
        }
    };
    const handleDecrement = () => {
        if (item.quantityPurchased > 0) {
            onQuantityChange(item.id, item.quantityPurchased - 1);
        }
    };
    const handleDelete = () => {
        if (window.confirm(`¿Eliminar "${item.name}" de este pedido?`)) {
            onDelete(item.id);
        }
    };

    const getBackgroundColor = () => {
        if (isPurchased) return 'bg-green-50 text-slate-500';
        if (isInProgress) return 'bg-yellow-50';
        return 'bg-white hover:bg-slate-50';
    };

    return (
        <div className={`flex items-center justify-between p-3 transition-all duration-300 ${getBackgroundColor()}`}>
            <div className="flex items-center space-x-4 flex-grow">
                <div className="flex-shrink-0">
                    <span className="text-indigo-600 font-bold text-lg">{item.quantity}x</span>
                </div>
                <div>
                    <p className={`font-semibold text-slate-800 ${isPurchased ? 'line-through' : ''}`}>
                        {item.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>SKU: {item.sku || 'N/A'}</span>
                        <span>&bull;</span>
                        <span className="font-semibold text-slate-700">
                            ${unitPrice.toFixed(2)} c/u
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center space-x-3">
                {item.quantity > 1 && (
                    <div className="flex items-center space-x-2">
                        <button onClick={handleDecrement} disabled={item.quantityPurchased === 0} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition">-</button>
                        <span className="font-mono text-base font-semibold text-slate-700 w-8 text-center">{item.quantityPurchased}</span>
                        <button onClick={handleIncrement} disabled={isPurchased} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition">+</button>
                    </div>
                )}
                {item.imageUrl && (
                    <button
                        onClick={() => onViewImage(item.imageUrl!, item.name)}
                        className="p-1 text-slate-500 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full"
                        aria-label={`Ver imagen de ${item.name}`}
                    >
                        <EyeIcon className="w-5 h-5" />
                    </button>
                )}
                <button
                    onClick={handleDelete}
                    aria-label={`Eliminar ${item.name}`}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                    title="Eliminar artículo"
                >
                    <XMarkIcon className="w-5 h-5" />
                </button>
                <button
                    onClick={handleToggle}
                    aria-label={`Mark ${item.name} as ${isPurchased ? 'not purchased' : 'purchased'}`}
                    className={`relative w-14 h-8 rounded-full flex items-center transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${ isPurchased ? 'bg-green-500 focus:ring-green-500' : 'bg-slate-300 focus:ring-indigo-500' }`}
                >
                    <span className={`inline-block w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-300 ${ isPurchased ? 'translate-x-7' : 'translate-x-1' }`} />
                </button>
            </div>
        </div>
    );
});

// --- Helpers de tickets ---
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

// --- Modal de tickets por proveedor en un pedido ---
const OrderTicketModal: React.FC<{
    orderId: number;
    supplierName: string;
    authToken: string;
    onAuthError: () => void;
    onClose: () => void;
}> = ({ orderId, supplierName, authToken, onAuthError, onClose }) => {
    const [tickets, setTickets] = useState<OrderTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [fileError, setFileError] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [viewingContent, setViewingContent] = useState<string | null>(null);
    const [viewingFilename, setViewingFilename] = useState<string | null>(null);
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        if (!TICKET_ALLOWED_TYPES.includes(file.type)) {
            setFileError('Solo se permiten archivos JPG, PNG o PDF.');
            return;
        }
        if (file.size > 1_000_000) {
            setFileError('El archivo no puede superar 1 MB.');
            return;
        }
        setFileError('');
        const reader = new FileReader();
        reader.onload = ev => handleUpload(file, ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleUpload = async (file: File, content: string) => {
        setUploading(true);
        try {
            const ticket = await createOrderTicket(authToken, orderId, {
                supplierName,
                filename: file.name,
                mimeType: file.type,
                size: file.size,
                content,
            });
            setTickets(prev => [ticket, ...prev]);
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
            if (full.mimeType === 'application/pdf') {
                openPdfBlob(full.content, full.filename);
            } else {
                setViewingContent(full.content);
                setViewingFilename(full.filename);
            }
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
            {/* Overlay / modal */}
            <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
                <div
                    className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">Tickets — {supplierName}</h3>
                            <p className="text-xs text-slate-500">Pedido #{orderId}</p>
                        </div>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-500">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Cuerpo */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {/* Zona de subida */}
                        <div>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/jpeg,image/png,application/pdf"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                className="w-full border-2 border-dashed border-slate-300 rounded-xl p-5 flex flex-col items-center gap-2 hover:border-indigo-400 hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploading
                                    ? <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-b-2 border-indigo-500" />
                                    : <span className="material-symbols-outlined text-slate-400 text-4xl">upload_file</span>
                                }
                                <span className="text-sm text-slate-500">
                                    {uploading ? 'Subiendo…' : 'Subir ticket (JPG, PNG o PDF — máx. 1 MB)'}
                                </span>
                            </button>
                            {fileError && (
                                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">error</span>
                                    {fileError}
                                </p>
                            )}
                        </div>

                        {/* Lista */}
                        {isLoading && (
                            <div className="flex justify-center py-6">
                                <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-b-2 border-indigo-500" />
                            </div>
                        )}
                        {!isLoading && tickets.length === 0 && (
                            <div className="flex flex-col items-center py-6 text-slate-400 text-sm">
                                <span className="material-symbols-outlined text-4xl mb-1 opacity-40">receipt_long</span>
                                No hay tickets para este proveedor
                            </div>
                        )}
                        {!isLoading && tickets.length > 0 && (
                            <div className="space-y-2">
                                {tickets.map(ticket => (
                                    <div key={ticket.id} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                        {/* Miniatura — visible solo si hay content (recién subido) */}
                                        {ticket.content && ticket.mimeType !== 'application/pdf' && (
                                            <button
                                                type="button"
                                                onClick={() => { setViewingContent(ticket.content!); setViewingFilename(ticket.filename); }}
                                                className="block w-full"
                                            >
                                                <img
                                                    src={ticket.content}
                                                    alt={ticket.filename}
                                                    className="w-full max-h-48 object-cover"
                                                />
                                            </button>
                                        )}
                                        {ticket.content && ticket.mimeType === 'application/pdf' && (
                                            <button
                                                type="button"
                                                onClick={() => openPdfBlob(ticket.content!, ticket.filename)}
                                                className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 hover:bg-red-100 transition text-red-700 text-sm font-medium"
                                            >
                                                <span className="material-symbols-outlined text-2xl">picture_as_pdf</span>
                                                Abrir PDF
                                            </button>
                                        )}
                                        {/* Fila con metadata */}
                                        <div className="flex items-center gap-3 px-3 py-2.5">
                                            {!ticket.content && (
                                                <span className="material-symbols-outlined text-slate-400 text-xl flex-shrink-0">
                                                    {ticket.mimeType === 'application/pdf' ? 'picture_as_pdf' : 'image'}
                                                </span>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-700 truncate">{ticket.filename}</p>
                                                <p className="text-xs text-slate-400">
                                                    {formatTicketSize(ticket.size)} · {new Date(ticket.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0">
                                                {!ticket.content && (
                                                    <button
                                                        onClick={() => handleView(ticket)}
                                                        className="px-2.5 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition"
                                                    >
                                                        Ver
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setConfirmDeleteId(ticket.id)}
                                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                >
                                                    <XMarkIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-slate-200 flex justify-end">
                        <button onClick={onClose} className="px-4 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmar eliminar */}
            {confirmDeleteId && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                        <p className="text-slate-800 font-medium mb-4">¿Eliminar este ticket? Esta acción no se puede deshacer.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmDeleteId(null)} disabled={deleting} className="px-4 py-1.5 text-sm text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-50">
                                Cancelar
                            </button>
                            <button onClick={handleDelete} disabled={deleting} className="px-4 py-1.5 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
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
                        <button
                            className="absolute -top-9 right-0 text-white text-sm flex items-center gap-1 hover:opacity-80"
                            onClick={() => setViewingContent(null)}
                        >
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

// --- Componente CategorySection ---
const CategorySection = React.memo<{
    category: string;
    items: LineItem[];
    orderId: number;
    authToken: string;
    onAuthError: () => void;
    onQuantityChange: (itemId: number, newQuantity: number) => void;
    onViewImage: (imageUrl: string, productName: string) => void;
    onDelete: (itemId: number) => void;
}>(({ category, items, orderId, authToken, onAuthError, onQuantityChange, onViewImage, onDelete }) => {

    const [isExpanded, setIsExpanded] = useState(false);
    const [showTickets, setShowTickets] = useState(false);

    const purchasedCount = items.filter(item => item.isPurchased).length;
    const totalCount = items.length;
    const isComplete = purchasedCount === totalCount;

    const categoryTotal = items.reduce((sum, item) => {
        return sum + parseFloat(item.total);
    }, 0);

    return (
        <>
            <section aria-labelledby={`category-heading-${category}`}>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className={`p-3 border-b flex justify-between items-center transition-colors ${isComplete ? 'border-green-200 bg-green-50' : 'border-indigo-200 bg-indigo-50'} ${isExpanded ? '' : 'border-b-0'}`}>
                        <button
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center gap-2 flex-1 text-left"
                        >
                            <ChevronDownIcon className={`w-5 h-5 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            <h3 id={`category-heading-${category}`} className="text-lg font-semibold text-slate-700">{category}</h3>
                        </button>

                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${isComplete ? 'text-green-800' : 'text-indigo-800'}`}>
                                ${categoryTotal.toFixed(2)}
                            </span>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isComplete ? 'bg-green-200 text-green-800' : 'bg-indigo-200 text-indigo-800'}`}>
                                {purchasedCount} / {totalCount}
                            </span>
                            <button
                                type="button"
                                onClick={e => { e.stopPropagation(); setShowTickets(true); }}
                                title="Subir ticket"
                                className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-100 transition-colors"
                            >
                                <span className="material-symbols-outlined text-xl leading-none">receipt_long</span>
                            </button>
                        </div>
                    </div>

                    {isExpanded && (
                        <div className="divide-y divide-slate-100">
                            {items.map(item => (
                                <OrderItem
                                    key={item.id}
                                    item={item}
                                    onQuantityChange={onQuantityChange}
                                    onViewImage={onViewImage}
                                    onDelete={onDelete}
                                />
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
                />
            )}
        </>
    );
});

// --- Componente OrderCard ---
const OrderCard = React.memo<{
    order: Order;
    viewMode: OrderStatusType;
    completingOrderId: number | null;
    authToken: string;
    onAuthError: () => void;
    onQuantityChange: (itemId: number, newQuantity: number) => void;
    onCompleteOrder: (orderId: number) => void;
    onViewImage: (imageUrl: string, productName: string) => void;
    onDelete: (itemId: number) => void;
}>(({ order, viewMode, completingOrderId, authToken, onAuthError, onQuantityChange, onCompleteOrder, onViewImage, onDelete }) => {

    const [isExpanded, setIsExpanded] = useState(false);

    const itemsByCategory = order.lineItems.reduce((acc, item) => {
        const category = item.category || 'Products';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {} as GroupedItems);

    const categories = Object.keys(itemsByCategory).sort();
    const allItemsPurchased = order.lineItems.every(item => item.isPurchased);

    return (
        <article aria-labelledby={`order-heading-${order.id}`} className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center flex-wrap gap-3 ${isExpanded ? '' : 'border-b-0'}`}
            >
                <div className="flex items-center gap-2">
                    <ChevronDownIcon className={`w-6 h-6 text-slate-700 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    <div>
                        <h2 id={`order-heading-${order.id}`} className="text-xl md:text-2xl font-bold text-slate-800 text-left">Order #{order.id}</h2>
                        <p className="text-sm text-slate-500 mt-1 text-left">
                            {order.customer.firstName} {order.customer.lastName} &bull; {new Date(order.dateCreated).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-slate-800">
                        ${parseFloat(order.total).toFixed(2)}
                    </span>
                    <span className={`capitalize px-3 py-1 text-sm font-semibold rounded-full ${ order.status === 'processing' ? 'bg-blue-100 text-blue-800' : order.status === 'on-hold' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800' }`}>
                        {order.status}
                    </span>
                    {viewMode === 'processing' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onCompleteOrder(order.id);
                            }}
                            disabled={!allItemsPurchased || completingOrderId === order.id}
                            className="px-3 py-1 text-sm font-medium bg-green-500 text-white rounded-md shadow-sm hover:bg-green-600 disabled:bg-gray-400 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {completingOrderId === order.id ? 'Completando...' : 'Completar Pedido'}
                        </button>
                    )}
                </div>
            </button>

            {isExpanded && (
                <div className="p-4 space-y-4">
                    {categories.map(category => {
                        const items = itemsByCategory[category];

                        const sortedItems = items.sort((a, b) =>
                            (a.sku || '').localeCompare(
                                (b.sku || ''),
                                undefined,
                                { numeric: true, sensitivity: 'base' }
                            )
                        );

                        return (
                            <CategorySection
                                key={category}
                                category={category}
                                items={sortedItems}
                                orderId={order.id}
                                authToken={authToken}
                                onAuthError={onAuthError}
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

// --- COMPONENTE PRINCIPAL: OrdersView ---
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
    const handleViewImage = useCallback((imageUrl: string, productName: string) => {
        setModalImageUrl(imageUrl);
        setModalProductName(productName);
    }, []);
    const handleCloseModal = () => {
        setModalImageUrl(null);
        setModalProductName(null);
    };
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
                if (err instanceof AuthError) {
                    onAuthError();
                    return;
                }
                if (err instanceof Error) {
                    setError(`Error al obtener pedidos: ${err.message}`);
                } else {
                    setError('Error desconocido al obtener pedidos.');
                }
                showToast('error', err instanceof Error ? err.message : 'Error desconocido');
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, [tabMode, viewMode, authToken, onAuthError]);
    const handleQuantityChange = useCallback((itemId: number, newQuantity: number) => {
        setOrders(prevOrders => {
            let itemToSave: LineItem | null = null;
            let orderIdToSave: number | null = null;
            const foundOrder = prevOrders.find(o => o.lineItems.some(i => i.id === itemId));
            if (!foundOrder) return prevOrders;
            const foundItem = foundOrder.lineItems.find(i => i.id === itemId);
            if (!foundItem) return prevOrders;
            orderIdToSave = foundOrder.id;
            itemToSave = {
                ...foundItem,
                quantityPurchased: newQuantity,
                isPurchased: newQuantity === foundItem.quantity
            };
            const updatedOrders = prevOrders.map(order => {
                if (order.id !== orderIdToSave) return order;
                const updatedLineItems = order.lineItems.map(item => {
                    if (item.id === itemId) return itemToSave!;
                    return item;
                });
                return { ...order, lineItems: updatedLineItems };
            });

            // Fire-and-forget save to backend
            if (itemToSave && orderIdToSave) {
                const { id: lineItemId, isPurchased, quantityPurchased } = itemToSave;
                saveItemStatus(authToken, {
                    lineItemId,
                    orderId: orderIdToSave,
                    isPurchased,
                    quantityPurchased,
                })
                .then(data => {
                    if (data.success) showToast('success', 'Progreso guardado');
                })
                .catch(err => {
                    if (err instanceof AuthError) {
                        onAuthError();
                        return;
                    }
                    showToast('error', 'Error al guardar el progreso');
                });
            }

            return updatedOrders;
        });
    }, [authToken, onAuthError]);
    const handleDeleteItem = useCallback((itemId: number) => {
        setOrders(prev => prev.map(order => ({
            ...order,
            lineItems: order.lineItems.filter(i => i.id !== itemId),
        })));
        showToast('success', 'Artículo eliminado');
    }, []);
    const handleCompleteOrder = useCallback(async (orderId: number) => {
        setCompletingOrderId(orderId);
        try {
            await completeOrder(authToken, orderId);
            showToast('success', `Pedido #${orderId} completado`);
            setOrders(currentOrders => currentOrders.filter(order => order.id !== orderId));
        } catch (err) {
            if (err instanceof AuthError) {
                onAuthError();
                return;
            }
            showToast('error', `No se pudo completar el pedido #${orderId}`);
        } finally {
            setCompletingOrderId(null);
        }
    }, [authToken, onAuthError]);
    const TabButton: React.FC<{
        label: string;
        isActive: boolean;
        onClick: () => void;
    }> = ({ label, isActive, onClick }) => {
        return (
            <button
                onClick={onClick}
                className={`px-6 py-2 font-medium rounded-md transition-colors ${
                    isActive
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
            >
                {label}
            </button>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex space-x-2 p-1 bg-slate-200 rounded-lg max-w-lg">
                <TabButton
                    label="Pendientes"
                    isActive={tabMode === 'processing'}
                    onClick={() => setTabMode('processing')}
                />
                <TabButton
                    label="Completados"
                    isActive={tabMode === 'completed'}
                    onClick={() => setTabMode('completed')}
                />
                <TabButton
                    label="Tienda"
                    isActive={tabMode === 'store'}
                    onClick={() => setTabMode('store')}
                />
            </div>

            {/* Tab Tienda */}
            {tabMode === 'store' && (
                <div className="space-y-4">
                    {loadingStoreOrders && (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" />
                        </div>
                    )}
                    {!loadingStoreOrders && storeOrders.length === 0 && <EmptyStoreOrders />}
                    {!loadingStoreOrders && storeOrders.map(order => (
                        <StoreOrderCard key={order.id} order={order} onComplete={handleCompleteStoreOrder} />
                    ))}
                </div>
            )}

            {/* Tabs WooCommerce */}
            {tabMode !== 'store' && (
                <>
                    {isLoading && <LoadingSpinner />}
                    {!isLoading && error && <div className="text-center p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}
                    {!isLoading && !error && orders.length === 0 && <EmptyState />}

                    {!isLoading && !error && orders.length > 0 && (
                        <div className="space-y-8">
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
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {modalImageUrl && modalProductName && (
                <ProductImageModal
                    imageUrl={modalImageUrl}
                    productName={modalProductName}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
};

export default OrdersView;
