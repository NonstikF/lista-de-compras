import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import type { Location, InventoryItem } from '../../types';
import {
    AuthError,
    getLocations,
    getLocation,
    createLocation,
    updateLocation,
    deleteLocation,
} from '../../services/api';
import { Modal, Button, Field, Input, Textarea, MIcon, Chip, useToast } from '../ui';

interface LocationsViewProps {
    authToken: string;
    onAuthError: () => void;
}

// ---------- Modal editar ubicación ----------
interface LocationForm {
    name: string;
    code: string;
    description: string;
    active: boolean;
}

const LocationEditModal: React.FC<{
    location: Location | 'new' | null;
    onClose: () => void;
    onSave: (data: LocationForm) => Promise<void>;
}> = ({ location, onClose, onSave }) => {
    const isNew = location === 'new';
    const l = location as Location;
    const initial: LocationForm = isNew
        ? { name: '', code: '', description: '', active: true }
        : { name: l.name, code: l.code, description: l.description, active: l.active };

    const [form, setForm] = useState<LocationForm>(initial);
    const [showAdvanced, setShowAdvanced] = useState<boolean>(!isNew && (l?.description?.length > 0 || !l?.active));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const update = <K extends keyof LocationForm>(k: K, v: LocationForm[K]) =>
        setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const err: Record<string, string> = {};
        const code = form.code.trim();
        if (!code) err.code = 'El SKU es requerido';
        if (code.length > 40) err.code = 'Máximo 40 caracteres';
        if (Object.keys(err).length) { setErrors(err); return; }

        setSaving(true);
        try {
            await onSave({
                name: form.name.trim() || code,
                code,
                description: form.description.trim(),
                active: form.active,
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={isNew ? 'Nueva ubicación' : 'Editar ubicación'}
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
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
                <Field label="SKU de ubicación" required hint="Lo que escribirás en los productos. Ej: A3, BODEGA-1." error={errors.code}>
                    <Input
                        value={form.code}
                        onChange={e => { update('code', e.target.value.toUpperCase()); setErrors(x => ({ ...x, code: '' })); }}
                        placeholder="A3"
                        autoFocus
                        maxLength={40}
                    />
                </Field>

                {!showAdvanced ? (
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(true)}
                        className="text-xs text-primary hover:underline font-medium"
                    >
                        + Mostrar opciones avanzadas (nombre, descripción, estado)
                    </button>
                ) : (
                    <>
                        <Field label="Nombre (opcional)" hint="Si lo dejas vacío se usa el SKU.">
                            <Input
                                value={form.name}
                                onChange={e => update('name', e.target.value)}
                                placeholder={form.code || 'Igual al SKU'}
                                maxLength={80}
                            />
                        </Field>
                        <Field label="Descripción (opcional)">
                            <Textarea
                                value={form.description}
                                onChange={e => update('description', e.target.value)}
                                placeholder="ej: Estante 3, segunda repisa"
                            />
                        </Field>
                        <Field label="Estado">
                            <label className="flex items-center gap-2 text-sm text-on-surface">
                                <input
                                    type="checkbox"
                                    checked={form.active}
                                    onChange={e => update('active', e.target.checked)}
                                    className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-2 focus:ring-primary/20"
                                />
                                Activa
                            </label>
                        </Field>
                    </>
                )}
            </form>
        </Modal>
    );
};

// ---------- Modal QR ----------
const QrLabelModal: React.FC<{
    location: Location;
    onClose: () => void;
}> = ({ location, onClose }) => {
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const labelRef = useRef<HTMLDivElement>(null);

    const deepLink = useMemo(() => {
        return `${window.location.origin}/l/${location.code}`;
    }, [location.code]);

    useEffect(() => {
        QRCode.toDataURL(deepLink, {
            errorCorrectionLevel: 'M',
            margin: 0,
            scale: 8,
            color: { dark: '#000000', light: '#ffffff' },
        }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
    }, [deepLink]);

    const handlePrint = () => {
        if (!qrDataUrl) return;
        const w = window.open('', '_blank', 'width=400,height=300');
        if (!w) return;
        const doc = w.document;
        doc.title = `Etiqueta ${location.code}`;

        const style = doc.createElement('style');
        style.textContent = `
@page { size: 2in 1in; margin: 0; }
html, body { margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.label { width: 2in; height: 1in; box-sizing: border-box; padding: 0.04in; display: flex; align-items: center; gap: 0.06in; }
.qr { width: 0.92in; height: 0.92in; flex-shrink: 0; }
.qr img { width: 100%; height: 100%; display: block; }
.txt { flex: 1; min-width: 0; overflow: hidden; }
.name { font-size: 11pt; font-weight: 700; line-height: 1.1; margin: 0; word-wrap: break-word; overflow-wrap: break-word; max-height: 0.55in; overflow: hidden; }
.code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 8pt; font-weight: 600; margin: 0.04in 0 0 0; color: #333; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;
        doc.head.appendChild(style);

        const labelEl = doc.createElement('div');
        labelEl.className = 'label';

        const qrWrap = doc.createElement('div');
        qrWrap.className = 'qr';
        const img = doc.createElement('img');
        img.src = qrDataUrl;
        img.alt = 'QR';
        qrWrap.appendChild(img);

        const txt = doc.createElement('div');
        txt.className = 'txt';
        const nameEl = doc.createElement('div');
        nameEl.className = 'name';
        nameEl.textContent = location.name;
        const codeEl = doc.createElement('div');
        codeEl.className = 'code';
        codeEl.textContent = location.code;
        txt.appendChild(nameEl);
        txt.appendChild(codeEl);

        labelEl.appendChild(qrWrap);
        labelEl.appendChild(txt);
        doc.body.appendChild(labelEl);

        // Wait for image to load before printing
        const triggerPrint = () => {
            w.focus();
            w.print();
            setTimeout(() => w.close(), 500);
        };
        if (img.complete) {
            triggerPrint();
        } else {
            img.onload = triggerPrint;
            img.onerror = triggerPrint;
        }
    };

    const handleDownload = () => {
        if (!qrDataUrl) return;
        const a = document.createElement('a');
        a.href = qrDataUrl;
        a.download = `qr-${location.code}.png`;
        a.click();
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={`Etiqueta: ${location.name}`}
            maxWidth="max-w-md"
            footer={
                <>
                    <Button variant="neutral" onClick={onClose}>Cerrar</Button>
                    <Button variant="outline" icon="download" onClick={handleDownload} disabled={!qrDataUrl}>
                        QR PNG
                    </Button>
                    <Button variant="filled" icon="print" onClick={handlePrint} disabled={!qrDataUrl}>
                        Imprimir
                    </Button>
                </>
            }
        >
            <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-on-surface-variant">
                    Vista previa de la etiqueta (2in × 1in). El QR abre la ubicación con sesión iniciada.
                </p>

                <div className="flex justify-center bg-surface-container-low rounded-xl p-6">
                    <div
                        ref={labelRef}
                        className="bg-white border border-outline-variant shadow-sm flex items-center gap-2 p-1"
                        style={{ width: '4in', height: '2in' }}
                    >
                        <div style={{ width: '1.84in', height: '1.84in', flexShrink: 0 }}>
                            {qrDataUrl ? (
                                <img src={qrDataUrl} alt="QR" style={{ width: '100%', height: '100%', display: 'block' }} />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-on-surface-variant text-xs">
                                    Generando…
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="font-bold text-on-background leading-tight break-words" style={{ fontSize: '22pt', maxHeight: '1.1in', overflow: 'hidden' }}>
                                {location.name}
                            </div>
                            <div className="font-mono font-semibold text-on-surface-variant mt-1" style={{ fontSize: '16pt' }}>
                                {location.code}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-surface-container-low rounded-xl px-4 py-3 text-xs text-on-surface-variant break-all">
                    <span className="font-semibold text-on-surface">URL del QR: </span>
                    {deepLink}
                </div>
            </div>
        </Modal>
    );
};

// ---------- Modal detalle (productos en ubicación) ----------
const LocationDetailModal: React.FC<{
    locationId: string;
    authToken: string;
    onClose: () => void;
    onAuthError: () => void;
}> = ({ locationId, authToken, onClose, onAuthError }) => {
    const toast = useToast();
    const [data, setData] = useState<(Location & { items: InventoryItem[] }) | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getLocation(authToken, locationId)
            .then(d => { if (!cancelled) setData(d); })
            .catch(err => {
                if (err instanceof AuthError) { onAuthError(); return; }
                toast('error', 'Error al cargar ubicación');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [locationId, authToken, onAuthError, toast]);

    return (
        <Modal
            open
            onClose={onClose}
            title={data ? `Productos en ${data.name}` : 'Cargando…'}
            maxWidth="max-w-2xl"
            footer={<Button variant="neutral" onClick={onClose}>Cerrar</Button>}
        >
            <div className="px-6 py-4">
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-on-surface-variant">
                        <MIcon name="progress_activity" className="animate-spin mr-2" /> Cargando…
                    </div>
                ) : !data || data.items.length === 0 ? (
                    <div className="text-center py-8 text-on-surface-variant">
                        <MIcon name="inventory_2" size={40} className="mb-2 opacity-40" />
                        <p>Sin productos asignados</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {data.items.map(item => (
                            <div key={item.id} className="flex items-center gap-3 px-3 py-2 bg-white rounded-xl border border-surface-variant">
                                {item.article.image ? (
                                    <img src={item.article.image} alt={item.article.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
                                        <MIcon name="inventory_2" className="text-on-surface-variant" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-on-background text-sm truncate">{item.article.name}</p>
                                    {item.article.category && (
                                        <p className="text-xs text-on-surface-variant">{item.article.category}</p>
                                    )}
                                </div>
                                <div className="shrink-0 text-right">
                                    <div className="text-base font-bold tabular-nums text-on-background">{item.stock}</div>
                                    <div className="text-xs text-on-surface-variant">{item.unit}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
};

// ---------- Vista principal ----------
const LocationsView: React.FC<LocationsViewProps> = ({ authToken, onAuthError }) => {
    const toast = useToast();
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Location | 'new' | null>(null);
    const [qrLocation, setQrLocation] = useState<Location | null>(null);
    const [detailId, setDetailId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [showInactive, setShowInactive] = useState(false);

    const load = async () => {
        try {
            setLoading(true);
            setLocations(await getLocations(authToken));
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', 'Error al cargar ubicaciones');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return locations.filter(l => {
            if (!showInactive && !l.active) return false;
            if (!q) return true;
            return `${l.name} ${l.code} ${l.description}`.toLowerCase().includes(q);
        });
    }, [locations, search, showInactive]);

    const handleSave = async (data: LocationForm) => {
        try {
            if (editing === 'new') {
                const created = await createLocation(authToken, data);
                setLocations(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
                toast('success', 'Ubicación creada');
            } else if (editing) {
                const updated = await updateLocation(authToken, editing.id, data);
                setLocations(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l));
                toast('success', 'Ubicación actualizada');
            }
            setEditing(null);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al guardar');
            throw err;
        }
    };

    const handleDelete = async (location: Location) => {
        const count = location._count?.items ?? 0;
        const msg = count > 0
            ? `Esta ubicación tiene ${count} producto${count !== 1 ? 's' : ''} asignado${count !== 1 ? 's' : ''}. Los productos quedarán sin ubicación. ¿Eliminar?`
            : `¿Eliminar la ubicación "${location.name}"?`;
        if (!window.confirm(msg)) return;
        try {
            await deleteLocation(authToken, location.id);
            setLocations(prev => prev.filter(l => l.id !== location.id));
            toast('success', 'Ubicación eliminada');
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al eliminar');
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-28 md:pb-10">
            <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
                <div>
                    <h1 className="font-epilogue text-2xl md:text-3xl font-bold text-on-background">Ubicaciones</h1>
                    <p className="text-on-surface-variant text-sm mt-0.5">Organiza los productos del inventario</p>
                </div>
                <Button variant="filled" icon="add" onClick={() => setEditing('new')}>
                    Nueva ubicación
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-2 mb-3">
                <div className="relative flex-1">
                    <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre o código…"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white outline-none text-sm transition"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-on-surface-variant hover:bg-surface-container">
                            <MIcon name="close" className="text-base" />
                        </button>
                    )}
                </div>
                <Chip active={showInactive} onClick={() => setShowInactive(v => !v)} icon="visibility">
                    Mostrar inactivas
                </Chip>
            </div>

            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white border border-surface-variant rounded-xl px-4 py-4 animate-pulse">
                            <div className="h-4 bg-surface-container rounded w-1/3 mb-2" />
                            <div className="h-3 bg-surface-container rounded w-1/5" />
                        </div>
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-on-surface-variant bg-white border border-dashed border-outline-variant rounded-2xl">
                    <MIcon name="location_on" size={48} className="mb-3 opacity-40" />
                    <p className="font-semibold text-on-surface">
                        {locations.length === 0 ? 'Aún no hay ubicaciones' : 'Sin resultados'}
                    </p>
                    {locations.length === 0 && (
                        <p className="text-sm mt-1">Crea tu primera ubicación para organizar el inventario.</p>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(location => (
                        <div
                            key={location.id}
                            className={`bg-white border rounded-xl px-4 py-3 transition hover:shadow-sm ${
                                location.active ? 'border-surface-variant' : 'border-surface-variant opacity-60'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <MIcon name="location_on" fill />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-on-background truncate">{location.name}</span>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-bold">
                                            {location.code}
                                        </span>
                                        {!location.active && (
                                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-bold">
                                                Inactiva
                                            </span>
                                        )}
                                    </div>
                                    {location.description && (
                                        <p className="text-xs text-on-surface-variant mt-0.5 truncate">{location.description}</p>
                                    )}
                                    <p className="text-xs text-on-surface-variant mt-0.5">
                                        {location._count?.items ?? 0} producto{(location._count?.items ?? 0) !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => setDetailId(location.id)}
                                        title="Ver productos"
                                        className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition"
                                    >
                                        <MIcon name="inventory_2" />
                                    </button>
                                    <button
                                        onClick={() => setQrLocation(location)}
                                        title="Imprimir etiqueta QR"
                                        className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition"
                                    >
                                        <MIcon name="qr_code_2" />
                                    </button>
                                    <button
                                        onClick={() => setEditing(location)}
                                        title="Editar"
                                        className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition"
                                    >
                                        <MIcon name="edit" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(location)}
                                        title="Eliminar"
                                        className="p-2 rounded-full text-on-surface-variant hover:bg-red-50 hover:text-red-600 transition"
                                    >
                                        <MIcon name="delete" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editing && (
                <LocationEditModal
                    location={editing}
                    onClose={() => setEditing(null)}
                    onSave={handleSave}
                />
            )}

            {qrLocation && (
                <QrLabelModal
                    location={qrLocation}
                    onClose={() => setQrLocation(null)}
                />
            )}

            {detailId && (
                <LocationDetailModal
                    locationId={detailId}
                    authToken={authToken}
                    onClose={() => setDetailId(null)}
                    onAuthError={onAuthError}
                />
            )}
        </div>
    );
};

export default LocationsView;
