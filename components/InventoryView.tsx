import React, { useState, useEffect } from 'react';
import type { InventoryItem, InventoryMovement, Article } from '../types';
import {
    AuthError,
    getInventory,
    createInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    addInventoryMovement,
    getInventoryMovements,
    getArticles,
} from '../services/catalogService';
import { Modal, Button, Field, Input, MIcon, useToast } from './ui';

interface InventoryViewProps {
    authToken: string;
    onAuthError: () => void;
}

// ---------- Modal agregar insumo ----------
const AddItemModal: React.FC<{
    articles: Article[];
    onClose: () => void;
    onSave: (data: { articleId: string; stock: number; stockMin: number; unit: string }) => Promise<void>;
}> = ({ articles, onClose, onSave }) => {
    const [articleId, setArticleId] = useState('');
    const [stock, setStock] = useState('0');
    const [stockMin, setStockMin] = useState('0');
    const [unit, setUnit] = useState('unidad');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!articleId) e.articleId = 'Selecciona un artículo';
        if (isNaN(Number(stock)) || Number(stock) < 0) e.stock = 'Stock inválido';
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
            await onSave({ articleId, stock: Number(stock), stockMin: Number(stockMin), unit: unit.trim() });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title="Agregar insumo al inventario"
            maxWidth="max-w-md"
            footer={
                <>
                    <Button variant="neutral" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button variant="filled" icon="add_circle" onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Guardando…' : 'Agregar'}
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
                <Field label="Artículo" error={errors.articleId}>
                    <select
                        value={articleId}
                        onChange={e => { setArticleId(e.target.value); setErrors(x => ({ ...x, articleId: '' })); }}
                        className="w-full rounded-lg border border-outline px-3 py-2 text-sm bg-white text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                    >
                        <option value="">Seleccionar artículo…</option>
                        {articles.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Stock inicial" error={errors.stock}>
                        <Input value={stock} onChange={e => { setStock(e.target.value); setErrors(x => ({ ...x, stock: '' })); }} type="number" min="0" step="any" />
                    </Field>
                    <Field label="Stock mínimo" error={errors.stockMin}>
                        <Input value={stockMin} onChange={e => { setStockMin(e.target.value); setErrors(x => ({ ...x, stockMin: '' })); }} type="number" min="0" step="any" />
                    </Field>
                </div>
                <Field label="Unidad" error={errors.unit}>
                    <Input value={unit} onChange={e => { setUnit(e.target.value); setErrors(x => ({ ...x, unit: '' })); }} placeholder="ej: kg, litros, unidad" />
                </Field>
            </form>
        </Modal>
    );
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

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) e.quantity = 'Ingresa una cantidad positiva';
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
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
                <p className="text-sm text-on-surface-variant">
                    Stock actual: <strong className="text-on-background">{item.stock} {item.unit}</strong>
                </p>
                <Field label={type === 'ajuste' ? 'Nuevo stock' : 'Cantidad'} error={errors.quantity}>
                    <Input value={quantity} onChange={e => { setQuantity(e.target.value); setErrors(x => ({ ...x, quantity: '' })); }} type="number" min="0" step="any" autoFocus placeholder={`ej: 5`} />
                </Field>
                <Field label="Motivo (opcional)">
                    <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="ej: Compra semanal" />
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

