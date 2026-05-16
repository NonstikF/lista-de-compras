import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Article, Supplier } from '../../types';
import { AuthError, getArticles, getSuppliers, createStoreOrder } from '../../services/api';
import { Modal, Button, Field, Input, Textarea, Chip, MIcon, fmt, useToast } from '../ui';

interface StoreViewProps { authToken: string; onAuthError: () => void; }
interface CartEntry { articleId: string; qty: number; }
interface CheckoutForm { customerName: string; notes: string; }

const LAST_CUSTOMER_KEY = 'plantarte_last_customer_name';

// ─── Thumb ───────────────────────────────────────────────────────────────────
const THUMB_COLORS = ['#3b6934', '#7d562d', '#60233e', '#2d5a27', '#42493e', '#7c3a55'];

const ArticleThumb: React.FC<{ article: Article; className?: string }> = ({ article, className = '' }) => {
    const bg = THUMB_COLORS[article.id.charCodeAt(0) % THUMB_COLORS.length];
    const initials = article.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    if (article.image) return <img src={article.image} alt={article.name} className={`object-cover ${className}`} />;
    return (
        <div className={`flex items-center justify-center font-epilogue font-bold text-white text-lg ${className}`} style={{ backgroundColor: bg }}>
            {initials}
        </div>
    );
};

