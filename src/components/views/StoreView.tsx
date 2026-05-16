import React, { useState, useEffect, useMemo } from 'react';
import type { Article, Supplier } from '../../types';
import { AuthError, getArticles, getSuppliers, createStoreOrder } from '../../services/api';
import { Modal, Button, Field, Input, Textarea, Chip, MIcon, fmt, useToast } from '../ui';

interface StoreViewProps {
    authToken: string;
    onAuthError: () => void;
}

interface CartEntry { articleId: string; qty: number; }
interface CheckoutForm { customerName: string; notes: string; }

const LAST_CUSTOMER_KEY = 'plantarte_last_customer_name';

// ---------- Imagen de artículo ----------
const ArticleThumb: React.FC<{ article: Article; className?: string }> = ({ article, className = '' }) => {
    const colors = ['#3b6934', '#7d562d', '#60233e', '#2d5a27', '#42493e', '#7c3a55'];
    const bg = colors[article.id.charCodeAt(0) % colors.length];
    const initials = article.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    if (article.image) return <img src={article.image} alt={article.name} className={`object-cover ${className}`} />;
    return (
        <div className={`flex items-center justify-center font-epilogue font-bold text-white ${className}`} style={{ backgroundColor: bg }}>
            {initials}
        </div>
    );
};

