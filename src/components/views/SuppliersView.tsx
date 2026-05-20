import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Supplier, SupplierTicket, OrderTicket } from '../../types';

// Fix leaflet default marker icons when bundled with Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
import {
    AuthError, getSuppliers, createSupplier, updateSupplier, deleteSupplier,
    getSupplierTickets, getSupplierTicketContent, createSupplierTicket, deleteSupplierTicket,
    updateSupplierTicketInvoiced, getSupplierOrderTickets, getOrderTicketContent, updateOrderTicketInvoiced,
} from '../../services/api';
import { Modal, Button, Field, Input, MIcon, useToast } from '../ui';

interface SuppliersViewProps {
    authToken: string;
    onAuthError: () => void;
}

// ---------- Modal de edición ----------
interface SupplierForm {
    name: string;
    contact: string;
    phone: string;
    zones: string[];
    address: string;
}

const SupplierEditModal: React.FC<{
    supplier: Supplier | 'new' | null;
    onClose: () => void;
    onSave: (data: SupplierForm) => Promise<void>;
}> = ({ supplier, onClose, onSave }) => {
    const isNew = supplier === 'new';
    const initial: SupplierForm = isNew
        ? { name: '', contact: '', phone: '', zones: [], address: '' }
        : { name: (supplier as Supplier).name, contact: (supplier as Supplier).contact, phone: (supplier as Supplier).phone, zones: (supplier as Supplier).zones ?? [], address: (supplier as Supplier).address ?? '' };

    const [form, setForm] = useState<SupplierForm>(initial);
    const [nameError, setNameError] = useState('');
    const [saving, setSaving] = useState(false);
    const [newZone, setNewZone] = useState('');
    const [zoneError, setZoneError] = useState('');

    const update = (k: keyof SupplierForm, v: string) => setForm(f => ({ ...f, [k]: v }));

    const addZone = () => {
        const z = newZone.trim();
        if (!z) return;
        if (form.zones.length >= 10) { setZoneError('Máximo 10 zonas'); return; }
        if (form.zones.includes(z)) { setZoneError('Zona ya existe'); return; }
        setForm(f => ({ ...f, zones: [...f.zones, z] }));
        setNewZone('');
        setZoneError('');
    };

    const removeZone = (z: string) => setForm(f => ({ ...f, zones: f.zones.filter(x => x !== z) }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { setNameError('El nombre es requerido'); return; }
        setSaving(true);
        try {
            await onSave({ name: form.name.trim(), contact: form.contact.trim(), phone: form.phone.trim(), zones: form.zones, address: form.address.trim() });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={isNew ? 'Nuevo proveedor' : 'Editar proveedor'}
            maxWidth="max-w-md"
            footer={
                <>
                    <Button variant="neutral" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button variant="filled" icon="save" onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Guardando…' : 'Guardar'}
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <Field label="Nombre" required error={nameError}>
                    <Input
                        value={form.name}
                        onChange={e => { update('name', e.target.value); setNameError(''); }}
                        placeholder="Ej. Viveros del Sur"
                        autoFocus
                    />
                </Field>
                <Field label="Contacto">
                    <Input
                        value={form.contact}
                        onChange={e => update('contact', e.target.value)}
                        placeholder="Nombre del contacto"
                    />
                </Field>
                <Field label="Teléfono">
                    <Input
                        type="tel"
                        value={form.phone}
                        onChange={e => update('phone', e.target.value)}
                        placeholder="55 1234 5678"
                    />
                </Field>
                <Field label="Dirección">
                    <Input
                        value={form.address}
                        onChange={e => update('address', e.target.value)}
                        placeholder="Ej. Av. Insurgentes 123, CDMX"
                    />
                </Field>

                <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block mb-2">
                        Zonas <span className="font-normal normal-case">({form.zones.length}/10)</span>
                    </span>
                    {form.zones.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {form.zones.map(z => (
                                <span key={z} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-secondary-container text-on-secondary-container">
                                    {z}
                                    <button
                                        type="button"
                                        onClick={() => removeZone(z)}
                                        className="ml-0.5 hover:text-error transition"
                                        aria-label={`Quitar zona ${z}`}
                                    >
                                        <MIcon name="close" size={14} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    {form.zones.length < 10 && (
                        <div className="flex gap-2">
                            <Input
                                value={newZone}
                                onChange={e => { setNewZone(e.target.value); setZoneError(''); }}
                                placeholder="Nombre de zona"
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addZone(); } }}
                            />
                            <Button type="button" variant="tonal" icon="add" onClick={addZone}>
                                Agregar
                            </Button>
                        </div>
                    )}
                    {zoneError && <p className="text-xs text-error mt-1">{zoneError}</p>}
                </div>
            </form>
        </Modal>
    );
};

// ---------- Modal de mapa ----------
function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
    const map = useMap();
    useEffect(() => { map.setView([lat, lng], 15); }, [lat, lng]);
    return null;
}

const SupplierMapModal: React.FC<{
    supplier: Supplier;
    onClose: () => void;
}> = ({ supplier, onClose }) => {
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

    useEffect(() => {
        if (!supplier.address.trim()) return;
        setStatus('loading');
        fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(supplier.address)}`, {
            headers: { 'Accept-Language': 'es' },
        })
            .then(r => r.json())
            .then((data: { lat: string; lon: string }[]) => {
                if (data.length > 0) {
                    setCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
                    setStatus('idle');
                } else {
                    setStatus('error');
                }
            })
            .catch(() => setStatus('error'));
    }, [supplier.address]);

    return (
        <div
            className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-surface-variant">
                    <div>
                        <p className="font-epilogue font-bold text-on-background">{supplier.name}</p>
                        {supplier.address && (
                            <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
                                <MIcon name="location_on" size={13} className="text-primary" />
                                {supplier.address}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant"
                    >
                        <MIcon name="close" />
                    </button>
                </div>

                {/* Mapa */}
                <div className="h-72 relative">
                    {!supplier.address.trim() && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-on-surface-variant bg-surface-container-low">
                            <MIcon name="location_off" size={36} className="opacity-40" />
                            <p className="text-sm">Este proveedor no tiene dirección registrada.</p>
                        </div>
                    )}
                    {supplier.address.trim() && status === 'loading' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-surface-container-low z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                        </div>
                    )}
                    {supplier.address.trim() && status === 'error' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-on-surface-variant bg-surface-container-low">
                            <MIcon name="location_searching" size={36} className="opacity-40" />
                            <p className="text-sm">No se encontró la dirección.</p>
                            <p className="text-xs opacity-60">Verificá que la dirección sea correcta.</p>
                        </div>
                    )}
                    {coords && (
                        <MapContainer
                            center={[coords.lat, coords.lng]}
                            zoom={15}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl
                        >
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            />
                            <MapRecenter lat={coords.lat} lng={coords.lng} />
                            <Marker position={[coords.lat, coords.lng]}>
                                <Popup>{supplier.name}</Popup>
                            </Marker>
                        </MapContainer>
                    )}
                </div>
            </div>
        </div>
    );
};

// ---------- Modal de tickets ----------
function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function openPdfInNewTab(dataUrl: string, filename: string) {
    // Convert base64 dataURL to Blob and open via object URL to avoid document.write
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
        // Fallback: force download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    }
    // Clean up the object URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

const SupplierTicketsModal: React.FC<{
    supplier: Supplier;
    authToken: string;
    onClose: () => void;
    onAuthError: () => void;
}> = ({ supplier, authToken, onClose, onAuthError }) => {
    const [tickets, setTickets] = useState<SupplierTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [fileError, setFileError] = useState('');
    const [pendingFile, setPendingFile] = useState<{ file: File; content: string } | null>(null);
    const [orderRefInput, setOrderRefInput] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [viewingContent, setViewingContent] = useState<string | null>(null);
    const [viewingFilename, setViewingFilename] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [togglingOrderId, setTogglingOrderId] = useState<string | null>(null);
    const [activeGroup, setActiveGroup] = useState<string | null>(null);
    const [orderTickets, setOrderTickets] = useState<OrderTicket[]>([]);
    const [contentCache, setContentCache] = useState<Record<string, string>>({});
    const [loadingPreviews, setLoadingPreviews] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            try {
                const [supplierData, orderData] = await Promise.all([
                    getSupplierTickets(authToken, supplier.id),
                    getSupplierOrderTickets(authToken, supplier.id),
                ]);
                if (!cancelled) { setTickets(supplierData); setOrderTickets(orderData); }
            } catch (err) {
                if (err instanceof AuthError) { onAuthError(); return; }
                if (!cancelled) toast('error', err instanceof Error ? err.message : 'Error al cargar tickets');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [supplier.id]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        if (!ALLOWED_TYPES.includes(file.type)) { setFileError('Solo se permiten archivos JPG, PNG o PDF.'); return; }
        if (file.size > 1_000_000) { setFileError('El archivo no puede superar 1 MB.'); return; }
        setFileError('');
        const reader = new FileReader();
        reader.onload = ev => {
            setPendingFile({ file, content: ev.target?.result as string });
            setOrderRefInput('');
        };
        reader.readAsDataURL(file);
    };

    const handleUploadConfirm = async () => {
        if (!pendingFile) return;
        setUploading(true);
        try {
            const ticket = await createSupplierTicket(authToken, supplier.id, {
                filename: pendingFile.file.name,
                mimeType: pendingFile.file.type,
                size: pendingFile.file.size,
                content: pendingFile.content,
                orderRef: orderRefInput.trim(),
            });
            setTickets(prev => [ticket, ...prev]);
            setPendingFile(null);
            setOrderRefInput('');
            toast('success', 'Ticket subido correctamente');
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al subir ticket');
        } finally {
            setUploading(false);
        }
    };

    const handleView = async (ticket: SupplierTicket) => {
        try {
            const full = await getSupplierTicketContent(authToken, supplier.id, ticket.id);
            if (!full.content) return;
            if (full.mimeType === 'application/pdf') {
                openPdfInNewTab(full.content, full.filename);
            } else {
                setViewingContent(full.content);
                setViewingFilename(full.filename);
            }
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', 'No se pudo cargar el ticket');
        }
    };

    const handleToggleInvoiced = async (ticket: SupplierTicket) => {
        setTogglingId(ticket.id);
        try {
            const updated = await updateSupplierTicketInvoiced(authToken, supplier.id, ticket.id, !ticket.invoiced);
            setTickets(prev => prev.map(t => t.id === updated.id ? { ...t, invoiced: updated.invoiced } : t));
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', 'No se pudo actualizar el estado');
        } finally {
            setTogglingId(null);
        }
    };

    const handleToggleOrderInvoiced = async (ticket: OrderTicket) => {
        setTogglingOrderId(ticket.id);
        try {
            const updated = await updateOrderTicketInvoiced(authToken, ticket.orderId, ticket.id, !ticket.invoiced);
            setOrderTickets(prev => prev.map(t => t.id === updated.id ? { ...t, invoiced: updated.invoiced } : t));
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', 'No se pudo actualizar el estado');
        } finally {
            setTogglingOrderId(null);
        }
    };

    const handleDelete = async () => {
        if (!confirmDeleteId) return;
        setDeleting(true);
        try {
            await deleteSupplierTicket(authToken, supplier.id, confirmDeleteId);
            setTickets(prev => prev.filter(t => t.id !== confirmDeleteId));
            toast('success', 'Ticket eliminado');
            setConfirmDeleteId(null);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al eliminar ticket');
        } finally {
            setDeleting(false);
        }
    };

    // SupplierTickets grouped by orderRef
    const supplierGroups = tickets.reduce<Record<string, SupplierTicket[]>>((acc, t) => {
        const key = t.orderRef?.trim() || '';
        if (!acc[key]) acc[key] = [];
        acc[key].push(t);
        return acc;
    }, {});
    const sortedSupplierKeys = Object.keys(supplierGroups).sort((a, b) => {
        if (a === '') return 1;
        if (b === '') return -1;
        return a.localeCompare(b, 'es', { numeric: true });
    });

    // OrderTickets grouped by orderId — key prefix "order:"
    const orderGroups = orderTickets.reduce<Record<string, OrderTicket[]>>((acc, t) => {
        const key = String(t.orderId);
        if (!acc[key]) acc[key] = [];
        acc[key].push(t);
        return acc;
    }, {});
    const sortedOrderKeys = Object.keys(orderGroups).sort((a, b) => Number(b) - Number(a));

    const totalCount = tickets.length + orderTickets.length;
    const totalGroups = sortedSupplierKeys.length + sortedOrderKeys.length;

    // Set first group active once data loads
    useEffect(() => {
        if (activeGroup === null) {
            if (sortedOrderKeys.length > 0) setActiveGroup(`order:${sortedOrderKeys[0]}`);
            else if (sortedSupplierKeys.length > 0) setActiveGroup(`supplier:${sortedSupplierKeys[0]}`);
        }
    }, [orderTickets.length, tickets.length]);

    const isOrderGroup = activeGroup?.startsWith('order:') ?? false;
    const activeKey = activeGroup?.replace(/^(order|supplier):/, '') ?? '';
    const activeOrderTickets: OrderTicket[] = isOrderGroup ? (orderGroups[activeKey] ?? []) : [];
    const activeSupplierTickets: SupplierTicket[] = !isOrderGroup && activeGroup !== null ? (supplierGroups[activeKey] ?? []) : [];
    const invoicedCount = activeSupplierTickets.filter(t => t.invoiced).length;

    // Load previews for active group
    useEffect(() => {
        if (!activeGroup) return;
        const toLoad = isOrderGroup
            ? activeOrderTickets.filter(t => t.mimeType !== 'application/pdf' && !contentCache[t.id])
            : activeSupplierTickets.filter(t => t.mimeType !== 'application/pdf' && !contentCache[t.id]);
        if (toLoad.length === 0) return;
        let cancelled = false;
        setLoadingPreviews(true);
        Promise.all(
            toLoad.map(t => isOrderGroup
                ? getOrderTicketContent(authToken, (t as OrderTicket).orderId, t.id)
                : getSupplierTicketContent(authToken, supplier.id, t.id)
            )
        ).then(results => {
            if (cancelled) return;
            setContentCache(prev => {
                const next = { ...prev };
                results.forEach(r => { if (r.content) next[r.id] = r.content; });
                return next;
            });
        }).catch(() => {}).finally(() => { if (!cancelled) setLoadingPreviews(false); });
        return () => { cancelled = true; };
    }, [activeGroup]);

    return (
        <>
            <Modal
                open
                onClose={onClose}
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <MIcon name="receipt_long" className="text-primary text-lg" fill />
                        </div>
                        <div>
                            <span className="text-base font-bold text-on-background">{supplier.name}</span>
                            <p className="text-xs font-normal text-on-surface-variant leading-none mt-0.5">
                                {totalCount} ticket{totalCount !== 1 ? 's' : ''} · {totalGroups} pedido{totalGroups !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                }
                maxWidth="max-w-3xl"
                footer={
                    <div className="flex items-center justify-between w-full">
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <MIcon name="add_photo_alternate" className="text-lg leading-none" />
                            }
                            {uploading ? 'Subiendo…' : 'Subir ticket'}
                        </button>
                        <Button variant="neutral" onClick={onClose}>Cerrar</Button>
                    </div>
                }
            >
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                />

                {isLoading && (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                    </div>
                )}

                {!isLoading && totalCount === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-on-surface-variant gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center">
                            <MIcon name="receipt_long" size={32} className="opacity-40" />
                        </div>
                        <p className="text-sm font-medium">No hay tickets para este proveedor</p>
                        <p className="text-xs opacity-60">Sube el primer ticket con el botón de abajo</p>
                    </div>
                )}

                {!isLoading && totalCount > 0 && (
                    <div className="flex flex-col md:flex-row md:h-[420px]">
                        {/* Sidebar — horizontal scroll en móvil, vertical en desktop */}
                        <div className="md:w-52 md:flex-shrink-0 border-b md:border-b-0 md:border-r border-surface-variant bg-surface-container-low md:flex md:flex-col md:overflow-y-auto">

                            {/* Mobile: tabs horizontales */}
                            <div className="flex md:hidden overflow-x-auto gap-1.5 px-3 py-2 scrollbar-hide">
                                {sortedOrderKeys.map(orderId => {
                                    const grpKey = `order:${orderId}`;
                                    const isActive = activeGroup === grpKey;
                                    return (
                                        <button
                                            key={grpKey}
                                            type="button"
                                            onClick={() => setActiveGroup(grpKey)}
                                            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${isActive ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}
                                        >
                                            <MIcon name="shopping_cart" className="text-sm leading-none" />
                                            #{orderId}
                                        </button>
                                    );
                                })}
                                {sortedSupplierKeys.map(key => {
                                    const grpKey = `supplier:${key}`;
                                    const isActive = activeGroup === grpKey;
                                    const allInvoiced = supplierGroups[key].every(t => t.invoiced);
                                    return (
                                        <button
                                            key={grpKey}
                                            type="button"
                                            onClick={() => setActiveGroup(grpKey)}
                                            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${isActive ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}
                                        >
                                            <MIcon name={allInvoiced ? 'check_circle' : 'receipt'} className="text-sm leading-none" fill={allInvoiced} />
                                            {key || 'Sin ref.'}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Desktop: sidebar vertical */}
                            <div className="hidden md:block">
                                {/* Sección: Pedidos WooCommerce */}
                                {sortedOrderKeys.length > 0 && (
                                    <>
                                        <p className="px-4 pt-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">De lista de compras</p>
                                        <div className="space-y-0.5 px-2">
                                            {sortedOrderKeys.map(orderId => {
                                                const grpKey = `order:${orderId}`;
                                                const count = orderGroups[orderId].length;
                                                const isActive = activeGroup === grpKey;
                                                const date = new Date(orderGroups[orderId][0].createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
                                                return (
                                                    <button
                                                        key={grpKey}
                                                        type="button"
                                                        onClick={() => setActiveGroup(grpKey)}
                                                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-2.5 ${isActive ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-surface-container text-on-background'}`}
                                                    >
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-white/20' : 'bg-blue-50'}`}>
                                                            <MIcon name="shopping_cart" className={`text-sm leading-none ${isActive ? 'text-white' : 'text-blue-400'}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-on-background'}`}>
                                                                Pedido #{orderId}
                                                            </p>
                                                            <p className={`text-[10px] ${isActive ? 'text-white/70' : 'text-on-surface-variant'}`}>
                                                                {count} ticket{count !== 1 ? 's' : ''} · {date}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                {/* Sección: Tickets propios */}
                                {sortedSupplierKeys.length > 0 && (
                                    <>
                                        <p className="px-4 pt-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Propios</p>
                                        <div className="space-y-0.5 px-2 pb-4">
                                            {sortedSupplierKeys.map(key => {
                                                const grpKey = `supplier:${key}`;
                                                const count = supplierGroups[key].length;
                                                const allInvoiced = supplierGroups[key].every(t => t.invoiced);
                                                const someInvoiced = supplierGroups[key].some(t => t.invoiced);
                                                const isActive = activeGroup === grpKey;
                                                return (
                                                    <button
                                                        key={grpKey}
                                                        type="button"
                                                        onClick={() => setActiveGroup(grpKey)}
                                                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-2.5 ${isActive ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-surface-container text-on-background'}`}
                                                    >
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-white/20' : allInvoiced ? 'bg-success/10' : 'bg-surface-variant'}`}>
                                                            <MIcon
                                                                name={key ? 'receipt' : 'help_outline'}
                                                                className={`text-sm leading-none ${isActive ? 'text-white' : allInvoiced ? 'text-success' : 'text-on-surface-variant'}`}
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-on-background'}`}>
                                                                {key || 'Sin referencia'}
                                                            </p>
                                                            <p className={`text-[10px] ${isActive ? 'text-white/70' : 'text-on-surface-variant'}`}>
                                                                {count} ticket{count !== 1 ? 's' : ''}
                                                                {someInvoiced ? ` · ${supplierGroups[key].filter(t => t.invoiced).length} fact.` : ''}
                                                            </p>
                                                        </div>
                                                        {allInvoiced && !isActive && (
                                                            <MIcon name="check_circle" className="text-sm text-success flex-shrink-0" fill />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Panel derecho */}
                        <div className="flex-1 overflow-y-auto">
                            {activeGroup !== null && (
                                <>
                                    {/* Header */}
                                    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-surface-variant px-4 py-3 flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-sm text-on-background">
                                                {isOrderGroup
                                                    ? `Pedido #${activeKey}`
                                                    : activeKey ? `Ref. ${activeKey}` : 'Sin referencia'}
                                            </p>
                                            <p className="text-xs text-on-surface-variant">
                                                {isOrderGroup
                                                    ? `${activeOrderTickets.length} ticket${activeOrderTickets.length !== 1 ? 's' : ''}`
                                                    : `${activeSupplierTickets.length} ticket${activeSupplierTickets.length !== 1 ? 's' : ''} · ${invoicedCount} facturado${invoicedCount !== 1 ? 's' : ''}`
                                                }
                                            </p>
                                        </div>
                                        {isOrderGroup && (
                                            <span className="flex items-center gap-1 text-xs font-medium text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full">
                                                <MIcon name="shopping_cart" className="text-sm" /> WooCommerce
                                            </span>
                                        )}
                                        {!isOrderGroup && invoicedCount === activeSupplierTickets.length && activeSupplierTickets.length > 0 && (
                                            <span className="flex items-center gap-1 text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
                                                <MIcon name="check_circle" className="text-sm" fill /> Completo
                                            </span>
                                        )}
                                    </div>

                                    {/* Cards — OrderTickets */}
                                    {isOrderGroup && (
                                        <div className="p-3 grid grid-cols-2 gap-3">
                                            {activeOrderTickets.map(ticket => {
                                                const preview = contentCache[ticket.id];
                                                const isPdf = ticket.mimeType === 'application/pdf';
                                                return (
                                                    <div key={ticket.id} className={`rounded-2xl border overflow-hidden transition-all ${ticket.invoiced ? 'border-success/40 shadow-sm' : 'border-surface-variant hover:border-blue-200 hover:shadow-sm'}`}>
                                                        {/* Preview area */}
                                                        <div
                                                            className={`relative w-full h-36 flex items-center justify-center cursor-pointer ${isPdf ? 'bg-red-50' : 'bg-surface-container-low'}`}
                                                            onClick={async () => {
                                                                try {
                                                                    const full = await getOrderTicketContent(authToken, ticket.orderId, ticket.id);
                                                                    if (!full.content) return;
                                                                    if (isPdf) { openPdfInNewTab(full.content, full.filename); }
                                                                    else { setViewingContent(full.content); setViewingFilename(full.filename); }
                                                                } catch { toast('error', 'No se pudo cargar el ticket'); }
                                                            }}
                                                        >
                                                            {isPdf ? (
                                                                <div className="flex flex-col items-center gap-1 text-red-400">
                                                                    <MIcon name="picture_as_pdf" size={40} />
                                                                    <span className="text-xs font-medium">PDF</span>
                                                                </div>
                                                            ) : preview ? (
                                                                <img src={preview} alt={ticket.filename} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="animate-pulse w-8 h-8 rounded-full bg-surface-variant" />
                                                            )}
                                                            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                                                <div className="bg-black/50 rounded-full p-2">
                                                                    <MIcon name="zoom_in" className="text-white text-xl" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Footer */}
                                                        <div className={`px-3 py-2 ${ticket.invoiced ? 'bg-success/5' : 'bg-white'}`}>
                                                            <p className="text-xs text-on-surface-variant">{new Date(ticket.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                            <div className="flex items-center justify-between mt-1.5">
                                                                <button
                                                                    type="button"
                                                                    role="switch"
                                                                    aria-checked={ticket.invoiced}
                                                                    disabled={togglingOrderId === ticket.id}
                                                                    onClick={() => handleToggleOrderInvoiced(ticket)}
                                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${ticket.invoiced ? 'bg-success' : 'bg-surface-variant'}`}
                                                                >
                                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${ticket.invoiced ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                                                                </button>
                                                                <span className={`text-[11px] font-semibold ${ticket.invoiced ? 'text-success' : 'text-on-surface-variant'}`}>
                                                                    {togglingOrderId === ticket.id ? '…' : ticket.invoiced ? 'Facturado' : 'Sin factura'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Cards — SupplierTickets con preview inline */}
                                    {!isOrderGroup && (
                                        <div className="p-3 grid grid-cols-2 gap-3">
                                            {activeSupplierTickets.map(ticket => {
                                                const preview = contentCache[ticket.id];
                                                const isPdf = ticket.mimeType === 'application/pdf';
                                                return (
                                                    <div key={ticket.id} className={`rounded-2xl border overflow-hidden transition-all ${ticket.invoiced ? 'border-success/40 shadow-sm' : 'border-surface-variant hover:border-primary/30 hover:shadow-sm'}`}>
                                                        {/* Preview */}
                                                        <div
                                                            className={`relative w-full h-36 flex items-center justify-center cursor-pointer ${isPdf ? 'bg-red-50' : 'bg-surface-container-low'}`}
                                                            onClick={() => handleView(ticket)}
                                                        >
                                                            {isPdf ? (
                                                                <div className="flex flex-col items-center gap-1 text-red-400">
                                                                    <MIcon name="picture_as_pdf" size={40} />
                                                                    <span className="text-xs font-medium">PDF</span>
                                                                </div>
                                                            ) : preview ? (
                                                                <img src={preview} alt={ticket.filename} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="animate-pulse w-8 h-8 rounded-full bg-surface-variant" />
                                                            )}
                                                            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                                                <div className="bg-black/50 rounded-full p-2">
                                                                    <MIcon name="zoom_in" className="text-white text-xl" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Footer */}
                                                        <div className={`px-3 py-2 ${ticket.invoiced ? 'bg-success/5' : 'bg-white'}`}>
                                                            <p className="text-xs text-on-surface-variant">{new Date(ticket.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                            <div className="flex items-center justify-between mt-1.5">
                                                                <div className="flex items-center gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        role="switch"
                                                                        aria-checked={ticket.invoiced}
                                                                        disabled={togglingId === ticket.id}
                                                                        onClick={() => handleToggleInvoiced(ticket)}
                                                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${ticket.invoiced ? 'bg-success' : 'bg-surface-variant'}`}
                                                                    >
                                                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${ticket.invoiced ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                                                                    </button>
                                                                    <span className={`text-[11px] font-semibold ${ticket.invoiced ? 'text-success' : 'text-on-surface-variant'}`}>
                                                                        {togglingId === ticket.id ? '…' : ticket.invoiced ? 'Facturado' : 'Sin factura'}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setConfirmDeleteId(ticket.id)}
                                                                    className="p-1 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/8 transition-colors"
                                                                    title="Eliminar"
                                                                >
                                                                    <MIcon name="delete" className="text-base leading-none" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {fileError && (
                    <div className="mx-6 mb-4 flex items-center gap-2 text-sm text-error bg-error/8 px-4 py-2.5 rounded-xl">
                        <MIcon name="error" className="text-base flex-shrink-0" />
                        {fileError}
                    </div>
                )}
            </Modal>

            {/* Modal: ingresar referencia de pedido antes de subir */}
            {pendingFile && (
                <Modal
                    open
                    onClose={() => { setPendingFile(null); setOrderRefInput(''); }}
                    title="Subir ticket"
                    maxWidth="max-w-sm"
                    footer={
                        <>
                            <Button variant="neutral" onClick={() => { setPendingFile(null); setOrderRefInput(''); }} disabled={uploading}>
                                Cancelar
                            </Button>
                            <Button variant="filled" icon="upload" onClick={handleUploadConfirm} disabled={uploading}>
                                {uploading ? 'Subiendo…' : 'Confirmar'}
                            </Button>
                        </>
                    }
                >
                    <div className="p-6 space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${pendingFile.file.type === 'application/pdf' ? 'bg-red-50' : 'bg-blue-50'}`}>
                                <MIcon
                                    name={pendingFile.file.type === 'application/pdf' ? 'picture_as_pdf' : 'image'}
                                    className={pendingFile.file.type === 'application/pdf' ? 'text-red-400' : 'text-blue-400'}
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-on-background truncate">{pendingFile.file.name}</p>
                                <p className="text-xs text-on-surface-variant">{formatSize(pendingFile.file.size)}</p>
                            </div>
                        </div>
                        <Field label="Número o referencia de pedido (opcional)">
                            <Input
                                value={orderRefInput}
                                onChange={e => setOrderRefInput(e.target.value)}
                                placeholder="Ej. 1042, Sem-23, etc."
                                autoFocus
                            />
                        </Field>
                    </div>
                </Modal>
            )}

            {/* Confirmar eliminar ticket */}
            {confirmDeleteId && (
                <Modal
                    open
                    onClose={() => setConfirmDeleteId(null)}
                    title="Eliminar ticket"
                    maxWidth="max-w-sm"
                    footer={
                        <>
                            <Button variant="neutral" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>Cancelar</Button>
                            <Button variant="danger" icon="delete" onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Eliminando…' : 'Eliminar'}
                            </Button>
                        </>
                    }
                >
                    <div className="p-6 text-on-surface">
                        ¿Eliminar este ticket? Esta acción no se puede deshacer.
                    </div>
                </Modal>
            )}

            {/* Visor de imagen */}
            {viewingContent && (
                <div
                    className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setViewingContent(null)}
                >
                    <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
                        <button
                            className="absolute -top-10 right-0 text-white flex items-center gap-1 text-sm hover:opacity-80"
                            onClick={() => setViewingContent(null)}
                        >
                            <MIcon name="close" /> Cerrar
                        </button>
                        <img
                            src={viewingContent}
                            alt={viewingFilename ?? 'Ticket'}
                            className="w-full rounded-xl object-contain max-h-[80vh]"
                        />
                        <p className="text-center text-white/70 text-xs mt-2">{viewingFilename}</p>
                    </div>
                </div>
            )}
        </>
    );
};

// ---------- Fila de proveedor ----------
const SupplierRow: React.FC<{
    supplier: Supplier;
    onEdit: (s: Supplier) => void;
    onDelete: (s: Supplier) => void;
    onTickets: (s: Supplier) => void;
    onMap: (s: Supplier) => void;
}> = ({ supplier, onEdit, onDelete, onTickets, onMap }) => (
    <div className="bg-white rounded-xl border border-surface-variant shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <MIcon name="local_shipping" className="text-primary" fill />
        </div>
        <div className="flex-1 min-w-0">
            <p className="font-epilogue font-semibold text-on-background truncate">{supplier.name}</p>
            <div className="flex gap-3 text-sm text-on-surface-variant mt-0.5 flex-wrap">
                {supplier.contact && (
                    <span className="flex items-center gap-1">
                        <MIcon name="person" className="text-sm" />
                        {supplier.contact}
                    </span>
                )}
                {supplier.phone && (
                    <span className="flex items-center gap-1">
                        <MIcon name="phone" className="text-sm" />
                        {supplier.phone}
                    </span>
                )}
                {supplier.address && (
                    <span className="flex items-center gap-1 truncate max-w-[200px]">
                        <MIcon name="location_on" className="text-sm flex-shrink-0" />
                        {supplier.address}
                    </span>
                )}
            </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
            <Button variant="tonal" size="sm" icon="receipt_long" onClick={() => onTickets(supplier)}>
                Tickets
            </Button>
            {supplier.address && (
                <Button variant="tonal" size="sm" icon="location_on" onClick={() => onMap(supplier)} />
            )}
            {supplier.name !== 'Sin Proveedor' && (
                <>
                    <Button variant="tonal" size="sm" icon="edit" onClick={() => onEdit(supplier)}>
                        Editar
                    </Button>
                    <Button
                        variant="text"
                        size="sm"
                        icon="delete"
                        className="text-error hover:bg-error/8"
                        onClick={() => onDelete(supplier)}
                    />
                </>
            )}
        </div>
    </div>
);

// ---------- Vista principal ----------
const SuppliersView: React.FC<SuppliersViewProps> = ({ authToken, onAuthError }) => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [ticketsSupplier, setTicketsSupplier] = useState<Supplier | null>(null);
    const [mapSupplier, setMapSupplier] = useState<Supplier | null>(null);
    const toast = useToast();

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await getSuppliers(authToken);
                if (!cancelled) setSuppliers(data);
            } catch (err) {
                if (err instanceof AuthError) { onAuthError(); return; }
                if (!cancelled) toast('error', err instanceof Error ? err.message : 'Error al cargar proveedores');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [authToken]);

    const handleSave = async (data: { name: string; contact: string; phone: string; zones: string[]; address: string }) => {
        const isNew = editing === 'new';
        try {
            if (isNew) {
                const created = await createSupplier(authToken, data);
                setSuppliers(prev => [...prev, created]);
                toast('success', `${data.name} agregado`);
            } else {
                const updated = await updateSupplier(authToken, (editing as Supplier).id, data);
                setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s));
                toast('success', `${data.name} actualizado`);
            }
            setEditing(null);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al guardar');
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        setDeleting(true);
        try {
            await deleteSupplier(authToken, confirmDelete.id);
            setSuppliers(prev => prev.filter(s => s.id !== confirmDelete.id));
            toast('success', `${confirmDelete.name} eliminado`);
            setConfirmDelete(null);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al eliminar');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 pb-28 md:pb-10">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-epilogue text-3xl font-bold text-on-background">Proveedores</h1>
                    <p className="text-on-surface-variant mt-0.5">
                        {isLoading ? 'Cargando…' : suppliers.length === 0 ? 'Sin proveedores' : `${suppliers.length} proveedor${suppliers.length !== 1 ? 'es' : ''}`}
                    </p>
                </div>
                <Button variant="filled" icon="add" onClick={() => setEditing('new')}>
                    Nuevo proveedor
                </Button>
            </div>

            {isLoading && (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
                </div>
            )}

            {!isLoading && suppliers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <MIcon name="local_shipping" size={40} className="text-primary" fill />
                    </div>
                    <h2 className="font-epilogue text-xl font-bold text-on-background">Sin proveedores</h2>
                    <p className="text-on-surface-variant mt-1 mb-6 max-w-sm">
                        Agrega tus proveedores para asignarlos a los artículos del catálogo.
                    </p>
                    <Button variant="filled" icon="add" onClick={() => setEditing('new')}>
                        Agregar proveedor
                    </Button>
                </div>
            )}

            {!isLoading && suppliers.length > 0 && (
                <div className="space-y-3">
                    {suppliers.map(s => (
                        <SupplierRow
                            key={s.id}
                            supplier={s}
                            onEdit={setEditing}
                            onDelete={setConfirmDelete}
                            onTickets={setTicketsSupplier}
                            onMap={setMapSupplier}
                        />
                    ))}
                </div>
            )}

            {editing !== null && (
                <SupplierEditModal
                    supplier={editing}
                    onClose={() => setEditing(null)}
                    onSave={handleSave}
                />
            )}

            {confirmDelete && (
                <Modal
                    open
                    onClose={() => setConfirmDelete(null)}
                    title="Eliminar proveedor"
                    maxWidth="max-w-sm"
                    footer={
                        <>
                            <Button variant="neutral" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancelar</Button>
                            <Button variant="danger" icon="delete" onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Eliminando…' : 'Eliminar'}
                            </Button>
                        </>
                    }
                >
                    <div className="p-6 text-on-surface">
                        ¿Eliminar <strong>{confirmDelete.name}</strong>? Esta acción no se puede deshacer.
                    </div>
                </Modal>
            )}

            {ticketsSupplier && (
                <SupplierTicketsModal
                    supplier={ticketsSupplier}
                    authToken={authToken}
                    onClose={() => setTicketsSupplier(null)}
                    onAuthError={onAuthError}
                />
            )}

            {mapSupplier && (
                <SupplierMapModal
                    supplier={mapSupplier}
                    onClose={() => setMapSupplier(null)}
                />
            )}
        </main>
    );
};

export default SuppliersView;