// ─── Card ────────────────────────────────────────────────────────────────────
const StoreCard: React.FC<{
    article: Article;
    cartQty: number;
    onAdd: (id: string) => void;
    onIncrement: (id: string) => void;
    onDecrement: (id: string) => void;
}> = ({ article, cartQty, onAdd, onIncrement, onDecrement }) => {
    const inCart = cartQty > 0;

    return (
        <div className={`group relative bg-white rounded-2xl overflow-hidden flex flex-col transition-all duration-200 cursor-pointer
            ${inCart ? 'shadow-lg ring-2 ring-primary/60' : 'shadow-sm hover:shadow-md'}`}
            onClick={() => !inCart && onAdd(article.id)}
        >
            {/* imagen */}
            <div className="relative w-full aspect-square overflow-hidden bg-neutral-100">
                <ArticleThumb article={article} className="w-full h-full transition-transform duration-300 group-hover:scale-[1.04]" />

                {/* overlay oscuro al hover si no está en carrito */}
                {!inCart && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 bg-primary text-on-primary rounded-full px-4 py-1.5 text-xs font-bold shadow-lg flex items-center gap-1">
                            <span className="text-base leading-none">+</span> Agregar
                        </div>
                    </div>
                )}

                {/* badge qty */}
                {inCart && (
                    <div className="absolute top-2 right-2 bg-primary text-on-primary text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-md">
                        {cartQty}
                    </div>
                )}
            </div>

            {/* info */}
            <div className="px-3 pt-2.5 pb-2 flex flex-col gap-1 flex-1">
                <p className="text-xs font-semibold text-neutral-800 line-clamp-2 leading-snug">{article.name}</p>
                <p className="text-sm font-bold text-primary mt-auto">{fmt(article.price)}</p>
            </div>

            {/* controles qty */}
            {inCart && (
                <div className="px-2 pb-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between bg-primary rounded-xl px-1.5 py-1">
                        <button onClick={() => onDecrement(article.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-on-primary hover:bg-black/10 transition font-bold text-base leading-none">−</button>
                        <span className="text-on-primary font-bold text-sm tabular-nums">{cartQty}</span>
                        <button onClick={() => onIncrement(article.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-on-primary hover:bg-black/10 transition font-bold text-base leading-none">+</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Cart sidebar ─────────────────────────────────────────────────────────────
const CartSidebar: React.FC<{
    cart: CartEntry[];
    articles: Article[];
    onIncrement: (id: string) => void;
    onDecrement: (id: string) => void;
    onClear: () => void;
    onCheckout: () => void;
}> = ({ cart, articles, onIncrement, onDecrement, onClear, onCheckout }) => {
    const articleMap = useMemo(() => Object.fromEntries(articles.map(a => [a.id, a])), [articles]);
    const items = cart.map(e => ({ ...e, article: articleMap[e.articleId] })).filter(e => e.article);
    const subtotal = items.reduce((s, e) => s + e.article.price * e.qty, 0);
    const totalQty = items.reduce((s, e) => s + e.qty, 0);

    return (
        <aside className="flex flex-col h-full bg-neutral-950 text-white">
            {/* header */}
            <div className="px-5 pt-6 pb-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <h2 className="font-epilogue text-lg font-bold tracking-tight">Pedido</h2>
                    {totalQty > 0 && (
                        <span className="bg-primary text-on-primary text-xs font-bold rounded-full px-2.5 py-1 leading-none">
                            {totalQty}
                        </span>
                    )}
                </div>
                {totalQty > 0 && (
                    <p className="text-neutral-400 text-xs mt-1">{totalQty} artículo{totalQty !== 1 ? 's' : ''} seleccionados</p>
                )}
            </div>

            {/* divider */}
            <div className="h-px bg-white/10 flex-shrink-0 mx-5" />

            {/* items */}
            <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1.5">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                            <MIcon name="shopping_bag" size={28} className="text-neutral-500" />
                        </div>
                        <p className="text-neutral-400 text-sm font-medium">Carrito vacío</p>
                        <p className="text-neutral-600 text-xs mt-1">Selecciona artículos del catálogo</p>
                    </div>
                ) : (
                    items.map(e => (
                        <div key={e.articleId} className="flex items-center gap-2.5 bg-white/5 hover:bg-white/8 rounded-xl p-2 transition-colors">
                            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-800">
                                <ArticleThumb article={e.article} className="w-full h-full" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-white leading-snug line-clamp-1">{e.article.name}</p>
                                <p className="text-xs text-primary font-bold mt-0.5">{fmt(e.article.price * e.qty)}</p>
                            </div>
                            <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5 flex-shrink-0">
                                <button onClick={() => onDecrement(e.articleId)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white font-bold transition text-sm">−</button>
                                <span className="w-5 text-center text-xs font-bold text-white tabular-nums">{e.qty}</span>
                                <button onClick={() => onIncrement(e.articleId)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white font-bold transition text-sm">+</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* footer */}
            <div className="flex-shrink-0 px-4 pb-5 pt-3 space-y-3">
                {items.length > 0 && (
                    <>
                        <div className="h-px bg-white/10" />
                        <div className="flex justify-between items-center">
                            <span className="text-neutral-400 text-sm">Total</span>
                            <span className="text-white text-2xl font-bold font-epilogue tabular-nums">{fmt(subtotal)}</span>
                        </div>
                        <button
                            onClick={onCheckout}
                            className="w-full bg-primary hover:bg-primary/90 active:scale-[0.98] text-on-primary rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/30"
                        >
                            <MIcon name="check_circle" fill />
                            Confirmar pedido
                        </button>
                        <button onClick={onClear} className="w-full text-xs text-neutral-500 hover:text-red-400 transition flex items-center justify-center gap-1 py-1">
                            <MIcon name="delete_sweep" size={13} />
                            Vaciar carrito
                        </button>
                    </>
                )}
            </div>
        </aside>
    );
};

// ─── Checkout modal ──────────────────────────────────────────────────────────
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
                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold transition-colors ${step >= s ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>{s}</div>
                        {s < 2 && <div className={`flex-1 h-0.5 transition-colors ${step > s ? 'bg-primary' : 'bg-surface-container-high'}`} />}
                    </React.Fragment>
                ))}
            </div>

            {step === 1 && (
                <div className="p-6 space-y-4">
                    <Field label="Nombre del cliente" required error={nameError}>
                        <Input value={form.customerName} onChange={e => { setForm(f => ({ ...f, customerName: e.target.value })); setNameError(''); }} placeholder="Ej. María García" autoFocus />
                    </Field>
                    <Field label="Notas">
                        <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Instrucciones especiales, alergias, etc." />
                    </Field>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="neutral" onClick={handleClose}>Cancelar</Button>
                        <Button variant="filled" icon="arrow_forward" onClick={handleNext}>Continuar</Button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="p-6 space-y-4">
                    <div className="bg-surface-container-low rounded-xl px-4 py-3 flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-xl">person</span>
                        <div>
                            <p className="text-sm font-semibold text-on-background">{form.customerName}</p>
                            {form.notes && <p className="text-xs text-on-surface-variant italic mt-0.5">{form.notes}</p>}
                        </div>
                    </div>
                    <div className="border border-surface-variant rounded-xl overflow-hidden">
                        <div className="divide-y divide-surface-variant max-h-64 overflow-y-auto">
                            {items.map(e => (
                                <div key={e.articleId} className="flex items-center gap-3 px-4 py-2.5">
                                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container">
                                        <ArticleThumb article={e.article} className="w-full h-full" />
                                    </div>
                                    <span className="flex-1 text-sm text-on-background leading-tight min-w-0 line-clamp-1">{e.article.name}</span>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-bold text-on-background">{fmt(e.article.price * e.qty)}</p>
                                        <p className="text-xs text-on-surface-variant">{e.qty} × {fmt(e.article.price)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center px-4 py-3 bg-surface-container-low border-t border-surface-variant">
                            <span className="text-sm font-bold text-on-background">Total</span>
                            <span className="text-lg font-bold text-primary">{fmt(subtotal)}</span>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="neutral" onClick={() => setStep(1)} disabled={loading}>Atrás</Button>
                        <Button variant="filled" icon="check_circle" onClick={handleConfirm} disabled={loading}>
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
    const [cart, setCart] = useState<CartEntry[]>([]);
    const [query, setQuery] = useState('');
    const [supplierFilter, setSupplierFilter] = useState('todos');
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [mobileCartOpen, setMobileCartOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

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

    const cartMap = useMemo(() => Object.fromEntries(cart.map(e => [e.articleId, e.qty])), [cart]);
    const cartTotal = useMemo(() => cart.reduce((s, e) => {
        const a = articles.find(x => x.id === e.articleId);
        return s + (a ? a.price * e.qty : 0);
    }, 0), [cart, articles]);
    const cartCount = cart.reduce((s, e) => s + e.qty, 0);

    const addToCart = (id: string) => setCart(prev => [...prev, { articleId: id, qty: 1 }]);
    const increment = (id: string) => setCart(prev => prev.map(e => e.articleId === id ? { ...e, qty: e.qty + 1 } : e));
    const decrement = (id: string) => setCart(prev => {
        const entry = prev.find(e => e.articleId === id);
        if (!entry) return prev;
        return entry.qty <= 1 ? prev.filter(e => e.articleId !== id) : prev.map(e => e.articleId === id ? { ...e, qty: e.qty - 1 } : e);
    });

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
            setCart([]);
            setCheckoutOpen(false);
            setMobileCartOpen(false);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al crear el pedido');
        } finally {
            setSubmitting(false);
        }
    };

    const cartProps = {
        cart, articles,
        onIncrement: increment, onDecrement: decrement,
        onClear: () => setCart([]),
        onCheckout: () => { setMobileCartOpen(false); setCheckoutOpen(true); },
    };

    return (
        <>
            {/* Split layout: ocupa toda la altura disponible del main */}
            <div className="flex" style={{ height: 'calc(100vh - 0px)' }}>

                {/* ── Catálogo ─────────────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-neutral-100">

                    {/* topbar */}
                    <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-neutral-200 shadow-sm">
                        {/* búsqueda */}
                        <div className="relative flex-1 max-w-sm">
                            <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[20px]" />
                            <input
                                ref={searchRef}
                                type="search"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Buscar artículo…"
                                className="w-full pl-10 pr-4 py-2 rounded-xl bg-neutral-100 border border-neutral-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm transition"
                            />
                        </div>

                        {/* chips proveedor */}
                        {activeSuppliers.length > 0 && (
                            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1">
                                <Chip active={supplierFilter === 'todos'} onClick={() => setSupplierFilter('todos')}>Todos</Chip>
                                {activeSuppliers.map(s => (
                                    <Chip key={s.id} active={supplierFilter === s.id} onClick={() => setSupplierFilter(s.id)}>{s.name}</Chip>
                                ))}
                            </div>
                        )}

                        {/* botón carrito mobile */}
                        <button
                            onClick={() => setMobileCartOpen(true)}
                            className="lg:hidden relative flex items-center gap-2 bg-neutral-950 text-white rounded-xl px-3 py-2 text-sm font-semibold flex-shrink-0"
                        >
                            <MIcon name="shopping_bag" fill />
                            {cartCount > 0 && (
                                <>
                                    <span className="tabular-nums">{fmt(cartTotal)}</span>
                                    <span className="absolute -top-1.5 -right-1.5 bg-primary text-on-primary text-[10px] font-bold rounded-full w-4.5 h-4.5 w-[18px] h-[18px] flex items-center justify-center">
                                        {cartCount}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* conteo resultados */}
                    {!isLoading && filtered.length > 0 && (
                        <div className="flex-shrink-0 px-4 py-2">
                            <p className="text-xs text-neutral-500 font-medium">
                                {filtered.length} artículo{filtered.length !== 1 ? 's' : ''}
                                {query && <> · búsqueda: "<span className="text-neutral-700">{query}</span>"</>}
                            </p>
                        </div>
                    )}

                    {/* grid */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-400">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                                <p className="text-sm">Cargando catálogo…</p>
                            </div>
                        )}

                        {!isLoading && articles.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                                <div className="w-20 h-20 rounded-3xl bg-neutral-200 flex items-center justify-center">
                                    <MIcon name="package_2" size={40} className="text-neutral-400" fill />
                                </div>
                                <div>
                                    <h2 className="font-epilogue text-lg font-bold text-neutral-800">Sin artículos</h2>
                                    <p className="text-neutral-500 text-sm mt-1">Ve a <strong>Artículos</strong> y crea el catálogo.</p>
                                </div>
                            </div>
                        )}

                        {!isLoading && articles.length > 0 && filtered.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                                <MIcon name="search_off" size={40} className="text-neutral-400" />
                                <p className="text-neutral-500 text-sm">Sin resultados para "<strong>{query}</strong>"</p>
                                <button onClick={() => setQuery('')} className="text-primary text-xs font-semibold hover:underline">Limpiar búsqueda</button>
                            </div>
                        )}

                        {!isLoading && filtered.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                                {filtered.map(a => (
                                    <StoreCard
                                        key={a.id}
                                        article={a}
                                        cartQty={cartMap[a.id] ?? 0}
                                        onAdd={addToCart}
                                        onIncrement={increment}
                                        onDecrement={decrement}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Carrito desktop ──────────────────────── */}
                <div className="hidden lg:flex w-72 xl:w-80 flex-shrink-0">
                    <CartSidebar {...cartProps} />
                </div>
            </div>

            {/* ── Carrito mobile — bottom sheet ─────────── */}
            {mobileCartOpen && (
                <>
                    <div className="fixed inset-0 z-[70] bg-black/60 lg:hidden" onClick={() => setMobileCartOpen(false)} />
                    <div className="fixed bottom-0 left-0 right-0 z-[75] lg:hidden rounded-t-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-[slideUp_0.25s_ease-out]">
                        <div className="bg-neutral-950 flex items-center justify-between px-5 py-4 flex-shrink-0">
                            <h2 className="font-epilogue text-lg font-bold text-white flex items-center gap-2">
                                <MIcon name="shopping_bag" fill />
                                Pedido
                                {cartCount > 0 && <span className="text-xs font-normal text-neutral-400 ml-1">· {cartCount} art{cartCount !== 1 ? 's.' : '.'}</span>}
                            </h2>
                            <button onClick={() => setMobileCartOpen(false)} className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 transition">
                                <MIcon name="close" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <CartSidebar {...cartProps} />
                        </div>
                    </div>
                </>
            )}

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
