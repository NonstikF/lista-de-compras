import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { InventoryItem, InventoryMovement } from '../../types';
import {
    AuthError,
    getInventory,
    updateInventoryItem,
    addInventoryMovement,
    getInventoryMovements,
} from '../../services/api';
import { Modal, Button, Field, Input, MIcon, Chip, useToast } from '../ui';

interface InventoryViewProps {
    authToken: string;
    onAuthError: () => void;
}

type SortKey = 'name' | 'stock-asc' | 'stock-desc' | 'category';
type StockFilter = 'all' | 'low' | 'out';
const PREFS_KEY = 'inventory:prefs:v1';

interface Prefs {
    sort: SortKey;
    stockFilter: StockFilter;
    category: string | null;
}

const loadPrefs = (): Prefs => {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) return { sort: 'name', stockFilter: 'all', category: null, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { sort: 'name', stockFilter: 'all', category: null };
};

const savePrefs = (p: Prefs) => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
};

// ---------- Modal editar item ----------
const EditItemModal: React.FC<{
    item: InventoryItem;
    onClose: () => void;
    onSave: (data: { stockMin: number; unit: string }) => Promise<void>;
}> = ({ item, onClose, onSave }) => {
    const [stockMin, setStockMin] = useState(String(item.stockMin));
    const [unit, setUnit] = useState(item.unit);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (isNaN(Number(stockMin)) || Number(stockMin) < 0) e.stockMin = 'Stock mínimo inválido';
        if (!unit.trim()) e.unit = 'Requerido';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            await onSave({ stockMin: Number(stockMin), unit: unit.trim() });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={`Editar: ${item.article.name}`}
            maxWidth="max-w-sm"
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
                <Field label="Stock mínimo" error={errors.stockMin}>
                    <Input value={stockMin} onChange={e => { setStockMin(e.target.value); setErrors(x => ({ ...x, stockMin: '' })); }} type="number" min="0" step="any" autoFocus />
                </Field>
                <Field label="Unidad" error={errors.unit}>
                    <Input value={unit} onChange={e => { setUnit(e.target.value); setErrors(x => ({ ...x, unit: '' })); }} placeholder="ej: kg, litros, unidad" />
                </Field>
            </form>
        </Modal>
    );
};

