import React, { useState, useMemo, useRef } from 'react';
import { CATEGORIES, SUPPLIERS, PRODUCTS, PURCHASE_HISTORY, type Product } from '../data/catalog';
import { MIcon, Modal, Button, Field, Input, Select, Textarea, Chip, ProductThumb, fmt, StockBadge, useToast } from './ui';

// ---------- Stat card ----------
interface StatCardProps { label: string; value: number; icon: string; tone: 'primary' | 'success' | 'warn' | 'error'; }

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, tone }) => {
  const tones = {
    primary: 'text-primary bg-primary-fixed/50',
    success: 'text-[#40916C] bg-[#40916C]/10',
    warn:    'text-secondary bg-secondary-container/60',
    error:   'text-error bg-error-container',
  };
  return (
    <div className="bg-surface-container-lowest border border-surface-variant rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tones[tone]}`}>
        <MIcon name={icon} fill className="text-xl" />
      </div>
      <div className="min-w-0">
        <div className="font-epilogue text-2xl font-bold text-on-background leading-none">{value}</div>
        <div className="text-xs text-on-surface-variant mt-1">{label}</div>
      </div>
    </div>
  );
};

// ---------- Grid card ----------
interface ProductCardProps {
  product: Product;
  onEdit: () => void;
  onHistory: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, onHistory }) => {
  const cat = CATEGORIES.find(c => c.id === product.category);
  const sup = SUPPLIERS.find(s => s.id === product.supplier);
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-surface-variant overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all group">
      <div className="relative">
        <ProductThumb product={product} size="xl" className="rounded-none" />
        <div className="absolute top-2 right-2"><StockBadge stock={product.stock} /></div>
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/90 backdrop-blur text-on-surface">
            <MIcon name={cat?.icon ?? 'category'} className="text-sm" />
            {cat?.name}
          </span>
        </div>
      </div>
      <div className="p-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-epilogue font-semibold text-on-background text-sm leading-snug line-clamp-2">{product.name}</h3>
          <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">{product.sku}</p>
        </div>
        <div className="flex items-baseline justify-between mt-3">
          <span className="font-epilogue text-xl font-bold text-primary">{fmt(product.price)}</span>
          <span className="text-[11px] text-on-surface-variant">costo {fmt(product.cost)}</span>
        </div>
        <p className="text-[11px] text-on-surface-variant mt-1 truncate">{sup?.name}</p>
        <div className="flex gap-1 mt-3 pt-3 border-t border-surface-variant">
          <button onClick={onHistory} className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container hover:text-primary transition flex items-center justify-center gap-1">
            <MIcon name="history" className="text-base" /> Historial
          </button>
          <button onClick={onEdit} className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-primary bg-primary-fixed/40 hover:bg-primary-fixed transition flex items-center justify-center gap-1">
            <MIcon name="edit" className="text-base" /> Editar
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------- Table view ----------
interface ProductTableProps {
  products: Product[];
  onEdit: (p: Product) => void;
  onHistory: (p: Product) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({ products, onEdit, onHistory }) => {
  const catById = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
  const supById = Object.fromEntries(SUPPLIERS.map(s => [s.id, s]));
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-surface-variant overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-low border-b border-surface-variant">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3 hidden md:table-cell">SKU</th>
              <th className="px-4 py-3 hidden lg:table-cell">Categoría</th>
              <th className="px-4 py-3 hidden lg:table-cell">Proveedor</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-center">Stock</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-variant">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-surface-container-low transition">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ProductThumb product={p} size="sm" />
                    <div className="min-w-0">
                      <div className="font-semibold text-on-background truncate max-w-[200px]">{p.name}</div>
                      <div className="text-[11px] text-on-surface-variant md:hidden font-mono">{p.sku}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-on-surface-variant">{p.sku}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-on-surface-variant">{catById[p.category]?.name}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-on-surface-variant">{supById[p.supplier]?.name}</td>
                <td className="px-4 py-3 text-right font-semibold text-primary">{fmt(p.price)}</td>
                <td className="px-4 py-3 text-center"><StockBadge stock={p.stock} /></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => onHistory(p)} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-primary" title="Historial">
                      <MIcon name="history" className="text-lg" />
                    </button>
                    <button onClick={() => onEdit(p)} className="p-1.5 rounded-lg hover:bg-primary-fixed/50 text-primary" title="Editar">
                      <MIcon name="edit" className="text-lg" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ---------- Edit / Create modal ----------
type ProductForm = Omit<Product, 'id'> & { id?: number };

interface ProductEditModalProps {
  product: Product | null;
  onClose: () => void;
  onSave: (p: Product) => void;
  onDelete?: (p: Product) => void;
}

const ProductEditModal: React.FC<ProductEditModalProps> = ({ product, onClose, onSave, onDelete }) => {
  const isNew = !product;
  const [form, setForm] = useState<ProductForm>(product ?? {
    sku: '', name: '', category: CATEGORIES[0].id, supplier: SUPPLIERS[0].id,
    price: 0, cost: 0, stock: 0, unit: 'pza', image: null, description: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ProductForm, string>>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Partial<Record<keyof ProductForm, string>> = {};
    if (!form.sku.trim()) e.sku = 'Requerido';
    if (!form.name.trim()) e.name = 'Requerido';
    if (form.price < 0) e.price = 'No puede ser negativo';
    if (form.cost < 0) e.cost = 'No puede ser negativo';
    if (form.stock < 0) e.stock = 'No puede ser negativo';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    onSave({
      ...form,
      id: form.id ?? Date.now(),
      price: Number(form.price),
      cost:  Number(form.cost),
      stock: Number(form.stock),
    });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => update('image', ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const margin = form.price > 0 ? Math.round(((form.price - form.cost) / form.price) * 100) : 0;

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-3xl"
      title={isNew ? 'Nuevo producto' : `Editar: ${product!.name}`}
      footer={
        <>
          {onDelete && product && (
            <Button variant="text" icon="delete" onClick={() => onDelete(product)} className="!text-error hover:!bg-error-container mr-auto">
              Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button icon="check" onClick={submit}>{isNew ? 'Crear producto' : 'Guardar cambios'}</Button>
        </>
      }
    >
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Imagen */}
        <div className="md:col-span-1">
          <Field label="Imagen del producto">
            <div
              onClick={() => fileRef.current?.click()}
              className="aspect-square rounded-2xl border-2 border-dashed border-outline-variant hover:border-primary cursor-pointer flex items-center justify-center overflow-hidden relative bg-surface-container-low group"
            >
              {form.image ? (
                <>
                  <img src={form.image} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white">
                    <MIcon name="photo_camera" className="text-3xl" />
                    <span className="text-xs font-semibold mt-1">Cambiar</span>
                  </div>
                </>
              ) : (
                <div className="text-center p-4">
                  <MIcon name="add_photo_alternate" className="text-5xl text-on-surface-variant/60" />
                  <p className="text-xs text-on-surface-variant mt-2">Toca para subir imagen</p>
                  <p className="text-[10px] text-on-surface-variant/60 mt-1">JPG o PNG · máx 2MB</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </Field>
          {form.image && (
            <button onClick={() => update('image', null)} className="text-xs text-error hover:underline mt-2 flex items-center gap-1">
              <MIcon name="delete" className="text-sm" /> Quitar imagen
            </button>
          )}
        </div>

        {/* Info */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <Field label="Nombre" required error={errors.name}>
            <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ej: Monstera Deliciosa" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU" required error={errors.sku}>
              <Input value={form.sku} onChange={e => update('sku', e.target.value.toUpperCase())} placeholder="PLT-MONS-01" className="font-mono" />
            </Field>
            <Field label="Unidad">
              <Select value={form.unit} onChange={e => update('unit', e.target.value)}>
                <option value="pza">Pieza</option>
                <option value="bolsa">Bolsa</option>
                <option value="kg">Kilogramo</option>
                <option value="lt">Litro</option>
                <option value="paquete">Paquete</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría" required>
              <Select value={form.category} onChange={e => update('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Proveedor">
              <Select value={form.supplier} onChange={e => update('supplier', e.target.value)}>
                {SUPPLIERS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Costo" error={errors.cost as string | undefined}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">$</span>
                <Input type="number" min="0" step="0.01" value={form.cost} onChange={e => update('cost', Number(e.target.value))} className="pl-6" />
              </div>
            </Field>
            <Field label="Precio venta" required error={errors.price as string | undefined}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">$</span>
                <Input type="number" min="0" step="0.01" value={form.price} onChange={e => update('price', Number(e.target.value))} className="pl-6" />
              </div>
            </Field>
            <Field label="Stock" error={errors.stock as string | undefined}>
              <Input type="number" min="0" step="1" value={form.stock} onChange={e => update('stock', Number(e.target.value))} />
            </Field>
          </div>

          <div className="flex items-center gap-3 p-3 bg-primary-fixed/30 rounded-xl border border-primary-fixed">
            <MIcon name="trending_up" className="text-primary text-xl" fill />
            <div className="flex-1">
              <div className="text-xs text-on-surface-variant">Margen calculado</div>
              <div className="font-epilogue font-bold text-primary">
                {margin}% · Utilidad {fmt(Number(form.price) - Number(form.cost))}
              </div>
            </div>
          </div>

          <Field label="Descripción">
            <Textarea value={form.description ?? ''} onChange={e => update('description', e.target.value)} rows={3} placeholder="Notas, presentación, tamaño…" />
          </Field>
        </div>
      </div>
    </Modal>
  );
};

// ---------- History modal ----------
const ProductHistoryModal: React.FC<{ product: Product; onClose: () => void }> = ({ product, onClose }) => {
  const history = PURCHASE_HISTORY[product.id] ?? [];
  const totalUnits = history.reduce((s, h) => s + h.qty, 0);
  const totalRevenue = history.reduce((s, h) => s + h.qty * h.unitPrice, 0);

  return (
    <Modal open onClose={onClose} title="Historial de compras" maxWidth="max-w-2xl" footer={<Button onClick={onClose}>Cerrar</Button>}>
      <div className="p-6">
        <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl mb-5">
          <ProductThumb product={product} size="lg" />
          <div className="flex-1 min-w-0">
            <h4 className="font-epilogue font-bold text-on-background">{product.name}</h4>
            <p className="text-xs text-on-surface-variant font-mono">{product.sku}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold text-primary">{fmt(product.price)}</span>
              <StockBadge stock={product.stock} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-surface-container-low rounded-xl p-3 text-center">
            <div className="font-epilogue text-2xl font-bold text-on-background">{history.length}</div>
            <div className="text-[11px] text-on-surface-variant mt-0.5">Pedidos</div>
          </div>
          <div className="bg-surface-container-low rounded-xl p-3 text-center">
            <div className="font-epilogue text-2xl font-bold text-on-background">{totalUnits}</div>
            <div className="text-[11px] text-on-surface-variant mt-0.5">Unidades</div>
          </div>
          <div className="bg-primary-fixed/40 rounded-xl p-3 text-center">
            <div className="font-epilogue text-2xl font-bold text-primary">{fmt(totalRevenue)}</div>
            <div className="text-[11px] text-on-surface-variant mt-0.5">Ingresos</div>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-10 text-on-surface-variant text-sm">
            <MIcon name="receipt_long" className="text-5xl opacity-30" />
            <p className="mt-2">Este producto aún no aparece en pedidos.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container-low transition border border-transparent hover:border-surface-variant">
                <div className="w-10 h-10 rounded-full bg-primary-fixed/50 flex items-center justify-center text-primary">
                  <MIcon name="shopping_bag" fill className="text-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-on-background">Pedido #{h.orderId}</span>
                    <span className="text-xs text-on-surface-variant">·</span>
                    <span className="text-xs text-on-surface-variant">{new Date(h.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="text-xs text-on-surface-variant mt-0.5">{h.customer}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-on-background">{h.qty} × {fmt(h.unitPrice)}</div>
                  <div className="text-xs text-primary font-semibold">{fmt(h.qty * h.unitPrice)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

// ---------- Import modal ----------
interface ImportModalProps { onClose: () => void; onImported: (n: number) => void; }

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImported }) => {
  const [step, setStep] = useState<'config' | 'loading' | 'done'>('config');
  const [mode, setMode] = useState<'woo' | 'csv'>('woo');
  const [progress, setProgress] = useState(0);
  const count = 147;

  const runImport = () => {
    setStep('loading');
    setProgress(0);
    const i = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(i); setStep('done'); return 100; }
        return p + 4;
      });
    }, 60);
  };

  return (
    <Modal open onClose={onClose} title="Importar catálogo" maxWidth="max-w-xl" footer={
      step === 'done' ? (
        <Button icon="check" onClick={() => onImported(count)}>Listo</Button>
      ) : step === 'loading' ? undefined : (
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button icon="download" onClick={runImport}>Importar ahora</Button>
        </>
      )
    }>
      <div className="p-6">
        {step === 'config' && (
          <>
            <div className="flex gap-2 mb-5">
              <button onClick={() => setMode('woo')} className={`flex-1 p-4 rounded-xl border-2 transition text-left ${mode === 'woo' ? 'border-primary bg-primary-fixed/30' : 'border-surface-variant hover:border-primary/50'}`}>
                <MIcon name="cloud_sync" className="text-2xl text-primary" fill={mode === 'woo'} />
                <div className="font-epilogue font-bold mt-2 text-on-background">WooCommerce</div>
                <div className="text-xs text-on-surface-variant mt-1">Sincronizar desde tu tienda en línea</div>
              </button>
              <button onClick={() => setMode('csv')} className={`flex-1 p-4 rounded-xl border-2 transition text-left ${mode === 'csv' ? 'border-primary bg-primary-fixed/30' : 'border-surface-variant hover:border-primary/50'}`}>
                <MIcon name="upload_file" className="text-2xl text-primary" fill={mode === 'csv'} />
                <div className="font-epilogue font-bold mt-2 text-on-background">Archivo CSV</div>
                <div className="text-xs text-on-surface-variant mt-1">Subir lista de productos</div>
              </button>
            </div>

            {mode === 'woo' ? (
              <div className="space-y-3">
                <Field label="URL de la tienda">
                  <Input defaultValue="https://plantarte.com.mx" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Consumer Key"><Input defaultValue="ck_••••••••••••" className="font-mono" /></Field>
                  <Field label="Consumer Secret"><Input defaultValue="cs_••••••••••••" className="font-mono" /></Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-on-surface-variant mt-2">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary" />
                  Actualizar productos existentes (match por SKU)
                </label>
                <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary" />
                  Importar imágenes y stock
                </label>
                <div className="p-3 bg-primary-fixed/30 rounded-xl text-xs text-on-primary-fixed-variant flex gap-2">
                  <MIcon name="info" className="text-base" fill />
                  <span>Se detectaron <strong>{count} productos</strong> en tu tienda de WooCommerce.</span>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-outline-variant rounded-xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary-fixed/10 transition">
                <MIcon name="upload_file" className="text-5xl text-on-surface-variant/60" />
                <p className="font-semibold text-on-background mt-2">Arrastra tu archivo CSV aquí</p>
                <p className="text-xs text-on-surface-variant mt-1">o haz clic para seleccionar · columnas: sku, nombre, categoría, precio, stock</p>
                <Button variant="outline" size="sm" icon="description" className="mt-4">Descargar plantilla</Button>
              </div>
            )}
          </>
        )}

        {step === 'loading' && (
          <div className="py-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary-fixed/40 flex items-center justify-center mb-4">
              <MIcon name="cloud_sync" className="text-4xl text-primary animate-pulse" fill />
            </div>
            <h4 className="font-epilogue font-bold text-lg">Importando productos…</h4>
            <p className="text-sm text-on-surface-variant mt-1">Sincronizando desde WooCommerce</p>
            <div className="mt-5 w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-xs text-on-surface-variant mt-2">{Math.round(progress * count / 100)} / {count}</div>
          </div>
        )}

        {step === 'done' && (
          <div className="py-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary text-on-primary flex items-center justify-center mb-4">
              <MIcon name="check" className="text-5xl" fill />
            </div>
            <h4 className="font-epilogue font-bold text-xl">¡Importación completada!</h4>
            <p className="text-sm text-on-surface-variant mt-1">Se importaron <strong className="text-on-background">{count} productos</strong> desde WooCommerce.</p>
            <div className="grid grid-cols-3 gap-2 mt-5">
              <div className="bg-primary-fixed/30 rounded-xl p-3">
                <div className="font-epilogue text-xl font-bold text-primary">89</div>
                <div className="text-[11px] text-on-surface-variant">Nuevos</div>
              </div>
              <div className="bg-secondary-container/50 rounded-xl p-3">
                <div className="font-epilogue text-xl font-bold text-on-secondary-container">54</div>
                <div className="text-[11px] text-on-surface-variant">Actualizados</div>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3">
                <div className="font-epilogue text-xl font-bold text-on-surface">4</div>
                <div className="text-[11px] text-on-surface-variant">Omitidos</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ---------- Main view ----------
const ProductsView: React.FC = () => {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [supplierFilter, setSupplierFilter] = useState('todos');
  const [stockFilter, setStockFilter] = useState('todos');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [history, setHistory] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (categoryFilter !== 'todas' && p.category !== categoryFilter) return false;
      if (supplierFilter !== 'todos' && p.supplier !== supplierFilter) return false;
      if (stockFilter === 'disponibles' && p.stock <= 0) return false;
      if (stockFilter === 'bajos' && (p.stock === 0 || p.stock >= 5)) return false;
      if (stockFilter === 'sin' && p.stock !== 0) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      }
      return true;
    });
  }, [products, query, categoryFilter, supplierFilter, stockFilter]);

  const stats = useMemo(() => ({
    total:        products.length,
    disponibles:  products.filter(p => p.stock > 0).length,
    bajo:         products.filter(p => p.stock > 0 && p.stock < 5).length,
    sin:          products.filter(p => p.stock === 0).length,
    valorInventario: products.reduce((s, p) => s + p.cost * p.stock, 0),
  }), [products]);

  const handleSave = (prod: Product) => {
    if (products.some(p => p.id === prod.id)) {
      setProducts(ps => ps.map(p => p.id === prod.id ? prod : p));
      toast('success', `${prod.name} actualizado`);
    } else {
      setProducts(ps => [prod, ...ps]);
      toast('success', `${prod.name} agregado al catálogo`);
    }
    setEditing(null);
  };

  const handleDelete = (prod: Product) => {
    if (!window.confirm(`¿Eliminar "${prod.name}" del catálogo?`)) return;
    setProducts(ps => ps.filter(p => p.id !== prod.id));
    toast('success', 'Producto eliminado');
    setEditing(null);
  };

  const clearFilters = () => { setQuery(''); setCategoryFilter('todas'); setSupplierFilter('todos'); setStockFilter('todos'); };
  const hasFilters = categoryFilter !== 'todas' || supplierFilter !== 'todos' || stockFilter !== 'todos' || !!query;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-epilogue text-3xl md:text-4xl font-bold text-on-background">Productos</h1>
          <p className="text-on-surface-variant mt-1 text-sm">
            Catálogo interno · {stats.total} productos · Valor inventario{' '}
            <span className="font-semibold text-on-background">{fmt(stats.valorInventario)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" icon="sync" onClick={() => setImportOpen(true)}>Importar WooCommerce</Button>
          <Button icon="add" iconFill onClick={() => setEditing('new')}>Nuevo producto</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total"       value={stats.total}       icon="inventory_2"  tone="primary" />
        <StatCard label="Disponibles" value={stats.disponibles} icon="check_circle" tone="success" />
        <StatCard label="Stock bajo"  value={stats.bajo}        icon="warning"      tone="warn" />
        <StatCard label="Sin stock"   value={stats.sin}         icon="error"        tone="error" />
      </div>

      {/* Toolbar */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-variant p-4 mb-5 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nombre o SKU…"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white outline-none text-sm"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-surface-container-high">
                <MIcon name="close" className="text-lg text-on-surface-variant" />
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="todas">Todas las categorías</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
              <option value="todos">Todos los proveedores</option>
              {SUPPLIERS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select value={stockFilter} onChange={e => setStockFilter(e.target.value)}>
              <option value="todos">Cualquier stock</option>
              <option value="disponibles">Con stock</option>
              <option value="bajos">Stock bajo (&lt;5)</option>
              <option value="sin">Sin stock</option>
            </Select>
            <div className="flex bg-surface-container-low rounded-xl p-1 border border-outline-variant">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant'}`} title="Cuadrícula">
                <MIcon name="grid_view" className="text-lg" fill={viewMode === 'grid'} />
              </button>
              <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition ${viewMode === 'table' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant'}`} title="Tabla">
                <MIcon name="view_list" className="text-lg" fill={viewMode === 'table'} />
              </button>
            </div>
          </div>
        </div>
        {hasFilters && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-variant flex-wrap">
            <span className="text-xs text-on-surface-variant font-medium">{filtered.length} de {products.length} productos</span>
            <button onClick={clearFilters} className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
              <MIcon name="close" className="text-sm" /> Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant">
          <MIcon name="search_off" className="text-6xl text-on-surface-variant/50" />
          <h3 className="mt-2 font-epilogue text-xl font-bold">Sin resultados</h3>
          <p className="text-sm text-on-surface-variant mt-1">Ajusta los filtros o crea un producto nuevo.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} onEdit={() => setEditing(p)} onHistory={() => setHistory(p)} />
          ))}
        </div>
      ) : (
        <ProductTable products={filtered} onEdit={setEditing} onHistory={setHistory} />
      )}

      {/* Modals */}
      {editing && (
        <ProductEditModal
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onDelete={editing !== 'new' ? handleDelete : undefined}
        />
      )}
      {history && <ProductHistoryModal product={history} onClose={() => setHistory(null)} />}
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImported={n => { toast('success', `${n} productos importados de WooCommerce`); setImportOpen(false); }}
        />
      )}
    </div>
  );
};

export default ProductsView;
