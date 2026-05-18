import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Article, Supplier } from '../../types';
import { AuthError, getArticles, getSuppliers, createStoreOrder } from '../../services/api';
import { Modal, Button, Field, Input, Textarea, MIcon, fmt, useToast } from '../ui';

interface StoreViewProps { authToken: string; onAuthError: () => void; }
interface CartEntry { articleId: string; qty: number; }
interface CheckoutForm { customerName: string; notes: string; }
interface StoreSection { id: string; category: string; supplierName: string; title: string; articles: Article[]; }

const LAST_CUSTOMER_KEY = 'plantarte_last_customer_name';
const CART_KEY = 'plantarte_store_cart';
const THUMB_COLORS = ['#3b6934', '#7d562d', '#60233e', '#2d5a27', '#42493e', '#7c3a55'];

const sectionIdFrom = (category: string, supplierName: string) =>
    `${category}::${supplierName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ─── Thumb ────────────────────────────────────────────────────────────────────
const ArticleThumb: React.FC<{ article: Article; className?: string }> = ({ article, className = '' }) => {
    const bg = THUMB_COLORS[article.id.charCodeAt(0) % THUMB_COLORS.length];
    const initials = article.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    if (article.image) return <img src={article.image} alt={article.name} className={`object-cover ${className}`} />;
    return (
        <div className={`flex items-center justify-center font-epilogue font-bold text-white ${className}`} style={{ backgroundColor: bg }}>
            {initials}
        </div>
    );
};

// ─── Card ─────────────────────────────────────────────────────────────────────
const StoreCard: React.FC<{
    article: Article; cartQty: number;
    onAdd: (id: string) => void; onIncrement: (id: string) => void; onDecrement: (id: string) => void;
    onSetQty: (id: string, qty: number) => void;
}> = ({ article, cartQty, onAdd, onIncrement, onDecrement, onSetQty }) => {
    const inCart = cartQty > 0;
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const startEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setDraft(String(cartQty));
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const commitEdit = () => {
        const n = parseInt(draft, 10);
        if (!isNaN(n) && n > 0) onSetQty(article.id, n);
        else if (!isNaN(n) && n === 0) onDecrement(article.id); // quitar
        setEditing(false);
    };

    return (
        <div
            onClick={() => inCart ? onIncrement(article.id) : onAdd(article.id)}
            className={`group relative bg-white rounded-xl overflow-hidden flex flex-col transition-all duration-150 cursor-pointer select-none
                ${inCart ? 'ring-2 ring-primary shadow-md' : 'border border-neutral-200 hover:border-primary/40 hover:shadow-sm'}`}
        >
            <div className="relative w-full aspect-square overflow-hidden bg-neutral-50">
                <ArticleThumb article={article} className="w-full h-full transition-transform duration-200 group-hover:scale-105" />
                {inCart && (
                    <div className="absolute top-1.5 right-1.5 bg-primary text-white text-[11px] font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                        {cartQty}
                    </div>
                )}
                <div className={`absolute inset-0 flex items-end justify-center pb-2 transition-opacity ${inCart ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                        {inCart ? `+1 (${cartQty + 1})` : '+ Agregar'}
                    </span>
                </div>
            </div>
            <div className="p-2 flex flex-col gap-1 flex-1">
                <p className="text-[11px] font-medium text-neutral-700 line-clamp-2 leading-snug flex-1">{article.name}</p>
                <p className="text-sm font-bold text-primary">{fmt(article.price)}</p>
            </div>
            {inCart && (
                <div className="px-2 pb-2" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between bg-primary rounded-lg px-1 py-0.5">
                        <button onClick={() => onDecrement(article.id)} className="w-7 h-7 flex items-center justify-center rounded-md text-white hover:bg-black/10 transition font-bold text-base">−</button>
                        {editing ? (
                            <input
                                ref={inputRef}
                                value={draft}
                                onChange={e => setDraft(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                                className="w-10 text-center text-sm font-bold bg-white/20 text-white rounded outline-none tabular-nums"
                                type="number"
                                min={0}
                            />
                        ) : (
                            <button onClick={startEdit} className="text-white font-bold text-sm tabular-nums px-1 hover:bg-black/10 rounded transition min-w-[24px] text-center">
                                {cartQty}
                            </button>
                        )}
                        <button onClick={() => onIncrement(article.id)} className="w-7 h-7 flex items-center justify-center rounded-md text-white hover:bg-black/10 transition font-bold text-base">+</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Checkout modal ───────────────────────────────────────────────────────────
const CheckoutModal: React.FC<{
    open: boolean; loading: boolean; onClose: () => void;
    cart: CartEntry[]; articles: Article[]; onConfirm: (form: CheckoutForm) => void;
}> = ({ open, loading, onClose, cart, articles, onConfirm }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [form, setForm] = useState<CheckoutForm>({ customerName: localStorage.getItem(LAST_CUSTOMER_KEY) ?? '', notes: '' });
    const [nameError, setNameError] = useState('');
    const articleMap = useMemo(() => Object.fromEntries(articles.map(a => [a.id, a])), [articles]);
    const items = cart.map(e => ({ ...e, article: articleMap[e.articleId] })).filter(e => e.article);
    const subtotal = items.reduce((s, e) => s + e.article.price * e.qty, 0);
    const handleClose = () => { if (loading) return; setStep(1); setForm(f => ({ ...f, notes: '' })); setNameError(''); onClose(); };
    const handleNext = () => { if (!form.customerName.trim()) { setNameError('Nombre requerido'); return; } setNameError(''); setStep(2); };
    const handleConfirm = () => { localStorage.setItem(LAST_CUSTOMER_KEY, form.customerName.trim()); onConfirm(form); };
    if (!open) return null;
    return (
        <Modal open onClose={handleClose} title="Confirmar pedido" maxWidth="max-w-lg">
            <div className="px-6 pt-4 flex items-center gap-2">
                {[1, 2].map(s => (
                    <React.Fragment key={s}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= s ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-400'}`}>{s}</div>
                        {s < 2 && <div className={`flex-1 h-0.5 transition-colors ${step > s ? 'bg-primary' : 'bg-neutral-200'}`} />}
                    </React.Fragment>
                ))}
            </div>
            {step === 1 && (
                <div className="p-4 sm:p-6 space-y-4">
                    <Field label="Nombre del cliente" required error={nameError}>
                        <Input value={form.customerName} onChange={e => { setForm(f => ({ ...f, customerName: e.target.value })); setNameError(''); }} placeholder="Ej. María García" autoFocus />
                    </Field>
                    <Field label="Notas">
                        <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Instrucciones especiales…" />
                    </Field>
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                        <Button variant="neutral" onClick={handleClose} className="w-full sm:w-auto">Cancelar</Button>
                        <Button variant="filled" icon="arrow_forward" onClick={handleNext} className="w-full sm:w-auto">Continuar</Button>
                    </div>
                </div>
            )}
            {step === 2 && (
                <div className="p-4 sm:p-6 space-y-4">
                    <div className="bg-neutral-50 rounded-xl px-4 py-3 flex items-center gap-3 border border-neutral-200">
                        <MIcon name="person" className="text-primary" />
                        <div>
                            <p className="text-sm font-semibold text-neutral-800">{form.customerName}</p>
                            {form.notes && <p className="text-xs text-neutral-500 italic mt-0.5">{form.notes}</p>}
                        </div>
                    </div>
                    <div className="border border-neutral-200 rounded-xl overflow-hidden">
                        <div className="divide-y divide-neutral-100 max-h-64 overflow-y-auto">
                            {items.map(e => (
                                <div key={e.articleId} className="flex items-center gap-3 px-4 py-2.5">
                                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-100">
                                        <ArticleThumb article={e.article} className="w-full h-full" />
                                    </div>
                                    <span className="flex-1 text-sm text-neutral-700 min-w-0 line-clamp-1">{e.article.name}</span>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-bold text-neutral-900">{fmt(e.article.price * e.qty)}</p>
                                        <p className="text-xs text-neutral-400">{e.qty} × {fmt(e.article.price)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center px-4 py-3 bg-neutral-50 border-t border-neutral-200">
                            <span className="text-sm font-bold text-neutral-700">Total</span>
                            <span className="text-lg font-bold text-primary">{fmt(subtotal)}</span>
                        </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                        <Button variant="neutral" onClick={() => setStep(1)} disabled={loading} className="w-full sm:w-auto">Atrás</Button>
                        <Button variant="filled" icon="check_circle" onClick={handleConfirm} disabled={loading} className="w-full sm:w-auto">
                            {loading ? 'Creando pedido…' : 'Confirmar pedido'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

// ─── Vista principal ──────────────────────────────────────────────────────────
const StoreView: React.FC<StoreViewProps> = ({ authToken, onAuthError }) => {
    const [articles, setArticles] = useState<Article[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [cart, setCart] = useState<CartEntry[]>(() => {
        try { return JSON.parse(localStorage.getItem(CART_KEY) ?? '[]'); } catch { return []; }
    });
    const [query, setQuery] = useState('');
    const [supplierFilter, setSupplierFilter] = useState('todos');
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);
    const toast = useToast();
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
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
        })();
        return () => { cancelled = true; };
    }, [authToken]);

    const activeSuppliers = useMemo(() => {
        const usedIds = new Set(articles.flatMap(a => a.supplierIds));
        return suppliers.filter(s => usedIds.has(s.id));
    }, [articles, suppliers]);

    const filtered = useMemo(() => {
        let list = articles;
        if (supplierFilter !== 'todos') list = list.filter(a => a.supplierIds.includes(supplierFilter));
        if (query.trim()) { const q = query.toLowerCase(); list = list.filter(a => a.name.toLowerCase().includes(q)); }
        return list;
    }, [articles, supplierFilter, query]);

    const supplierNameMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const sections = useMemo<StoreSection[]>(() => {
        const map = new Map<string, StoreSection>();
        filtered
            .slice()
            .sort((a, b) => {
                const cat = (a.category || 'Sin categoría').localeCompare(b.category || 'Sin categoría', 'es');
                if (cat !== 0) return cat;
                const aSupplier = supplierNameMap[a.supplierIds?.[0] ?? ''] || 'Sin proveedor';
                const bSupplier = supplierNameMap[b.supplierIds?.[0] ?? ''] || 'Sin proveedor';
                const supplier = aSupplier.localeCompare(bSupplier, 'es');
                return supplier || a.name.localeCompare(b.name, 'es');
            })
            .forEach(article => {
                const category = article.category?.trim() || 'Sin categoría';
                const supplierName = supplierNameMap[article.supplierIds?.[0] ?? ''] || 'Sin proveedor';
                const id = sectionIdFrom(category, supplierName);
                const title = `${category} · ${supplierName}`;
                const existing = map.get(id);
                if (existing) existing.articles.push(article);
                else map.set(id, { id, category, supplierName, title, articles: [article] });
            });
        return Array.from(map.values());
    }, [filtered, supplierNameMap]);

    const cartMap = useMemo(() => Object.fromEntries(cart.map(e => [e.articleId, e.qty])), [cart]);
    const cartTotal = useMemo(() => cart.reduce((s, e) => {
        const a = articles.find(x => x.id === e.articleId);
        return s + (a ? a.price * e.qty : 0);
    }, 0), [cart, articles]);
    const cartCount = cart.reduce((s, e) => s + e.qty, 0);

    const saveCart = (next: CartEntry[]) => { localStorage.setItem(CART_KEY, JSON.stringify(next)); return next; };
    const addToCart = (id: string) => setCart(prev => saveCart([...prev, { articleId: id, qty: 1 }]));
    const increment = (id: string) => setCart(prev => saveCart(prev.map(e => e.articleId === id ? { ...e, qty: e.qty + 1 } : e)));
    const decrement = (id: string) => setCart(prev => {
        const entry = prev.find(e => e.articleId === id);
        if (!entry) return prev;
        return saveCart(entry.qty <= 1 ? prev.filter(e => e.articleId !== id) : prev.map(e => e.articleId === id ? { ...e, qty: e.qty - 1 } : e));
    });
    const removeFromCart = (id: string) => setCart(prev => saveCart(prev.filter(e => e.articleId !== id)));
    const setQty = (id: string, qty: number) => setCart(prev => saveCart(
        qty <= 0 ? prev.filter(e => e.articleId !== id) : prev.map(e => e.articleId === id ? { ...e, qty } : e)
    ));

    const handleConfirm = async (form: CheckoutForm) => {
        const articleMap = Object.fromEntries(articles.map(a => [a.id, a]));
        const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
        const items = cart.map(e => {
            const article = articleMap[e.articleId];
            const supplierId = article?.supplierIds?.[0];
            return { articleId: e.articleId, name: article?.name ?? e.articleId, price: article?.price ?? 0, qty: e.qty, imageUrl: article?.image ?? null, supplierName: (supplierId && supplierMap[supplierId]) || 'Sin proveedor' };
        });
        setSubmitting(true);
        try {
            const order = await createStoreOrder(authToken, { customerName: form.customerName, notes: form.notes, items });
            toast('success', `Pedido ${order.id} creado`);
            setCart(saveCart([]));
            setCheckoutOpen(false);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al crear el pedido');
        } finally {
            setSubmitting(false);
        }
    };

    const articleMap = useMemo(() => Object.fromEntries(articles.map(a => [a.id, a])), [articles]);
    const cartItems = cart.map(e => ({ ...e, article: articleMap[e.articleId] })).filter(e => e.article);
    const subtotal = cartItems.reduce((s, e) => s + e.article.price * e.qty, 0);

    // Carrito como panel lateral (contenido reutilizable)
    const CartPanel = (
        <>
            {/* header sidebar */}
            <div className="flex-shrink-0 px-5 py-4 border-b border-neutral-100">
                <div className="flex items-center justify-between">
                    <h2 className="font-epilogue text-base font-bold text-neutral-900">Pedido actual</h2>
                    <div className="flex items-center gap-2">
                        {cartCount > 0 && (
                            <span className="bg-primary/10 text-primary text-xs font-bold rounded-full px-2.5 py-0.5">{cartCount} art.</span>
                        )}
                        {/* botón cerrar — solo en móvil */}
                        <button onClick={() => setCartOpen(false)} className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition text-neutral-500">
                            <MIcon name="close" size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* lista items */}
            <div className="flex-1 overflow-y-auto">
                {cartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center">
                            <MIcon name="shopping_cart" size={28} className="text-neutral-300" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-neutral-500">Carrito vacío</p>
                            <p className="text-xs text-neutral-400 mt-1">Haz clic en un artículo para agregarlo</p>
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-neutral-100">
                        {cartItems.map(e => (
                            <div key={e.articleId} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors">
                                <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-100">
                                    <ArticleThumb article={e.article} className="w-full h-full" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-neutral-800 line-clamp-2 leading-snug">{e.article.name}</p>
                                    <p className="text-xs text-primary font-bold mt-0.5">{fmt(e.article.price * e.qty)}</p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => decrement(e.articleId)} className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold text-sm transition" aria-label={`Restar ${e.article.name}`}>−</button>
                                        <span className="w-6 text-center text-sm font-bold text-neutral-800 tabular-nums">{e.qty}</span>
                                        <button onClick={() => increment(e.articleId)} className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 font-bold text-sm transition" aria-label={`Sumar ${e.article.name}`}>+</button>
                                    </div>
                                    <button
                                        onClick={() => removeFromCart(e.articleId)}
                                        className="w-8 h-8 rounded-lg bg-error-container/70 hover:bg-error-container flex items-center justify-center text-error transition"
                                        aria-label={`Eliminar ${e.article.name} del carrito`}
                                        title="Eliminar"
                                    >
                                        <MIcon name="delete" size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* footer carrito */}
            {cartItems.length > 0 && (
                <div className="flex-shrink-0 border-t border-neutral-200 p-4 space-y-3 bg-white">
                    <div className="flex justify-between items-center border-t border-neutral-100 pt-2">
                        <span className="text-sm font-semibold text-neutral-700">Total</span>
                        <span className="text-xl font-bold text-neutral-900 font-epilogue tabular-nums">{fmt(subtotal)}</span>
                    </div>
                    <button
                        onClick={() => setCheckoutOpen(true)}
                        className="w-full bg-primary hover:bg-primary/90 active:scale-[0.98] text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 transition-all"
                    >
                        <MIcon name="check_circle" fill />
                        Confirmar pedido
                    </button>
                    <button onClick={() => setCart(saveCart([]))} className="w-full text-xs text-neutral-400 hover:text-red-500 transition flex items-center justify-center gap-1 py-0.5">
                        <MIcon name="delete_sweep" size={13} />
                        Vaciar carrito
                    </button>
                </div>
            )}
        </>
    );

    return (
        <>
            <div className="flex h-[calc(100dvh-5rem)] md:h-[100dvh] overflow-hidden bg-neutral-50">

                {/* ── CATÁLOGO ─────────────────────────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                    {/* barra superior: búsqueda + filtros */}
                    <div className="flex-shrink-0 bg-white border-b border-neutral-200 px-3 sm:px-4 py-3 flex flex-col gap-2.5">
                        {/* búsqueda */}
                        <div className="relative">
                            <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                                ref={searchRef}
                                type="search"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Buscar artículo…"
                                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-neutral-100 border border-transparent focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 outline-none text-sm transition"
                            />
                            {query && (
                                <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition">
                                    <MIcon name="close" size={16} />
                                </button>
                            )}
                        </div>

                        {/* chips de proveedor — scroll horizontal */}
                        {!isLoading && activeSuppliers.length > 0 && (
                            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 -mx-3 sm:-mx-4 px-3 sm:px-4">
                                {[{ id: 'todos', name: 'Todos' }, ...activeSuppliers].map(s => {
                                    const active = supplierFilter === s.id;
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => setSupplierFilter(s.id)}
                                            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all border
                                                ${active
                                                    ? 'bg-primary text-white border-primary shadow-sm'
                                                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary/40 hover:text-primary'
                                                }`}
                                        >
                                            {s.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                    </div>

                    {/* conteo */}
                    {!isLoading && filtered.length > 0 && (
                        <div className="px-4 pt-2.5 pb-0">
                            <p className="text-xs text-neutral-400">{filtered.length} artículo{filtered.length !== 1 ? 's' : ''}</p>
                        </div>
                    )}

                    {/* grid */}
                    <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 md:p-4">
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-400">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                                <p className="text-sm">Cargando catálogo…</p>
                            </div>
                        )}
                        {!isLoading && articles.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                                <div className="w-16 h-16 rounded-2xl bg-neutral-200 flex items-center justify-center">
                                    <MIcon name="package_2" size={32} className="text-neutral-400" fill />
                                </div>
                                <div>
                                    <p className="font-semibold text-neutral-700">Sin artículos</p>
                                    <p className="text-neutral-400 text-sm mt-1">Ve a <strong>Artículos</strong> y crea el catálogo.</p>
                                </div>
                            </div>
                        )}
                        {!isLoading && articles.length > 0 && filtered.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                                <MIcon name="search_off" size={36} className="text-neutral-400" />
                                <p className="text-neutral-500 text-sm">Sin resultados para "<strong>{query}</strong>"</p>
                                <button onClick={() => setQuery('')} className="text-primary text-xs font-semibold hover:underline mt-1">Limpiar búsqueda</button>
                            </div>
                        )}
                        {!isLoading && filtered.length > 0 && (
                            <div className="space-y-5 pb-28 md:pb-0">
                                {sections.map(section => (
                                    <section
                                        key={section.id}
                                        aria-labelledby={`store-section-${section.id}`}
                                        className="scroll-mt-4"
                                    >
                                        <div className="sticky top-0 z-10 -mx-2.5 sm:-mx-3 md:-mx-4 mb-2.5 border-y border-surface-variant bg-neutral-50/95 px-2.5 sm:px-3 md:px-4 py-2 backdrop-blur">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-semibold uppercase text-on-surface-variant">Categoría · proveedor</p>
                                                    <h2 id={`store-section-${section.id}`} className="font-epilogue text-sm sm:text-base font-bold text-on-background truncate">
                                                        {section.title}
                                                    </h2>
                                                </div>
                                                <span className="flex-shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                                                    {section.articles.length}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 min-[430px]:grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-2.5 md:gap-3">
                                            {section.articles.map(a => (
                                                <StoreCard key={a.id} article={a} cartQty={cartMap[a.id] ?? 0} onAdd={addToCart} onIncrement={increment} onDecrement={decrement} onSetQty={setQty} />
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── SIDEBAR CARRITO — desktop (md+) ───────────────────── */}
                <div className="hidden md:flex w-80 flex-shrink-0 flex-col bg-white border-l border-neutral-200 overflow-hidden">
                    {CartPanel}
                </div>

                {/* ── DRAWER CARRITO — móvil (<md) ──────────────────────── */}
                {cartOpen && (
                    <div className="md:hidden fixed inset-0 z-[70] flex">
                        {/* backdrop */}
                        <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
                        {/* panel */}
                        <div className="relative ml-auto w-full min-[420px]:w-[92vw] max-w-md h-full flex flex-col bg-white shadow-2xl overflow-hidden">
                            {CartPanel}
                        </div>
                    </div>
                )}
            </div>

            {/* ── FAB carrito — solo móvil ─────────────────────────────── */}
            <button
                onClick={() => setCartOpen(true)}
                aria-label="Abrir carrito"
                className="md:hidden fixed bottom-24 right-4 z-30 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
            >
                <MIcon name="shopping_cart" size={26} fill />
                {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 shadow">
                        {cartCount}
                    </span>
                )}
            </button>

            <CheckoutModal
                open={checkoutOpen}
                loading={submitting}
                onClose={() => setCheckoutOpen(false)}
                cart={cart}
                articles={articles}
                onConfirm={handleConfirm}
            />
        </>
    );
};

export default StoreView;