// ---------- Tarjeta de artículo ----------
const StoreCard: React.FC<{
    article: Article;
    cartQty: number;
    onAdd: (id: string) => void;
    onIncrement: (id: string) => void;
    onDecrement: (id: string) => void;
}> = ({ article, cartQty, onAdd, onIncrement, onDecrement }) => {
    const inCart = cartQty > 0;
    return (
        <div className={`group relative rounded-2xl overflow-hidden flex flex-col transition-all duration-200 ${inCart ? 'ring-2 ring-primary shadow-md' : 'shadow-sm hover:shadow-md'}`}
            style={{ backgroundColor: '#FDFAF6' }}>
            {/* imagen */}
            <div className="relative w-full aspect-square overflow-hidden bg-surface-container-low">
                <ArticleThumb article={article} className="w-full h-full transition-transform duration-300 group-hover:scale-105" />
                {inCart && (
                    <div className="absolute top-2 left-2 bg-primary text-on-primary text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                        {cartQty}
                    </div>
                )}
            </div>
            {/* info + controles */}
            <div className="p-2.5 flex flex-col gap-2">
                <p className="font-epilogue font-semibold text-xs text-on-background line-clamp-2 leading-tight">{article.name}</p>
                <p className="text-primary font-bold text-sm">{fmt(article.price)}</p>
                {!inCart ? (
                    <button
                        onClick={() => onAdd(article.id)}
                        className="w-full bg-primary text-on-primary rounded-xl py-1.5 text-sm font-semibold flex items-center justify-center gap-1 hover:bg-primary/90 active:scale-95 transition-all"
                    >
                        <span className="text-lg leading-none">+</span> Agregar
                    </button>
                ) : (
                    <div className="flex items-center justify-between bg-primary rounded-xl px-1 py-1">
                        <button onClick={() => onDecrement(article.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-on-primary hover:bg-on-primary/20 transition font-bold text-base">−</button>
                        <span className="text-on-primary font-bold text-sm">{cartQty}</span>
                        <button onClick={() => onIncrement(article.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-on-primary hover:bg-on-primary/20 transition font-bold text-base">+</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ---------- Panel del carrito (siempre visible en desktop) ----------
const CartPanel: React.FC<{
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
        <aside className="flex flex-col h-full bg-white border-l border-surface-variant">
            {/* header */}
            <div className="px-4 py-4 border-b border-surface-variant" style={{ background: 'linear-gradient(135deg, #2d5a27 0%, #3b6934 100%)' }}>
                <div className="flex items-center justify-between">
                    <h2 className="font-epilogue text-lg font-bold text-white flex items-center gap-2">
                        <MIcon name="shopping_cart" fill />
                        Carrito
                    </h2>
                    {totalQty > 0 && (
                        <span className="bg-white/20 text-white text-xs font-bold rounded-full px-2.5 py-1">
                            {totalQty} art{totalQty !== 1 ? 's.' : '.'}
                        </span>
                    )}
                </div>
            </div>

            {/* items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-on-surface-variant py-10">
                        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-3">
                            <MIcon name="shopping_cart" size={32} />
                        </div>
                        <p className="font-medium text-sm">Carrito vacío</p>
                        <p className="text-xs mt-1 max-w-[140px]">Agrega artículos del catálogo</p>
                    </div>
                ) : (
                    items.map(e => (
                        <div key={e.articleId} className="flex gap-2.5 items-center bg-surface-container-low rounded-xl p-2">
                            <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0">
                                <ArticleThumb article={e.article} className="w-full h-full" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-on-background leading-tight line-clamp-2">{e.article.name}</p>
                                <p className="text-xs font-bold text-primary mt-0.5">{fmt(e.article.price * e.qty)}</p>
                            </div>
                            <div className="flex items-center gap-0.5 bg-white border border-surface-variant rounded-lg px-0.5 py-0.5 flex-shrink-0">
                                <button onClick={() => onDecrement(e.articleId)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-surface-container text-on-surface font-bold transition text-sm">−</button>
                                <span className="w-5 text-center text-xs font-bold text-on-background">{e.qty}</span>
                                <button onClick={() => onIncrement(e.articleId)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-surface-container text-on-surface font-bold transition text-sm">+</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* footer */}
            {items.length > 0 && (
                <div className="border-t border-surface-variant p-3 space-y-2.5">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-sm text-on-surface-variant">Total</span>
                        <span className="text-xl font-bold text-on-background">{fmt(subtotal)}</span>
                    </div>
                    <button
                        onClick={onCheckout}
                        className="w-full bg-primary text-on-primary rounded-xl py-3 font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-95 transition-all shadow-sm"
                    >
                        <MIcon name="check_circle" fill />
                        Confirmar pedido
                    </button>
                    <button onClick={onClear} className="w-full flex items-center justify-center gap-1 text-xs text-error hover:text-error/70 transition py-1">
                        <MIcon name="delete_sweep" size={14} />
                        Vaciar carrito
                    </button>
                </div>
            )}
        </aside>
    );
};

// ---------- Modal checkout ----------
const CheckoutModal: React.FC<{
    open: boolean;
    loading: boolean;
    onClose: () => void;
    cart: CartEntry[];
    articles: Article[];
    onConfirm: (form: CheckoutForm) => void;
}> = ({ open, loading, onClose, cart, articles, onConfirm }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [form, setForm] = useState<CheckoutForm>({
        customerName: localStorage.getItem(LAST_CUSTOMER_KEY) ?? '',
        notes: '',
    });
    const [nameError, setNameError] = useState('');

    const articleMap = useMemo(() => Object.fromEntries(articles.map(a => [a.id, a])), [articles]);
    const items = cart.map(e => ({ ...e, article: articleMap[e.articleId] })).filter(e => e.article);
    const subtotal = items.reduce((s, e) => s + e.article.price * e.qty, 0);

    const handleClose = () => {
        if (loading) return;
        setStep(1);
        setForm(f => ({ ...f, notes: '' }));
        setNameError('');
        onClose();
    };

    const handleNext = () => {
        if (!form.customerName.trim()) { setNameError('Nombre requerido'); return; }
        setNameError('');
        setStep(2);
    };

    const handleConfirm = () => {
        localStorage.setItem(LAST_CUSTOMER_KEY, form.customerName.trim());
        onConfirm(form);
    };

    if (!open) return null;
    return (
        <Modal open onClose={handleClose} title="Confirmar pedido" maxWidth="max-w-lg">
            <div className="px-6 pt-4 flex items-center gap-2">
                {[1, 2].map(s => (
                    <React.Fragment key={s}>
                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${step >= s ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>{s}</div>
                        {s < 2 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-primary' : 'bg-surface-container-high'}`} />}
                    </React.Fragment>
                ))}
            </div>

            {step === 1 && (
                <div className="p-6 space-y-4">
                    <Field label="Nombre" required error={nameError}>
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
                            <p className="text-sm font-semibold text-on-background leading-tight">{form.customerName}</p>
                            {form.notes && <p className="text-xs text-on-surface-variant italic mt-0.5">{form.notes}</p>}
                        </div>
                    </div>
                    <div className="border border-surface-variant rounded-xl overflow-hidden">
                        <div className="divide-y divide-surface-variant">
                            {items.map(e => (
                                <div key={e.articleId} className="flex items-center gap-3 px-4 py-2.5">
                                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container">
                                        <ArticleThumb article={e.article} className="w-full h-full" />
                                    </div>
                                    <span className="flex-1 text-sm text-on-background leading-tight min-w-0">{e.article.name}</span>
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

// ---------- Vista principal ----------
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

    const activeSuppliers = useMemo(() => {
        const usedIds = new Set(articles.flatMap(a => a.supplierIds));
        return suppliers.filter(s => usedIds.has(s.id));
    }, [articles, suppliers]);

    const filtered = useMemo(() => {
        let list = articles;
        if (supplierFilter !== 'todos') list = list.filter(a => a.supplierIds.includes(supplierFilter));
        if (query.trim()) {
            const q = query.toLowerCase();
            list = list.filter(a => a.name.toLowerCase().includes(q));
        }
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
            return {
                articleId: e.articleId,
                name: article?.name ?? e.articleId,
                price: article?.price ?? 0,
                qty: e.qty,
                imageUrl: article?.image ?? null,
                supplierName: (supplierId && supplierMap[supplierId]) || 'Sin proveedor',
            };
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
        onIncrement: increment,
        onDecrement: decrement,
        onClear: () => setCart([]),
        onCheckout: () => { setMobileCartOpen(false); setCheckoutOpen(true); },
    };

    return (
        <>
            {/* Layout split: catálogo + carrito fijo */}
            <div className="flex h-[calc(100vh-56px)]">

                {/* ── CATÁLOGO (izquierda) ── */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* barra superior */}
                    <div className="flex-shrink-0 px-4 py-3 border-b border-surface-variant bg-white flex items-center gap-3">
                        <div className="relative flex-1">
                            <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                            <input
                                type="search"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Buscar artículo…"
                                className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                            />
                        </div>
                        {/* botón carrito mobile */}
                        <button
                            onClick={() => setMobileCartOpen(true)}
                            className="lg:hidden relative p-2.5 bg-primary text-on-primary rounded-xl"
                        >
                            <MIcon name="shopping_cart" fill />
                            {cartCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                    {cartCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* filtros proveedor */}
                    {!isLoading && activeSuppliers.length > 0 && (
                        <div className="flex-shrink-0 flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide border-b border-surface-variant bg-white">
                            <Chip active={supplierFilter === 'todos'} onClick={() => setSupplierFilter('todos')}>Todos</Chip>
                            {activeSuppliers.map(s => (
                                <Chip key={s.id} active={supplierFilter === s.id} onClick={() => setSupplierFilter(s.id)}>{s.name}</Chip>
                            ))}
                        </div>
                    )}

                    {/* grid artículos */}
                    <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: '#F5F2ED' }}>
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
                                <h2 className="font-epilogue text-xl font-bold text-on-background">Sin artículos</h2>
                                <p className="text-on-surface-variant mt-1 max-w-sm text-sm">Ve a <strong>Artículos</strong> y crea el catálogo.</p>
                            </div>
                        )}
                        {!isLoading && articles.length > 0 && filtered.length === 0 && (
                            <div className="text-center py-12 text-on-surface-variant text-sm">
                                Sin resultados para "<strong>{query}</strong>"
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

                {/* ── CARRITO fijo desktop (derecha) ── */}
                <div className="hidden lg:flex w-72 xl:w-80 flex-shrink-0">
                    <CartPanel {...cartProps} />
                </div>
            </div>

            {/* ── CARRITO mobile — sheet inferior ── */}
            {mobileCartOpen && (
                <>
                    <div className="fixed inset-0 z-[70] bg-black/40 lg:hidden" onClick={() => setMobileCartOpen(false)} />
                    <div className="fixed bottom-0 left-0 right-0 z-[75] lg:hidden bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[80vh] animate-[slideUp_0.25s_ease-out]">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-variant">
                            <h2 className="font-epilogue text-lg font-bold text-on-background flex items-center gap-2">
                                <MIcon name="shopping_cart" fill />
                                Carrito {cartCount > 0 && <span className="text-sm font-normal text-on-surface-variant">· {cartCount} art{cartCount !== 1 ? 's.' : '.'}</span>}
                            </h2>
                            <button onClick={() => setMobileCartOpen(false)} className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant">
                                <MIcon name="close" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <CartPanel {...cartProps} />
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
