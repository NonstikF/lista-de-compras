import React, { useState, useEffect, useRef } from 'react';
import type { Article, Supplier } from '../types';
import { AuthError, getArticles, createArticle, updateArticle, deleteArticle, getSuppliers } from '../services/catalogService';
import { Modal, Button, Field, Input, MIcon, fmt, useToast } from './ui';

interface ArticlesViewProps {
    authToken: string;
    onAuthError: () => void;
}

// ---------- Placeholder con iniciales ----------
const ArticleImage: React.FC<{ article: Article; className?: string }> = ({ article, className = '' }) => {
    const colors = ['#3b6934', '#7d562d', '#60233e', '#2d5a27', '#42493e', '#7c3a55'];
    const bg = colors[article.id.charCodeAt(0) % colors.length];
    const initials = article.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

    if (article.image) {
        return <img src={article.image} alt={article.name} className={`w-full aspect-square object-cover ${className}`} />;
    }
    return (
        <div
            className={`w-full aspect-square flex items-center justify-center font-epilogue font-bold text-white text-2xl relative overflow-hidden ${className}`}
            style={{ backgroundColor: bg }}
        >
            <div
                className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,.4) 6px, rgba(255,255,255,.4) 7px)' }}
            />
            <span className="relative">{initials}</span>
        </div>
    );
};

// ---------- Tarjeta de artículo ----------
const ArticleCard: React.FC<{
    article: Article;
    suppliers: Supplier[];
    onEdit: (a: Article) => void;
    onDelete: (a: Article) => void;
}> = ({ article, suppliers, onEdit, onDelete }) => {
    const articleSuppliers = suppliers.filter(s => article.supplierIds.includes(s.id));
    const visibleSuppliers = articleSuppliers.slice(0, 2);
    const extra = articleSuppliers.length - 2;

    return (
        <div className="bg-white rounded-2xl border border-surface-variant shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            <div className="rounded-t-2xl overflow-hidden">
                <ArticleImage article={article} />
            </div>
            <div className="p-3 flex-1 flex flex-col gap-1">
                <p className="font-epilogue font-semibold text-on-background text-sm leading-tight line-clamp-2">{article.name}</p>
                <p className="text-primary font-bold text-base">{fmt(article.price)}</p>
                {articleSuppliers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                        {visibleSuppliers.map(s => (
                            <span key={s.id} className="text-[10px] px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-medium">
                                {s.name}
                            </span>
                        ))}
                        {extra > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-medium">
                                +{extra}
                            </span>
                        )}
                    </div>
                )}
            </div>
            <div className="flex gap-1 px-3 pb-3 border-t border-surface-variant pt-2">
                <Button variant="tonal" size="sm" icon="edit" className="flex-1" onClick={() => onEdit(article)}>
                    Editar
                </Button>
                <Button variant="text" size="sm" icon="delete" className="text-error hover:bg-error/8" onClick={() => onDelete(article)}>
                    Eliminar
                </Button>
            </div>
        </div>
    );
};

// ---------- Modal de edición ----------
interface ArticleForm {
    name: string;
    price: string;
    image: string | null;
    supplierIds: string[];
}

