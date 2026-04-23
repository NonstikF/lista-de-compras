import React, { useState, useMemo } from 'react';
import { CATEGORIES, SUPPLIERS, PRODUCTS, type Product, type CartItem } from '../data/catalog';
import { MIcon, Modal, Button, Field, Input, Textarea, Chip, ProductThumb, fmt, StockBadge, useToast } from './ui';

// ---------- Store card ----------
interface StoreCardProps {
  product: Product;
  inCartQty: number;
  onAdd: () => void;
  onOpen: () => void;
  onQty: (q: number) => void;
}

const StoreCard: React.FC<StoreCardProps> = ({ product, inCartQty, onAdd, onOpen, onQty }) => {
  const isOut = product.stock === 0;
  return (
    <div className={`bg-surface-container-lowest rounded-2xl border overflow-hidden transition-all ${isOut ? 'opacity-60 border-surface-variant' : 'border-surface-variant hover:shadow-lg hover:border-primary/30'}`}>
      <button onClick={onOpen} className="block w-full text-left relative">
        <ProductThumb product={product} size="xl" className="rounded-none" />
        <div className="absolute top-2 right-2"><StockBadge stock={product.stock} /></div>
        {inCartQty > 0 && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-primary text-on-primary text-[11px] font-bold flex items-center gap-1 shadow-md">
            <MIcon name="check" className="text-sm" fill /> {inCartQty} en carrito
          </div>
        )}
      </button>
      <div className="p-3">
        <button onClick={onOpen} className="text-left w-full">
          <h3 className="font-epilogue font-semibold text-on-background text-sm leading-snug line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
          <p className="text-[11px] text-on-surface-variant font-mono mt-0.5 truncate">{product.sku}</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="font-epilogue text-xl font-bold text-primary">{fmt(product.price)}</span>
            <span className="text-[11px] text-on-surface-variant">/ {product.unit}</span>
          </div>
        </button>
        <div className="mt-3">
          {inCartQty === 0 ? (
            <button
              onClick={onAdd}
              disabled={isOut}
              className="w-full py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition flex items-center justify-center gap-1.5 disabled:bg-surface-container-high disabled:text-on-surface-variant"
            >
              <MIcon name="add_shopping_cart" className="text-base" fill /> {isOut ? 'Sin stock' : 'Agregar'}
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-primary-fixed/40 rounded-xl p-1 border border-primary-fixed">
              <button onClick={() => onQty(inCartQty - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-primary font-bold hover:bg-primary-fixed transition">−</button>
              <span className="flex-1 text-center font-bold text-primary">{inCartQty}</span>
              <button onClick={() => onQty(inCartQty + 1)} disabled={inCartQty >= product.stock} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-primary font-bold hover:bg-primary-fixed transition disabled:opacity-40">+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------- Product detail modal ----------
interface ProductDetailModalProps {
  product: Product;
  inCartQty: number;
  onClose: () => void;
  onAdd: (qty: number) => void;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, inCartQty, onClose, onAdd }) => {
  const [qty, setQty] = useState(1);
  const cat = CATEGORIES.find(c => c.id === product.category);
  const sup = SUPPLIERS.find(s => s.id === product.supplier);
  const isOut = product.stock === 0;

  return (
    <Modal open onClose={onClose} title={product.name} maxWidth="max-w-2xl" footer={
      <>
        <Button variant="outline" onClick={onClose}>Cerrar</Button>
        <Button icon="add_shopping_cart" iconFill onClick={() => onAdd(qty)} disabled={isOut}>
          {isOut ? 'Sin stock' : `Agregar ${qty} al carrito · ${fmt(product.price * qty)}`}
        </Button>
      </>
    }>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProductThumb product={product} size="xl" className="rounded-2xl" />
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-fixed/40 text-on-primary-fixed-variant">
              <MIcon name={cat?.icon ?? 'category'} className="text-sm" /> {cat?.name}
            </span>
            <StockBadge stock={product.stock} />
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-mono">{product.sku}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-epilogue text-4xl font-bold text-primary">{fmt(product.price)}</span>
              <span className="text-sm text-on-surface-variant">/ {product.unit}</span>
            </div>
          </div>
          <p className="text-sm text-on-surface-variant leading-relaxed">{product.description || 'Sin descripción.'}</p>
          {sup && (
            <div className="bg-surface-container-low rounded-xl p-3 text-sm">
              <div className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wider">Proveedor</div>
              <div className="font-semibold mt-1">{sup.name}</div>
              <div className="text-xs text-on-surface-variant">{sup.contact} · {sup.phone}</div>
            </div>
          )}
          <Field label="Cantidad">
            <div className="flex items-center gap-2">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-xl bg-surface-container-low border border-outline-variant font-bold">−</button>
              <input
                type="number" min="1" max={product.stock}
                value={qty}
                onChange={e => setQty(Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1)))}
                className="w-20 text-center px-2 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant font-bold text-lg"
              />
              <button onClick={() => setQty(q => Math.min(product.stock, q + 1))} className="w-10 h-10 rounded-xl bg-surface-container-low border border-outline-variant font-bold">+</button>
              <span className="text-xs text-on-surface-variant ml-2">máx {product.stock}</span>
            </div>
          </Field>
          {inCartQty > 0 && (
            <div className="flex items-center gap-2 p-2 bg-primary-fixed/30 rounded-lg text-xs text-on-primary-fixed-variant">
              <MIcon name="shopping_cart" className="text-base" fill /> Ya tienes {inCartQty} en tu carrito
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

// ---------- Cart drawer ----------
interface CartItemFull extends CartItem { product: Product; }

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItemFull[];
  subtotal: number;
  onQty: (productId: number, qty: number) => void;
  onNotes: (productId: number, notes: string) => void;
  onRemove: (productId: number) => void;
  onCheckout: () => void;
  onClear: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ open, onClose, items, subtotal, onQty, onNotes, onRemove, onCheckout, onClear }) => {
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});

  return (
    <>
      <div className={`fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <aside className={`fixed top-0 right-0 bottom-0 w-full sm:w-[440px] z-[71] bg-surface-container-lowest shadow-2xl flex flex-col transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-variant">
          <div>
            <h3 className="font-epilogue text-xl font-bold">Tu carrito</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">{items.length} producto{items.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-high">
            <MIcon name="close" className="text-xl" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-20">
              <MIcon name="shopping_cart" className="text-6xl text-on-surface-variant/30" />
              <h4 className="font-epilogue text-lg font-bold mt-2">Tu carrito está vacío</h4>
              <p className="text-sm text-on-surface-variant mt-1">Agrega productos desde el catálogo.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(({ product, qty, notes }) => (
                <div key={product.id} className="bg-surface-container-low rounded-xl p-3">
                  <div className="flex gap-3">
                    <ProductThumb product={product} size="md" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-on-background text-sm leading-tight truncate">{product.name}</h4>
                      <p className="text-[11px] text-on-surface-variant font-mono">{product.sku}</p>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="font-bold text-primary">{fmt(product.price)}</span>
                        <span className="text-[11px] text-on-surface-variant">/ {product.unit}</span>
                      </div>
                    </div>
                    <button onClick={() => onRemove(product.id)} className="p-1 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container self-start">
                      <MIcon name="close" className="text-lg" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-outline-variant">
                      <button onClick={() => onQty(product.id, qty - 1)} className="w-8 h-8 rounded-lg hover:bg-surface-container-low font-bold text-primary">−</button>
                      <input
                        type="number" min="1" max={product.stock}
                        value={qty}
                        onChange={e => onQty(product.id, Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1)))}
                        className="w-10 text-center font-bold bg-transparent outline-none"
                      />
                      <button onClick={() => onQty(product.id, qty + 1)} disabled={qty >= product.stock} className="w-8 h-8 rounded-lg hover:bg-surface-container-low font-bold text-primary disabled:opacity-40">+</button>
                    </div>
                    <div className="font-epilogue font-bold text-on-background">{fmt(product.price * qty)}</div>
                  </div>

                  <button
                    onClick={() => setExpandedNotes(e => ({ ...e, [product.id]: !e[product.id] }))}
                    className="text-xs text-primary font-semibold mt-2 flex items-center gap-1 hover:underline"
                  >
                    <MIcon name="edit_note" className="text-base" />
                    {notes ? 'Editar nota' : 'Agregar nota'}
                    {notes && <span className="ml-1 px-1.5 py-0 rounded-full bg-primary-fixed text-[10px]">•</span>}
                  </button>
                  {(expandedNotes[product.id] || notes) && (
                    <Textarea
                      value={notes}
                      onChange={e => onNotes(product.id, e.target.value)}
                      placeholder="Ej: elegir los más grandes, envolver aparte…"
                      rows={2}
                      className="mt-2 text-xs"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-surface-variant px-5 py-4 bg-surface-container-low">
            <div className="flex items-center justify-between mb-1 text-sm">
              <span className="text-on-surface-variant">Subtotal ({items.reduce((s, i) => s + i.qty, 0)} uds.)</span>
              <span className="font-semibold">{fmt(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-on-surface-variant">IVA (16%)</span>
              <span className="font-semibold">{fmt(subtotal * 0.16)}</span>
            </div>
            <div className="flex items-center justify-between mb-4 pt-3 border-t border-surface-variant">
              <span className="font-epilogue font-bold text-lg">Total</span>
              <span className="font-epilogue font-bold text-2xl text-primary">{fmt(subtotal * 1.16)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="md" onClick={onClear}>Vaciar</Button>
              <Button icon="arrow_forward" onClick={onCheckout} className="flex-1">Ir al checkout</Button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

// ---------- Checkout modal ----------
interface CustomerData { firstName: string; lastName: string; phone: string; email: string; address: string; }

interface CheckoutModalProps {
  items: CartItemFull[];
  subtotal: number;
  onClose: () => void;
  onPlace: (order: { id: number }) => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ items, subtotal, onClose, onPlace }) => {
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState<CustomerData>({ firstName: '', lastName: '', phone: '', email: '', address: '' });
  const [payment, setPayment] = useState('efectivo');
  const [deliveryType, setDeliveryType] = useState<'recoge' | 'envio'>('recoge');
  const [orderNote, setOrderNote] = useState('');
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const iva = subtotal * 0.16;
  const shipping = deliveryType === 'envio' ? 150 : 0;
  const total = subtotal + iva + shipping;
  const canContinue = customer.firstName.trim() && customer.lastName.trim() && customer.phone.trim();

  const handlePlace = () => {
    setSubmitting(true);
    setTimeout(() => {
      const id = Math.floor(10250 + Math.random() * 100);
      setCreatedOrderId(id);
      setStep(3);
      setSubmitting(false);
    }, 1200);
  };

  const updateCustomer = (k: keyof CustomerData, v: string) => setCustomer(c => ({ ...c, [k]: v }));

  return (
    <Modal
      open
      onClose={step === 3 && createdOrderId ? () => onPlace({ id: createdOrderId }) : onClose}
      title={step === 3 ? '¡Pedido creado!' : 'Finalizar pedido'}
      maxWidth="max-w-3xl"
      footer={
        step === 1 ? (
          <>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button icon="arrow_forward" disabled={!canContinue} onClick={() => setStep(2)}>Revisar pedido</Button>
          </>
        ) : step === 2 ? (
          <>
            <Button variant="outline" icon="arrow_back" onClick={() => setStep(1)}>Atrás</Button>
            <Button icon={submitting ? 'hourglass_empty' : 'check_circle'} iconFill disabled={submitting} onClick={handlePlace}>
              {submitting ? 'Enviando…' : `Confirmar pedido · ${fmt(total)}`}
            </Button>
          </>
        ) : (
          <Button icon="done_all" onClick={() => onPlace({ id: createdOrderId! })}>Listo</Button>
        )
      }
    >
      {step < 3 && (
        <div className="flex items-center gap-2 px-6 pt-5">
          {[1, 2].map(n => (
            <React.Fragment key={n}>
              <div className={`flex items-center gap-2 ${step >= n ? 'text-primary' : 'text-on-surface-variant'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= n ? 'bg-primary text-on-primary' : 'bg-surface-container-high'}`}>
                  {step > n ? <MIcon name="check" className="text-base" /> : n}
                </div>
                <span className="text-sm font-semibold">{n === 1 ? 'Cliente' : 'Revisar y pagar'}</span>
              </div>
              {n < 2 && <div className={`flex-1 h-0.5 ${step > n ? 'bg-primary' : 'bg-surface-variant'}`} />}
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="p-6">
        {/* Step 1 */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <h4 className="font-epilogue font-bold text-on-background mb-1">Datos del cliente</h4>
              <p className="text-xs text-on-surface-variant">Se usarán para el pedido en WooCommerce.</p>
            </div>
            <Field label="Nombre" required>
              <input value={customer.firstName} onChange={e => updateCustomer('firstName', e.target.value)} placeholder="Ana"
                className="px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white outline-none text-sm text-on-surface" />
            </Field>
            <Field label="Apellidos" required>
              <input value={customer.lastName} onChange={e => updateCustomer('lastName', e.target.value)} placeholder="Gómez"
                className="px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white outline-none text-sm text-on-surface" />
            </Field>
            <Field label="Teléfono" required>
              <input value={customer.phone} onChange={e => updateCustomer('phone', e.target.value)} placeholder="55 1234 5678"
                className="px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white outline-none text-sm text-on-surface" />
            </Field>
            <Field label="Email">
              <input type="email" value={customer.email} onChange={e => updateCustomer('email', e.target.value)} placeholder="ana@correo.com"
                className="px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white outline-none text-sm text-on-surface" />
            </Field>
            <div className="md:col-span-2 pt-3 border-t border-surface-variant">
              <h4 className="font-epilogue font-bold text-on-background mb-2">Entrega</h4>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button onClick={() => setDeliveryType('recoge')} className={`p-3 rounded-xl border-2 text-left transition ${deliveryType === 'recoge' ? 'border-primary bg-primary-fixed/30' : 'border-surface-variant hover:border-primary/50'}`}>
                  <MIcon name="storefront" className="text-xl text-primary" fill={deliveryType === 'recoge'} />
                  <div className="font-semibold text-sm mt-1">Recoge en tienda</div>
                  <div className="text-xs text-on-surface-variant">Sin cargo</div>
                </button>
                <button onClick={() => setDeliveryType('envio')} className={`p-3 rounded-xl border-2 text-left transition ${deliveryType === 'envio' ? 'border-primary bg-primary-fixed/30' : 'border-surface-variant hover:border-primary/50'}`}>
                  <MIcon name="local_shipping" className="text-xl text-primary" fill={deliveryType === 'envio'} />
                  <div className="font-semibold text-sm mt-1">Envío a domicilio</div>
                  <div className="text-xs text-on-surface-variant">$150 · CDMX</div>
                </button>
              </div>
              {deliveryType === 'envio' && (
                <Field label="Dirección de envío">
                  <Textarea value={customer.address} onChange={e => updateCustomer('address', e.target.value)} placeholder="Calle, número, colonia, CP…" />
                </Field>
              )}
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="bg-surface-container-low rounded-xl p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-fixed/50 text-primary flex items-center justify-center flex-shrink-0">
                <MIcon name="person" fill className="text-xl" />
              </div>
              <div className="flex-1 text-sm">
                <div className="font-semibold text-on-background">{customer.firstName} {customer.lastName}</div>
                <div className="text-on-surface-variant">{customer.phone}{customer.email ? ` · ${customer.email}` : ''}</div>
                <div className="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                  <MIcon name={deliveryType === 'recoge' ? 'storefront' : 'local_shipping'} className="text-sm" />
                  {deliveryType === 'recoge' ? 'Recoge en tienda' : customer.address || 'Envío a domicilio'}
                </div>
              </div>
              <button onClick={() => setStep(1)} className="text-xs text-primary font-semibold hover:underline">Editar</button>
            </div>

            <div>
              <h4 className="font-epilogue font-bold text-on-background mb-2">Productos ({items.length})</h4>
              <div className="border border-surface-variant rounded-xl divide-y divide-surface-variant overflow-hidden">
                {items.map(({ product, qty, notes }) => (
                  <div key={product.id} className="flex items-center gap-3 p-3 bg-white">
                    <ProductThumb product={product} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{product.name}</div>
                      <div className="text-xs text-on-surface-variant">{qty} × {fmt(product.price)}</div>
                      {notes && (
                        <div className="text-xs text-on-surface-variant italic mt-0.5 flex items-start gap-1">
                          <MIcon name="sticky_note_2" className="text-sm" />{notes}
                        </div>
                      )}
                    </div>
                    <div className="font-bold text-on-background">{fmt(product.price * qty)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-epilogue font-bold text-on-background mb-2">Forma de pago</h4>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'efectivo', label: 'Efectivo',  icon: 'payments' },
                  { id: 'tarjeta',  label: 'Tarjeta',   icon: 'credit_card' },
                  { id: 'transfer', label: 'Transfer.',  icon: 'account_balance' },
                ].map(p => (
                  <button key={p.id} onClick={() => setPayment(p.id)} className={`p-3 rounded-xl border-2 text-left transition ${payment === p.id ? 'border-primary bg-primary-fixed/30' : 'border-surface-variant hover:border-primary/50'}`}>
                    <MIcon name={p.icon} className="text-xl text-primary" fill={payment === p.id} />
                    <div className="font-semibold text-sm mt-1">{p.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <Field label="Nota del pedido (opcional)">
              <Textarea value={orderNote} onChange={e => setOrderNote(e.target.value)} placeholder="Instrucciones especiales para el surtidor…" rows={2} />
            </Field>

            <div className="bg-primary-fixed/30 rounded-xl p-4 border border-primary-fixed">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-on-surface-variant">Subtotal</span>
                <span className="font-semibold">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-on-surface-variant">IVA (16%)</span>
                <span className="font-semibold">{fmt(iva)}</span>
              </div>
              {deliveryType === 'envio' && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-on-surface-variant">Envío</span>
                  <span className="font-semibold">{fmt(150)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline mt-2 pt-2 border-t border-primary-fixed-dim">
                <span className="font-epilogue font-bold">Total</span>
                <span className="font-epilogue text-2xl font-bold text-primary">{fmt(total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && createdOrderId && (
          <div className="py-8 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary text-on-primary flex items-center justify-center mb-4 animate-bounce">
              <MIcon name="check" className="text-5xl" fill />
            </div>
            <h3 className="font-epilogue text-2xl font-bold">Pedido #{createdOrderId} creado</h3>
            <p className="text-on-surface-variant mt-1">Se envió a WooCommerce como <strong>processing</strong> y al bot de Telegram.</p>
            <div className="grid grid-cols-2 gap-3 mt-6 max-w-md mx-auto">
              <div className="bg-surface-container-low rounded-xl p-3">
                <div className="text-[11px] text-on-surface-variant uppercase font-semibold">Cliente</div>
                <div className="font-semibold mt-1 text-sm">{customer.firstName} {customer.lastName}</div>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3">
                <div className="text-[11px] text-on-surface-variant uppercase font-semibold">Total</div>
                <div className="font-epilogue font-bold text-primary mt-1">{fmt(total)}</div>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3">
                <div className="text-[11px] text-on-surface-variant uppercase font-semibold">Productos</div>
                <div className="font-semibold mt-1 text-sm">{items.length} · {items.reduce((s, i) => s + i.qty, 0)} uds.</div>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3">
                <div className="text-[11px] text-on-surface-variant uppercase font-semibold">Pago</div>
                <div className="font-semibold mt-1 text-sm capitalize">{payment}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ---------- Scanner modal ----------
const ScannerModal: React.FC<{ onClose: () => void; onResult: (sku: string) => void }> = ({ onClose, onResult }) => {
  const [manual, setManual] = useState('');
  const suggestions = PRODUCTS.slice(0, 6);

  return (
    <Modal open onClose={onClose} title="Escanear SKU" maxWidth="max-w-md" footer={
      <>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button icon="check" disabled={!manual.trim()} onClick={() => onResult(manual.trim())}>Agregar</Button>
      </>
    }>
      <div className="p-6">
        <div className="aspect-video rounded-2xl bg-black relative overflow-hidden mb-4">
          <div className="absolute inset-0 flex items-center justify-center text-white/60">
            <div className="text-center">
              <MIcon name="qr_code_scanner" className="text-6xl" />
              <p className="text-xs mt-2">Apunta la cámara al código del producto</p>
            </div>
          </div>
          <div className="absolute inset-x-8 top-1/2 h-0.5 bg-primary shadow-[0_0_12px_3px_rgba(60,150,60,0.6)] animate-[scanLine_2s_ease-in-out_infinite]" />
          {(['top-4 left-4 border-t-2 border-l-2', 'top-4 right-4 border-t-2 border-r-2', 'bottom-4 left-4 border-b-2 border-l-2', 'bottom-4 right-4 border-b-2 border-r-2'] as const).map((c, i) => (
            <div key={i} className={`absolute w-8 h-8 border-primary rounded ${c}`} />
          ))}
        </div>

        <Field label="O captura el SKU manualmente">
          <Input value={manual} onChange={e => setManual(e.target.value.toUpperCase())} placeholder="PLT-MONS-01" className="font-mono" autoFocus />
        </Field>

        <div className="mt-4">
          <div className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wider mb-2">SKUs disponibles</div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map(p => (
              <button key={p.id} onClick={() => onResult(p.sku)} className="px-2 py-1 rounded-lg bg-surface-container-low border border-outline-variant font-mono text-xs hover:bg-primary-fixed hover:border-primary transition">
                {p.sku}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ---------- Main view ----------
const StoreView: React.FC = () => {
  const toast = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('todas');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);

  const productById = useMemo(() => Object.fromEntries(PRODUCTS.map(p => [p.id, p])), []);

  const filtered = useMemo(() => {
    return PRODUCTS.filter(p => {
      if (category !== 'todas' && p.category !== category) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      }
      return true;
    });
  }, [query, category]);

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { todas: PRODUCTS.length };
    CATEGORIES.forEach(c => { counts[c.id] = PRODUCTS.filter(p => p.category === c.id).length; });
    return counts;
  }, []);

  const cartItems: (CartItem & { product: Product })[] = cart
    .map(ci => ({ ...ci, product: productById[ci.productId] }))
    .filter(ci => ci.product);

  const cartSubtotal = cartItems.reduce((s, ci) => s + ci.product.price * ci.qty, 0);
  const cartCount    = cartItems.reduce((s, ci) => s + ci.qty, 0);

  const addToCart = (product: Product, qty = 1) => {
    setCart(c => {
      const existing = c.find(ci => ci.productId === product.id);
      if (existing) return c.map(ci => ci.productId === product.id ? { ...ci, qty: ci.qty + qty } : ci);
      return [...c, { productId: product.id, qty, notes: '' }];
    });
    toast('success', `${product.name} agregado`);
  };

  const updateQty = (productId: number, qty: number) => {
    if (qty <= 0) return removeFromCart(productId);
    setCart(c => c.map(ci => ci.productId === productId ? { ...ci, qty } : ci));
  };

  const updateNotes = (productId: number, notes: string) => {
    setCart(c => c.map(ci => ci.productId === productId ? { ...ci, notes } : ci));
  };

  const removeFromCart = (productId: number) => setCart(c => c.filter(ci => ci.productId !== productId));

  const handleScanResult = (sku: string) => {
    const p = PRODUCTS.find(x => x.sku.toLowerCase() === sku.toLowerCase());
    if (p) { addToCart(p); setScannerOpen(false); }
    else toast('error', `SKU "${sku}" no encontrado`);
  };

  const handlePlaceOrder = (_order: { id: number }) => {
    toast('success', `Pedido #${_order.id} enviado a WooCommerce`);
    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-10 relative">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-epilogue text-3xl md:text-4xl font-bold text-on-background">Tienda</h1>
          <p className="text-on-surface-variant mt-1 text-sm">Crea un pedido agregando productos al carrito</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" icon="qr_code_scanner" onClick={() => setScannerOpen(true)}>Escanear SKU</Button>
          <div className="relative">
            <Button icon="shopping_cart" iconFill onClick={() => setCartOpen(true)}>Carrito</Button>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-secondary text-on-secondary text-xs font-bold flex items-center justify-center border-2 border-background pointer-events-none">
                {cartCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <MIcon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nombre o SKU…"
          className="w-full pl-12 pr-4 py-3 rounded-2xl bg-surface-container-lowest border border-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base shadow-sm"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
        <Chip active={category === 'todas'} onClick={() => setCategory('todas')} icon="apps" count={catCounts['todas']}>Todas</Chip>
        {CATEGORIES.map(c => (
          <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)} icon={c.icon} count={catCounts[c.id]}>{c.name}</Chip>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant">
          <MIcon name="search_off" className="text-6xl text-on-surface-variant/50" />
          <h3 className="mt-2 font-epilogue text-xl font-bold">Sin resultados</h3>
          <p className="text-sm text-on-surface-variant mt-1">Prueba con otro término o categoría.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(p => {
            const inCart = cartItems.find(ci => ci.productId === p.id);
            return (
              <StoreCard
                key={p.id}
                product={p}
                inCartQty={inCart?.qty ?? 0}
                onAdd={() => addToCart(p)}
                onOpen={() => setDetail(p)}
                onQty={q => updateQty(p.id, q)}
              />
            );
          })}
        </div>
      )}

      {/* Sticky cart FAB */}
      {cartCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-6 z-40 bg-primary text-on-primary rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-3 hover:bg-primary-container transition animate-[slideUp_0.3s_ease-out]"
        >
          <div className="relative">
            <MIcon name="shopping_cart" className="text-2xl" fill />
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-secondary text-on-secondary text-[10px] font-bold flex items-center justify-center">
              {cartCount}
            </span>
          </div>
          <div className="text-left">
            <div className="text-xs opacity-80 leading-none">Ver carrito</div>
            <div className="font-epilogue font-bold leading-tight">{fmt(cartSubtotal)}</div>
          </div>
          <MIcon name="arrow_forward" />
        </button>
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        subtotal={cartSubtotal}
        onQty={updateQty}
        onNotes={updateNotes}
        onRemove={removeFromCart}
        onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
        onClear={() => { setCart([]); toast('info', 'Carrito vacío'); }}
      />

      {detail && (
        <ProductDetailModal
          product={detail}
          inCartQty={cartItems.find(ci => ci.productId === detail.id)?.qty ?? 0}
          onClose={() => setDetail(null)}
          onAdd={qty => { addToCart(detail, qty); setDetail(null); }}
        />
      )}

      {checkoutOpen && (
        <CheckoutModal items={cartItems} subtotal={cartSubtotal} onClose={() => setCheckoutOpen(false)} onPlace={handlePlaceOrder} />
      )}

      {scannerOpen && <ScannerModal onClose={() => setScannerOpen(false)} onResult={handleScanResult} />}
    </div>
  );
};

export default StoreView;