// ---------- Modal movimiento ----------
const MovementModal: React.FC<{
    item: InventoryItem;
    type: 'entrada' | 'salida' | 'ajuste';
    onClose: () => void;
    onSave: (data: { type: 'entrada' | 'salida' | 'ajuste'; quantity: number; reason: string }) => Promise<void>;
}> = ({ item, type, onClose, onSave }) => {
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const typeLabel = type === 'entrada' ? 'Entrada' : type === 'salida' ? 'Salida' : 'Ajuste';
    const typeIcon = type === 'entrada' ? 'add_circle' : type === 'salida' ? 'remove_circle' : 'tune';
    const typeColor = type === 'entrada' ? 'text-green-600' : type === 'salida' ? 'text-red-500' : 'text-blue-500';
    const typeBg = type === 'entrada' ? 'bg-green-50' : type === 'salida' ? 'bg-red-50' : 'bg-blue-50';

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) e.quantity = 'Ingresa una cantidad positiva';
        if (type === 'salida' && Number(quantity) > item.stock) e.quantity = `Solo hay ${item.stock} ${item.unit} disponibles`;
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            await onSave({ type, quantity: Number(quantity), reason: reason.trim() });
        } finally {
            setSaving(false);
        }
    };

    const previewStock = (() => {
        const n = Number(quantity);
        if (isNaN(n) || n <= 0) return null;
        if (type === 'entrada') return item.stock + n;
        if (type === 'salida') return Math.max(0, item.stock - n);
        return n;
    })();

    const reasonSuggestions = type === 'entrada'
        ? ['Compra semanal', 'Reposición', 'Devolución']
        : type === 'salida'
            ? ['Uso diario', 'Merma', 'Caducado', 'Roto']
            : ['Conteo físico', 'Corrección'];

    return (
        <Modal
            open
            onClose={onClose}
            title={`${typeLabel}: ${item.article.name}`}
            maxWidth="max-w-sm"
            footer={
                <>
                    <Button variant="neutral" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button variant="filled" icon={typeIcon} onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Guardando…' : typeLabel}
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                <div className={`flex items-center gap-3 p-3 rounded-xl ${typeBg}`}>
                    <span className={`material-symbols-outlined text-2xl ${typeColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                        {typeIcon}
                    </span>
                    <div className="text-sm flex-1">
                        <div className="text-on-surface-variant">Stock actual</div>
                        <div className="font-bold text-on-background text-base">{item.stock} {item.unit}</div>
                    </div>
                    {previewStock !== null && (
                        <div className="text-sm text-right">
                            <div className="text-on-surface-variant">Quedará</div>
                            <div className={`font-bold text-base ${typeColor}`}>{previewStock} {item.unit}</div>
                        </div>
                    )}
                </div>

                <Field label={type === 'ajuste' ? 'Nuevo stock total' : 'Cantidad'} error={errors.quantity}>
                    <Input
                        value={quantity}
                        onChange={e => { setQuantity(e.target.value); setErrors(x => ({ ...x, quantity: '' })); }}
                        type="number"
                        min="0"
                        step="any"
                        autoFocus
                        placeholder="0"
                        inputMode="decimal"
                    />
                </Field>

                <Field label="Motivo (opcional)">
                    <Input
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder={`ej: ${reasonSuggestions[0]}`}
                        list={`reasons-${type}`}
                    />
                    <datalist id={`reasons-${type}`}>
                        {reasonSuggestions.map(r => <option key={r} value={r} />)}
                    </datalist>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        {reasonSuggestions.map(r => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setReason(r)}
                                className="text-xs px-2 py-1 rounded-full bg-surface-container-low border border-outline-variant text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition"
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </Field>
            </form>
        </Modal>
    );
};

// ---------- Modal historial ----------
const HistoryModal: React.FC<{
    item: InventoryItem;
    onClose: () => void;
    movements: InventoryMovement[];
    loading: boolean;
}> = ({ item, onClose, movements, loading }) => {
    const typeLabel = (t: string) => t === 'entrada' ? 'Entrada' : t === 'salida' ? 'Salida' : 'Ajuste';
    const typeColor = (t: string) => t === 'entrada' ? 'text-green-600' : t === 'salida' ? 'text-red-500' : 'text-blue-500';
    const typeIcon = (t: string) => t === 'entrada' ? 'add_circle' : t === 'salida' ? 'remove_circle' : 'tune';

    return (
        <Modal
            open
            onClose={onClose}
            title={`Historial: ${item.article.name}`}
            maxWidth="max-w-lg"
            footer={<Button variant="neutral" onClick={onClose}>Cerrar</Button>}
        >
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-on-surface-variant">
                        <MIcon name="progress_activity" className="animate-spin mr-2" /> Cargando…
                    </div>
                ) : movements.length === 0 ? (
                    <div className="text-center py-8 text-on-surface-variant">
                        <MIcon name="history" size={40} className="mb-2 opacity-40" />
                        <p>Sin movimientos registrados</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {movements.map(m => (
                            <div key={m.id} className="flex items-start gap-3 py-2 border-b border-surface-variant last:border-0">
                                <span className={`material-symbols-outlined text-xl mt-0.5 ${typeColor(m.type)}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                                    {typeIcon(m.type)}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-semibold ${typeColor(m.type)}`}>{typeLabel(m.type)}</span>
                                        <span className="text-sm font-bold text-on-background">{m.quantity} {item.unit}</span>
                                    </div>
                                    {m.reason && <p className="text-xs text-on-surface-variant truncate">{m.reason}</p>}
                                    <p className="text-xs text-on-surface-variant mt-0.5">
                                        {m.userName} · {new Date(m.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
};

// ---------- Skeleton ----------
const SkeletonRow: React.FC = () => (
    <div className="bg-white border border-surface-variant rounded-xl px-4 py-3 flex items-center gap-3 animate-pulse">
        <div className="w-10 h-10 rounded-lg bg-surface-container shrink-0" />
        <div className="flex-1 space-y-2">
            <div className="h-3 bg-surface-container rounded w-1/2" />
            <div className="h-3 bg-surface-container rounded w-1/4" />
        </div>
        <div className="hidden md:flex gap-1">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="w-8 h-8 rounded-full bg-surface-container" />)}
        </div>
    </div>
);

// ---------- Stat card ----------
const StatCard: React.FC<{
    icon: string;
    label: string;
    value: number;
    tone: 'neutral' | 'warning' | 'danger';
    active?: boolean;
    onClick?: () => void;
}> = ({ icon, label, value, tone, active, onClick }) => {
    const tones = {
        neutral: { bg: 'bg-white', icon: 'text-primary', border: 'border-surface-variant', activeBorder: 'border-primary ring-2 ring-primary/20' },
        warning: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-200', activeBorder: 'border-amber-500 ring-2 ring-amber-500/20' },
        danger:  { bg: 'bg-red-50',   icon: 'text-red-600',   border: 'border-red-200',   activeBorder: 'border-red-500 ring-2 ring-red-500/20' },
    }[tone];
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition ${tones.bg} ${
                active ? tones.activeBorder : tones.border
            } ${onClick ? 'hover:shadow-sm cursor-pointer' : 'cursor-default'}`}
        >
            <div className={`w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center ${tones.icon}`}>
                <MIcon name={icon} fill />
            </div>
            <div className="min-w-0">
                <div className="text-2xl font-bold text-on-background leading-none">{value}</div>
                <div className="text-xs text-on-surface-variant mt-1 truncate">{label}</div>
            </div>
        </button>
    );
};

