import React, { useState, useEffect, useMemo } from 'react';
import type { Article, Supplier, StoreOrderItem } from '../../types';
import { AuthError, getArticles, getSuppliers, createStoreOrder } from '../../services/api';
import { Modal, Button, Field, Input, Textarea, Chip, MIcon, fmt, useToast } from '../ui';

interface StoreViewProps {
    authToken: string;
    onAuthError: () => void;
}

// ---------- Imagen de artículo ----------
const ArticleThumb: React.FC<{ article: Article; className?: string }> = ({ article, className = '' }) => {
    const colors = ['#3b6934', '#7d562d', '#60233e', '#2d5a27', '#42493e', '#7c3a55'];
    const bg = colors[article.id.charCodeAt(0) % colors.length];
    const initials = article.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    if (article.image) {
        return <img src={article.image} alt={article.name} className={`object-cover ${className}`} />;
    }
    return (
        <div
            className={`flex items-center justify-center font-epilogue font-bold text-white ${className}`}
            style={{ backgroundColor: bg }}
        >
            {initials}
        </div>
    );
};

// ---------- Tipos internos del carrito ----------
interface CartEntry { articleId: string; qty: number; }

// ---------- Tarjeta de artículo en la tienda ----------
const StoreCard: React.FC<{
    article: Article;
    cartQty: number;
    onAdd: (id: string) => void;
    onIncrement: (id: string) => void;
    onDecrement: (id: string) => void;
}> = ({ article, cartQty, onAdd, onIncrement, onDecrement }) => {
    const inCart = cartQty > 0;
    return (
        <div className={`group relative rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-lg transition-all duration-200 ${inCart ? 'ring-2 ring-primary ring-offset-1' : ''}`}
            style={{ backgroundColor: '#FDFAF6' }}>
            {/* imagen */}
            <div className="relative w-full aspect-[3/4] overflow-hidden bg-surface-container-low">
                <ArticleThumb article={article} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                {/* overlay botón agregar */}
                {!inCart && (
                    <button
                        onClick={() => onAdd(article.id)}
                        className="absolute bottom-3 right-3 w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 text-xl font-bold"
                        aria-label={`Agregar ${article.name}`}
                    >
                        +
                    </button>
                )}
                {/* badge cantidad */}
                {inCart && (
                    <div className="absolute top-2 right-2 bg-primary text-on-primary text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                        {cartQty}
                    </div>
                )}
            </div>
            {/* info */}
            <div className="p-3 flex flex-col gap-1 flex-1">
                <p className="font-epilogue font-semibold text-sm text-on-background line-clamp-2 leading-tight">{article.name}</p>
                <p className="text-primary font-bold text-base mt-auto">{fmt(article.price)}</p>
            </div>
            {/* controles qty (solo visible si en carrito) */}
            {inCart && (
                <div className="px-3 pb-3">
                    <div className="flex items-center justify-between bg-primary rounded-full px-1 py-1">
                        <button onClick={() => onDecrement(article.id)} className="w-8 h-8 flex items-center justify-center rounded-full text-on-primary hover:bg-on-primary/20 transition text-lg font-bold">−</button>
                        <span className="text-on-primary font-bold text-sm">{cartQty}</span>
                        <button onClick={() => onIncrement(article.id)} className="w-8 h-8 flex items-center justify-center rounded-full text-on-primary hover:bg-on-primary/20 transition text-lg font-bold">+</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ---------- Drawer del carrito ----------
const CartDrawer: React.FC<{
    open: boolean;
    onClose: () => void;
    cart: CartEntry[];
    articles: Article[];
    onIncrement: (id: string) => void;
    onDecrement: (id: string) => void;
    onClear: () => void;
    onCheckout: () => void;
}> = ({ open, onClose, cart, articles, onIncrement, onDecrement, onClear, onCheckout }) => {
    const articleMap = useMemo(() => Object.fromEntries(articles.map(a => [a.id, a])), [articles]);
    const items = cart.map(e => ({ ...e, article: articleMap[e.articleId] })).filter(e => e.article);
    const subtotal = items.reduce((s, e) => s + e.article.price * e.qty, 0);

    if (!open) return null;
    return (
        <>
            <div className="fixed inset-0 z-[70] bg-black/40" onClick={onClose} />
            <aside className="fixed right-0 top-0 bottom-0 z-[75] w-full max-w-sm bg-white shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-surface-variant">
                    <h2 className="font-epilogue text-xl font-bold text-on-background">Carrito</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant">
                        <MIcon name="close" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {items.length === 0 && (
                        <div className="text-center py-16 text-on-surface-variant">
                            <MIcon name="shopping_cart" size={48} />
                            <p className="mt-3 font-medium">El carrito está vacío</p>
                            <p className="text-xs mt-1">Agrega artículos para comenzar</p>
                        </div>
                    )}
                    {items.map(e => (
                        <div key={e.articleId} className="flex gap-3 items-center bg-surface-container-low rounded-2xl p-3">
                            <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
                                <ArticleThumb article={e.article} className="w-full h-full" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-on-background leading-tight line-clamp-2">{e.article.name}</p>
                                <p className="text-xs text-on-surface-variant mt-0.5">{fmt(e.article.price)} c/u</p>
                                <p className="text-sm font-bold text-primary mt-0.5">{fmt(e.article.price * e.qty)}</p>
                            </div>
                            <div className="flex items-center gap-1 bg-white border border-surface-variant rounded-full px-1 py-1 shadow-sm">
                                <button onClick={() => onDecrement(e.articleId)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface font-bold transition text-base">−</button>
                                <span className="w-6 text-center text-sm font-bold text-on-background">{e.qty}</span>
                                <button onClick={() => onIncrement(e.articleId)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface font-bold transition text-base">+</button>
                            </div>
                        </div>
                    ))}
                </div>

                {items.length > 0 && (
                    <div className="border-t border-surface-variant bg-white p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-on-surface-variant">{items.reduce((s, e) => s + e.qty, 0)} artículo{items.reduce((s, e) => s + e.qty, 0) !== 1 ? 's' : ''}</span>
                            <div className="text-right">
                                <p className="text-xs text-on-surface-variant">Total</p>
                                <p className="text-xl font-bold text-on-background">{fmt(subtotal)}</p>
                            </div>
                        </div>
                        <Button variant="filled" className="w-full" icon="arrow_forward" onClick={onCheckout}>
                            Ir al checkout
                        </Button>
                        <button onClick={onClear} className="w-full flex items-center justify-center gap-1.5 text-sm text-error hover:text-error/80 transition py-1">
                            <MIcon name="delete_sweep" size={16} />
                            Vaciar carrito
                        </button>
                    </div>
                )}
            </aside>
        </>
    );
};

// ---------- Modal de checkout ----------
const LAST_CUSTOMER_KEY = 'plantarte_last_customer_name';

interface CheckoutForm {
    customerName: string;
    notes: string;
}

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
                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${step >= s ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                            {s}
                        </div>
                        {s < 2 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-primary' : 'bg-surface-container-high'}`} />}
                    </React.Fragment>
                ))}
            </div>

            {step === 1 && (
                <div className="p-6 space-y-4">
                    <Field label="Nombre" required error={nameError}>
                        <Input
                            value={form.customerName}
                            onChange={e => { setForm(f => ({ ...f, customerName: e.target.value })); setNameError(''); }}
                            placeholder="Ej. María García"
                            autoFocus
                        />
                    </Field>
                    <Field label="Notas">
                        <Textarea
                            value={form.notes}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="Instrucciones especiales, alergias, etc."
                        />
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
    const [cartOpen, setCartOpen] = useState(false);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
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
            const order = await createStoreOrder(authToken, {
                customerName: form.customerName,
                notes: form.notes,
                items,
            });
            toast('success', `Pedido ${order.id} creado`);
            setCart([]);
            setCheckoutOpen(false);
            setCartOpen(false);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al crear el pedido');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="pb-32 md:pb-10">
            {/* storefront header */}
            <div className="bg-primary px-4 md:px-8 pt-8 pb-6" style={{ background: 'linear-gradient(135deg, #2d5a27 0%, #3b6934 60%, #4a7a42 100%)' }}>
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h1 className="font-epilogue text-3xl font-bold text-white">Tienda</h1>
                            <p className="text-white/70 text-sm mt-0.5">{articles.length > 0 ? `${articles.length} artículos disponibles` : 'Crea pedidos manuales'}</p>
                        </div>
                        {cartCount > 0 && (
                            <button
                                onClick={() => setCartOpen(true)}
                                className="relative bg-white/15 hover:bg-white/25 backdrop-blur text-white rounded-2xl px-4 py-2.5 flex items-center gap-2.5 transition border border-white/20"
                            >
                                <MIcon name="shopping_cart" fill />
                                <div className="text-left">
                                    <p className="text-xs font-medium text-white/80 leading-none">{cartCount} art{cartCount !== 1 ? 's' : '.'}</p>
                                    <p className="text-sm font-bold text-white leading-tight">{fmt(cartTotal)}</p>
                                </div>
                                <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
                                    {cartCount}
                                </span>
                            </button>
                        )}
                    </div>
                    {/* búsqueda */}
                    {!isLoading && articles.length > 0 && (
                        <div className="relative">
                            <MIcon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" />
                            <input
                                type="search"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Buscar artículo…"
                                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/15 border border-white/20 placeholder-white/50 text-white focus:bg-white/25 focus:outline-none focus:border-white/40 text-sm backdrop-blur transition"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
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
                        <h2 className="font-epilogue text-xl font-bold text-on-background">No hay artículos en el catálogo</h2>
                        <p className="text-on-surface-variant mt-1 max-w-sm">
                            Ve a <strong>Artículos</strong> y crea los primeros artículos para la tienda.
                        </p>
                    </div>
                )}

                {!isLoading && articles.length > 0 && (
                    <>
                        {activeSuppliers.length > 0 && (
                            <div className="flex gap-2 flex-wrap mb-5 overflow-x-auto pb-1 scrollbar-hide">
                                <Chip active={supplierFilter === 'todos'} onClick={() => setSupplierFilter('todos')}>Todos</Chip>
                                {activeSuppliers.map(s => (
                                    <Chip key={s.id} active={supplierFilter === s.id} onClick={() => setSupplierFilter(s.id)}>
                                        {s.name}
                                    </Chip>
                                ))}
                            </div>
                        )}

                        {filtered.length === 0 ? (
                            <div className="text-center py-12 text-on-surface-variant">
                                Sin resultados para "<strong>{query}</strong>"
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
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
                    </>
                )}
            </div>

            {/* FAB carrito (mobile, cuando header no visible) */}
            {cartCount > 0 && (
                <button
                    onClick={() => setCartOpen(true)}
                    className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-[60] bg-primary text-on-primary rounded-full shadow-lg px-5 py-3 flex items-center gap-3 hover:shadow-xl transition-shadow animate-[slideUp_0.2s_ease-out] md:hidden"
                >
                    <MIcon name="shopping_cart" fill />
                    <span className="font-semibold">{cartCount} art{cartCount !== 1 ? 's.' : '.'}</span>
                    <span className="bg-on-primary/20 rounded-full px-2 py-0.5 text-sm font-bold">{fmt(cartTotal)}</span>
                </button>
            )}

            <CartDrawer
                open={cartOpen}
                onClose={() => setCartOpen(false)}
                cart={cart}
                articles={articles}
                onIncrement={increment}
                onDecrement={decrement}
                onClear={() => setCart([])}
                onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
            />

            <CheckoutModal
                open={checkoutOpen}
                loading={submitting}
                onClose={() => setCheckoutOpen(false)}
                cart={cart}
                articles={articles}
                onConfirm={handleConfirm}
            />
        </main>
    );
};

export default StoreView;