const ArticleEditModal: React.FC<{
    article: Article | 'new' | null;
    suppliers: Supplier[];
    onClose: () => void;
    onSave: (data: { name: string; price: number; image: string | null; supplierIds: string[] }) => Promise<void>;
}> = ({ article, suppliers, onClose, onSave }) => {
    const isNew = article === 'new';
    const initial: ArticleForm = isNew
        ? { name: '', price: '', image: null, supplierIds: [] }
        : { name: (article as Article).name, price: String((article as Article).price), image: (article as Article).image, supplierIds: (article as Article).supplierIds };

    const [form, setForm] = useState<ArticleForm>(initial);
    const [errors, setErrors] = useState<Partial<Record<keyof ArticleForm, string>>>({});
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const update = <K extends keyof ArticleForm>(key: K, val: ArticleForm[K]) =>
        setForm(f => ({ ...f, [key]: val }));

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > 500_000) {
            setErrors(prev => ({ ...prev, image: 'La imagen debe pesar menos de 500 KB' }));
            return;
        }
        setErrors(prev => ({ ...prev, image: undefined }));
        const reader = new FileReader();
        reader.onload = ev => update('image', ev.target?.result as string);
        reader.readAsDataURL(f);
    };

    const toggleSupplier = (id: string) =>
        setForm(f => ({
            ...f,
            supplierIds: f.supplierIds.includes(id)
                ? f.supplierIds.filter(s => s !== id)
                : [...f.supplierIds, id],
        }));

    const validate = (): boolean => {
        const e: typeof errors = {};
        if (!form.name.trim()) e.name = 'El nombre es requerido';
        const p = parseFloat(form.price);
        if (isNaN(p) || p < 0) e.price = 'Precio inválido';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            await onSave({
                name: form.name.trim(),
                price: parseFloat(form.price),
                image: form.image,
                supplierIds: form.supplierIds,
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={isNew ? 'Nuevo artículo' : 'Editar artículo'}
            footer={
                <>
                    <Button variant="neutral" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button variant="filled" onClick={handleSubmit} icon="save" disabled={saving}>
                        {saving ? 'Guardando…' : 'Guardar'}
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Imagen */}
                <div className="md:col-span-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block mb-2">Imagen</span>
                    <div
                        className="w-full aspect-square rounded-2xl overflow-hidden border-2 border-dashed border-outline-variant hover:border-primary cursor-pointer transition flex items-center justify-center bg-surface-container-low"
                        onClick={() => fileRef.current?.click()}
                    >
                        {form.image
                            ? <img src={form.image} alt="preview" className="w-full h-full object-cover" />
                            : (
                                <div className="flex flex-col items-center gap-2 text-on-surface-variant">
                                    <MIcon name="add_photo_alternate" size={40} />
                                    <span className="text-xs text-center px-2">Haz clic para subir<br />(máx. 500 KB)</span>
                                </div>
                            )
                        }
                    </div>
                    {errors.image && <p className="text-xs text-error mt-1">{errors.image}</p>}
                    {form.image && (
                        <button
                            type="button"
                            className="text-xs text-error mt-1 hover:underline"
                            onClick={() => update('image', null)}
                        >
                            Quitar imagen
                        </button>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                </div>

                {/* Campos */}
                <div className="md:col-span-2 flex flex-col gap-4">
                    <Field label="Nombre" required error={errors.name}>
                        <Input
                            value={form.name}
                            onChange={e => update('name', e.target.value)}
                            placeholder="Ej. Café de olla"
                        />
                    </Field>

                    <Field label="Precio" required error={errors.price}>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.price}
                            onChange={e => update('price', e.target.value)}
                            placeholder="0.00"
                        />
                    </Field>

                    <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block mb-2">Proveedores</span>
                        {suppliers.length === 0 ? (
                            <p className="text-sm text-on-surface-variant">No hay proveedores — agrégalos en el módulo Proveedores.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {suppliers.map(s => {
                                    const active = form.supplierIds.includes(s.id);
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => toggleSupplier(s.id)}
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                                                active
                                                    ? 'bg-primary text-on-primary border-primary'
                                                    : 'bg-surface-container-low text-on-surface border-outline-variant hover:bg-surface-container'
                                            }`}
                                        >
                                            {s.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </form>
        </Modal>
    );
};

// ---------- Vista principal ----------
const ArticlesView: React.FC<ArticlesViewProps> = ({ authToken, onAuthError }) => {
    const [articles, setArticles] = useState<Article[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editing, setEditing] = useState<Article | 'new' | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Article | null>(null);
    const [deleting, setDeleting] = useState(false);
    const toast = useToast();

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            try {
                const [arts, supps] = await Promise.all([getArticles(authToken), getSuppliers(authToken)]);
                if (!cancelled) { setArticles(arts); setSuppliers(supps); }
            } catch (err) {
                if (err instanceof AuthError) { onAuthError(); return; }
                if (!cancelled) toast('error', err instanceof Error ? err.message : 'Error al cargar');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [authToken]);

    const handleSave = async (data: { name: string; price: number; image: string | null; supplierIds: string[] }) => {
        const isNew = editing === 'new';
        try {
            if (isNew) {
                const created = await createArticle(authToken, data);
                setArticles(prev => [...prev, created]);
                toast('success', `${data.name} agregado`);
            } else {
                const updated = await updateArticle(authToken, (editing as Article).id, data);
                setArticles(prev => prev.map(a => a.id === updated.id ? updated : a));
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
            await deleteArticle(authToken, confirmDelete.id);
            setArticles(prev => prev.filter(a => a.id !== confirmDelete.id));
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
        <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 pb-28 md:pb-10">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-epilogue text-3xl font-bold text-on-background">Artículos</h1>
                    <p className="text-on-surface-variant mt-0.5">
                        {isLoading ? 'Cargando…' : articles.length === 0 ? 'Sin artículos' : `${articles.length} artículo${articles.length !== 1 ? 's' : ''}`}
                    </p>
                </div>
                <Button variant="filled" icon="add" onClick={() => setEditing('new')}>
                    Nuevo artículo
                </Button>
            </div>

            {isLoading && (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
                </div>
            )}

            {!isLoading && articles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <MIcon name="package_2" size={40} className="text-primary" fill />
                    </div>
                    <h2 className="font-epilogue text-xl font-bold text-on-background">No hay artículos aún</h2>
                    <p className="text-on-surface-variant mt-1 mb-6 max-w-sm">
                        Crea tu primer artículo para usarlo en la Tienda.
                    </p>
                    <Button variant="filled" icon="add" onClick={() => setEditing('new')}>
                        Crear artículo
                    </Button>
                </div>
            )}

            {!isLoading && articles.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {articles.map(a => (
                        <ArticleCard
                            key={a.id}
                            article={a}
                            suppliers={suppliers}
                            onEdit={setEditing}
                            onDelete={setConfirmDelete}
                        />
                    ))}
                </div>
            )}

            {editing !== null && (
                <ArticleEditModal
                    article={editing}
                    suppliers={suppliers}
                    onClose={() => setEditing(null)}
                    onSave={handleSave}
                />
            )}

            {confirmDelete && (
                <Modal
                    open
                    onClose={() => setConfirmDelete(null)}
                    title="Eliminar artículo"
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
        </main>
    );
};

export default ArticlesView;