// ---------- Vista principal ----------
const InventoryView: React.FC<InventoryViewProps> = ({ authToken, onAuthError }) => {
    const toast = useToast();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [movementItem, setMovementItem] = useState<{ item: InventoryItem; type: 'entrada' | 'salida' | 'ajuste' } | null>(null);
    const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [movementsLoading, setMovementsLoading] = useState(false);

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const initialPrefs = useMemo(loadPrefs, []);
    const [sort, setSort] = useState<SortKey>(initialPrefs.sort);
    const [stockFilter, setStockFilter] = useState<StockFilter>(initialPrefs.stockFilter);
    const [categoryFilter, setCategoryFilter] = useState<string | null>(initialPrefs.category);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 180);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        savePrefs({ sort, stockFilter, category: categoryFilter });
    }, [sort, stockFilter, categoryFilter]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchRef.current?.focus();
                searchRef.current?.select();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const load = async () => {
        try {
            setLoading(true);
            setItems(await getInventory(authToken));
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', 'Error al cargar inventario');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const categories = useMemo(() => {
        const set = new Set<string>();
        items.forEach(i => { if (i.article.category) set.add(i.article.category); });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [items]);

    const stats = useMemo(() => {
        const total = items.length;
        const out = items.filter(i => i.stock <= 0).length;
        const low = items.filter(i => i.stock > 0 && i.stock <= i.stockMin).length;
        return { total, low, out };
    }, [items]);

    const filtered = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        let list = items.filter(i => {
            if (categoryFilter && i.article.category !== categoryFilter) return false;
            if (stockFilter === 'low' && !(i.stock > 0 && i.stock <= i.stockMin)) return false;
            if (stockFilter === 'out' && i.stock > 0) return false;
            if (q) {
                const hay = `${i.article.name} ${i.article.category || ''} ${i.unit}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
        list = list.slice().sort((a, b) => {
            switch (sort) {
                case 'stock-asc':  return a.stock - b.stock || a.article.name.localeCompare(b.article.name);
                case 'stock-desc': return b.stock - a.stock || a.article.name.localeCompare(b.article.name);
                case 'category':   return (a.article.category || '').localeCompare(b.article.category || '') || a.article.name.localeCompare(b.article.name);
                default:           return a.article.name.localeCompare(b.article.name);
            }
        });
        return list;
    }, [items, debouncedSearch, sort, stockFilter, categoryFilter]);

    const handleEdit = async (data: { stockMin: number; unit: string }) => {
        if (!editingItem) return;
        try {
            const updated = await updateInventoryItem(authToken, editingItem.id, data);
            setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
            setEditingItem(null);
            toast('success', 'Insumo actualizado');
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al actualizar');
            throw err;
        }
    };

    const handleMovement = async (data: { type: 'entrada' | 'salida' | 'ajuste'; quantity: number; reason: string }) => {
        if (!movementItem) return;
        try {
            await addInventoryMovement(authToken, movementItem.item.id, data);
            await load();
            setMovementItem(null);
            const label = data.type === 'entrada' ? 'Entrada' : data.type === 'salida' ? 'Salida' : 'Ajuste';
            toast('success', `${label} registrada`);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al registrar movimiento');
            throw err;
        }
    };

    const openHistory = async (item: InventoryItem) => {
        setHistoryItem(item);
        setMovements([]);
        setMovementsLoading(true);
        try {
            setMovements(await getInventoryMovements(authToken, item.id));
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', 'Error al cargar historial');
        } finally {
            setMovementsLoading(false);
        }
    };

    const hasFilters = !!debouncedSearch || stockFilter !== 'all' || categoryFilter !== null;

    const clearFilters = () => {
        setSearch('');
        setStockFilter('all');
        setCategoryFilter(null);
    };

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-28 md:pb-10">
            {/* Header */}
            <div className="flex items-start justify-between mb-5 gap-3">
                <div>
                    <h1 className="font-epilogue text-2xl md:text-3xl font-bold text-on-background">Inventario</h1>
                    <p className="text-on-surface-variant text-sm mt-0.5">Control de insumos de cafetería</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4">
                <StatCard
                    icon="inventory_2"
                    label="Total insumos"
                    value={stats.total}
                    tone="neutral"
                    active={stockFilter === 'all' && !categoryFilter}
                    onClick={() => { setStockFilter('all'); setCategoryFilter(null); }}
                />
                <StatCard
                    icon="warning"
                    label="Stock bajo"
                    value={stats.low}
                    tone="warning"
                    active={stockFilter === 'low'}
                    onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
                />
                <StatCard
                    icon="error"
                    label="Agotado"
                    value={stats.out}
                    tone="danger"
                    active={stockFilter === 'out'}
                    onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')}
                />
            </div>

            {/* Search + sort */}
            <div className="flex flex-col md:flex-row gap-2 mb-3 sticky top-0 z-10 bg-background py-2 -mx-4 md:-mx-6 px-4 md:px-6">
                <div className="relative flex-1">
                    <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                        ref={searchRef}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') setSearch(''); }}
                        placeholder="Buscar insumo… (Ctrl+K)"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white outline-none text-sm transition"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-on-surface-variant hover:bg-surface-container"
                            title="Limpiar"
                        >
                            <MIcon name="close" className="text-base" />
                        </button>
                    )}
                </div>
                <select
                    value={sort}
                    onChange={e => setSort(e.target.value as SortKey)}
                    className="px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm text-on-surface transition md:w-48"
                    title="Ordenar"
                >
                    <option value="name">Nombre A-Z</option>
                    <option value="stock-asc">Stock: menor primero</option>
                    <option value="stock-desc">Stock: mayor primero</option>
                    <option value="category">Por categoría</option>
                </select>
            </div>

            {/* Category chips */}
            {categories.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-thin">
                    <Chip
                        active={categoryFilter === null}
                        onClick={() => setCategoryFilter(null)}
                    >
                        Todas
                    </Chip>
                    {categories.map(c => (
                        <Chip
                            key={c}
                            active={categoryFilter === c}
                            onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
                        >
                            {c}
                        </Chip>
                    ))}
                </div>
            )}

            {/* Active filters bar */}
            {hasFilters && !loading && (
                <div className="flex items-center justify-between mb-3 text-sm text-on-surface-variant">
                    <span>{filtered.length} de {items.length} resultados</span>
                    <button
                        onClick={clearFilters}
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                        <MIcon name="close" className="text-base" /> Limpiar filtros
                    </button>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-16 text-on-surface-variant bg-white border border-dashed border-outline-variant rounded-2xl">
                    <MIcon name="inventory" size={48} className="mb-3 opacity-40" />
                    <p className="font-semibold text-on-surface">Aún no hay artículos</p>
                    <p className="text-sm mt-1">Crea artículos en el módulo de Artículos para que aparezcan aquí.</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant bg-white border border-dashed border-outline-variant rounded-2xl">
                    <MIcon name="search_off" size={40} className="mb-2 opacity-40" />
                    <p className="font-semibold text-on-surface">Sin resultados</p>
                    {debouncedSearch && <p className="text-sm mt-1">No se encontraron insumos para "{debouncedSearch}"</p>}
                    <button onClick={clearFilters} className="mt-3 text-sm text-primary hover:underline font-medium">
                        Limpiar filtros
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(item => {
                        const isOut = item.stock <= 0;
                        const isLow = !isOut && item.stock <= item.stockMin;
                        const stockPct = item.stockMin > 0 ? Math.min(100, (item.stock / (item.stockMin * 2)) * 100) : 100;
                        const stockBar = isOut ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-green-500';

                        return (
                            <div
                                key={item.id}
                                className={`bg-white border rounded-xl px-3 md:px-4 py-3 transition hover:shadow-sm ${
                                    isOut ? 'border-red-200' : isLow ? 'border-amber-200' : 'border-surface-variant'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    {item.article.image ? (
                                        <img src={item.article.image} alt={item.article.name} className="w-11 h-11 rounded-lg object-cover shrink-0" />
                                    ) : (
                                        <div className="w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
                                            <MIcon name="inventory_2" className="text-on-surface-variant" />
                                        </div>
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-on-background truncate">{item.article.name}</span>
                                            {item.article.category && (
                                                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-bold">
                                                    {item.article.category}
                                                </span>
                                            )}
                                            {isOut && (
                                                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold flex items-center gap-0.5">
                                                    <MIcon name="error" size={12} className="inline" /> Agotado
                                                </span>
                                            )}
                                            {isLow && (
                                                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold flex items-center gap-0.5">
                                                    <MIcon name="warning" size={12} className="inline" /> Bajo
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-sm">
                                            <span className={`font-bold ${isOut ? 'text-red-600' : isLow ? 'text-amber-700' : 'text-on-background'}`}>
                                                {item.stock} {item.unit}
                                            </span>
                                            <span className="text-on-surface-variant text-xs">mín: {item.stockMin} {item.unit}</span>
                                        </div>
                                        {item.stockMin > 0 && (
                                            <div className="mt-1.5 h-1 rounded-full bg-surface-container overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${stockBar}`} style={{ width: `${stockPct}%` }} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-0.5 shrink-0">
                                        <button
                                            onClick={() => setMovementItem({ item, type: 'entrada' })}
                                            title="Registrar entrada"
                                            className="p-2 md:p-2.5 rounded-full text-green-600 hover:bg-green-50 active:scale-95 transition"
                                        >
                                            <MIcon name="add_circle" fill />
                                        </button>
                                        <button
                                            onClick={() => setMovementItem({ item, type: 'salida' })}
                                            title="Registrar salida"
                                            className="p-2 md:p-2.5 rounded-full text-red-500 hover:bg-red-50 active:scale-95 transition"
                                        >
                                            <MIcon name="remove_circle" fill />
                                        </button>
                                        <div className="hidden md:flex items-center gap-0.5">
                                            <button
                                                onClick={() => setMovementItem({ item, type: 'ajuste' })}
                                                title="Ajustar stock"
                                                className="p-2.5 rounded-full text-blue-500 hover:bg-blue-50 active:scale-95 transition"
                                            >
                                                <MIcon name="tune" />
                                            </button>
                                            <button
                                                onClick={() => openHistory(item)}
                                                title="Ver historial"
                                                className="p-2.5 rounded-full text-on-surface-variant hover:bg-surface-container-low active:scale-95 transition"
                                            >
                                                <MIcon name="history" />
                                            </button>
                                            <button
                                                onClick={() => setEditingItem(item)}
                                                title="Editar"
                                                className="p-2.5 rounded-full text-on-surface-variant hover:bg-surface-container-low active:scale-95 transition"
                                            >
                                                <MIcon name="edit" />
                                            </button>
                                        </div>
                                        <MobileMoreMenu
                                            item={item}
                                            onAjuste={() => setMovementItem({ item, type: 'ajuste' })}
                                            onHistory={() => openHistory(item)}
                                            onEdit={() => setEditingItem(item)}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {editingItem && (
                <EditItemModal
                    item={editingItem}
                    onClose={() => setEditingItem(null)}
                    onSave={handleEdit}
                />
            )}

            {movementItem && (
                <MovementModal
                    item={movementItem.item}
                    type={movementItem.type}
                    onClose={() => setMovementItem(null)}
                    onSave={handleMovement}
                />
            )}

            {historyItem && (
                <HistoryModal
                    item={historyItem}
                    onClose={() => setHistoryItem(null)}
                    movements={movements}
                    loading={movementsLoading}
                />
            )}

        </div>
    );
};

// ---------- Mobile more menu ----------
const MobileMoreMenu: React.FC<{
    item: InventoryItem;
    onAjuste: () => void;
    onHistory: () => void;
    onEdit: () => void;
}> = ({ onAjuste, onHistory, onEdit }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    return (
        <div ref={ref} className="md:hidden relative">
            <button
                onClick={() => setOpen(o => !o)}
                title="Más"
                className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low active:scale-95 transition"
            >
                <MIcon name="more_vert" />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-white border border-outline-variant rounded-xl shadow-xl overflow-hidden">
                    <button onClick={() => { onAjuste(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-low text-left">
                        <MIcon name="tune" className="text-blue-500" /> Ajustar stock
                    </button>
                    <button onClick={() => { onHistory(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-low text-left">
                        <MIcon name="history" /> Historial
                    </button>
                    <button onClick={() => { onEdit(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-low text-left">
                        <MIcon name="edit" /> Editar
                    </button>
                </div>
            )}
        </div>
    );
};

export default InventoryView;