// ---------- Vista principal ----------
const InventoryView: React.FC<InventoryViewProps> = ({ authToken, onAuthError }) => {
    const toast = useToast();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [availableArticles, setAvailableArticles] = useState<Article[]>([]);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [movementItem, setMovementItem] = useState<{ item: InventoryItem; type: 'entrada' | 'salida' | 'ajuste' } | null>(null);
    const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [movementsLoading, setMovementsLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

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

    const openAdd = async () => {
        try {
            const allArticles = await getArticles(authToken);
            const usedIds = new Set(items.map(i => i.articleId));
            setAvailableArticles(allArticles.filter(a => !usedIds.has(a.id)));
            setShowAdd(true);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', 'Error al cargar artículos');
        }
    };

    const handleAdd = async (data: { articleId: string; stock: number; stockMin: number; unit: string }) => {
        try {
            const item = await createInventoryItem(authToken, data);
            setItems(prev => [...prev, item].sort((a, b) => a.article.name.localeCompare(b.article.name)));
            setShowAdd(false);
            toast('success', `${item.article.name} agregado al inventario`);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al agregar insumo');
            throw err;
        }
    };

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

    const handleDelete = async (id: string) => {
        try {
            await deleteInventoryItem(authToken, id);
            setItems(prev => prev.filter(x => x.id !== id));
            setDeletingId(null);
            toast('success', 'Insumo eliminado');
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al eliminar');
        }
    };

    const itemToDelete = items.find(i => i.id === deletingId);

    return (
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 pb-28 md:pb-10">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-epilogue text-2xl md:text-3xl font-bold text-on-background">Inventario</h1>
                    <p className="text-on-surface-variant text-sm mt-0.5">Control de insumos de cafetería</p>
                </div>
                <Button variant="filled" icon="add_circle" onClick={openAdd}>
                    Agregar insumo
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16 text-on-surface-variant">
                    <MIcon name="progress_activity" className="animate-spin mr-2" />
                    Cargando…
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-16 text-on-surface-variant">
                    <MIcon name="inventory" size={48} className="mb-3 opacity-40" />
                    <p>No hay insumos en el inventario</p>
                    <p className="text-sm mt-1">Agrega el primer insumo con el botón de arriba</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {items.map(item => {
                        const isLow = item.stock <= item.stockMin;
                        return (
                            <div
                                key={item.id}
                                className="bg-white border border-surface-variant rounded-xl px-4 py-3 flex items-center gap-3"
                            >
                                {item.article.image ? (
                                    <img src={item.article.image} alt={item.article.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
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
                                        {isLow && (
                                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-error/10 text-error font-bold flex items-center gap-0.5">
                                                <MIcon name="warning" size={12} className="inline" /> Bajo
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-sm">
                                        <span className={`font-bold ${isLow ? 'text-error' : 'text-on-background'}`}>
                                            {item.stock} {item.unit}
                                        </span>
                                        <span className="text-on-surface-variant text-xs">mín: {item.stockMin} {item.unit}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => setMovementItem({ item, type: 'entrada' })}
                                        title="Registrar entrada"
                                        className="p-2 rounded-full text-green-600 hover:bg-green-50 transition-colors"
                                    >
                                        <MIcon name="add_circle" fill />
                                    </button>
                                    <button
                                        onClick={() => setMovementItem({ item, type: 'salida' })}
                                        title="Registrar salida"
                                        className="p-2 rounded-full text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <MIcon name="remove_circle" fill />
                                    </button>
                                    <button
                                        onClick={() => setMovementItem({ item, type: 'ajuste' })}
                                        title="Ajustar stock"
                                        className="p-2 rounded-full text-blue-500 hover:bg-blue-50 transition-colors"
                                    >
                                        <MIcon name="tune" />
                                    </button>
                                    <button
                                        onClick={() => openHistory(item)}
                                        title="Ver historial"
                                        className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors"
                                    >
                                        <MIcon name="history" />
                                    </button>
                                    <button
                                        onClick={() => setEditingItem(item)}
                                        title="Editar"
                                        className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors"
                                    >
                                        <MIcon name="edit" />
                                    </button>
                                    <button
                                        onClick={() => setDeletingId(item.id)}
                                        title="Eliminar"
                                        className="p-2 rounded-full text-on-surface-variant hover:bg-error-container/30 hover:text-error transition-colors"
                                    >
                                        <MIcon name="delete" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showAdd && (
                <AddItemModal
                    articles={availableArticles}
                    onClose={() => setShowAdd(false)}
                    onSave={handleAdd}
                />
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

            {deletingId && itemToDelete && (
                <Modal
                    open
                    onClose={() => setDeletingId(null)}
                    title="Eliminar insumo"
                    maxWidth="max-w-sm"
                    footer={
                        <>
                            <Button variant="neutral" onClick={() => setDeletingId(null)}>Cancelar</Button>
                            <Button variant="danger" icon="delete" onClick={() => handleDelete(deletingId)}>Eliminar</Button>
                        </>
                    }
                >
                    <p className="px-6 py-4 text-on-surface-variant">
                        ¿Eliminar <strong className="text-on-background">{itemToDelete.article.name}</strong> del inventario? Se perderá todo el historial de movimientos.
                    </p>
                </Modal>
            )}
        </div>
    );
};

export default InventoryView;
