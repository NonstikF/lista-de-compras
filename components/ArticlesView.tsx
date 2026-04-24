import React, { useState, useRef } from 'react';
import type { Article } from '../types';
import { SUPPLIERS } from '../data/catalog';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Modal, Button, Field, Input, MIcon, fmt, useToast } from './ui';

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
  onEdit: (a: Article) => void;
  onDelete: (a: Article) => void;
}> = ({ article, onEdit, onDelete }) => {
  const suppliers = SUPPLIERS.filter(s => article.supplierIds.includes(s.id));
  const visibleSuppliers = suppliers.slice(0, 2);
  const extra = suppliers.length - 2;

  return (
    <div className="bg-white rounded-2xl border border-surface-variant shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className="rounded-t-2xl overflow-hidden">
        <ArticleImage article={article} />
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1">
        <p className="font-epilogue font-semibold text-on-background text-sm leading-tight line-clamp-2">{article.name}</p>
        <p className="text-primary font-bold text-base">{fmt(article.price)}</p>
        {suppliers.length > 0 && (
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
  onClose: () => void;
  onSave: (a: Article) => void;
}> = ({ article, onClose, onSave }) => {
  const isNew = article === 'new';
  const initial: ArticleForm = isNew
    ? { name: '', price: '', image: null, supplierIds: [] }
    : { name: (article as Article).name, price: String((article as Article).price), image: (article as Article).image, supplierIds: (article as Article).supplierIds };

  const [form, setForm] = useState<ArticleForm>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof ArticleForm, string>>>({});
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
    update('supplierIds', form.supplierIds.includes(id)
      ? form.supplierIds.filter(s => s !== id)
      : [...form.supplierIds, id]
    );

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'El nombre es requerido';
    const p = parseFloat(form.price);
    if (isNaN(p) || p < 0) e.price = 'Precio inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const saved: Article = {
      id: isNew ? crypto.randomUUID() : (article as Article).id,
      name: form.name.trim(),
      price: parseFloat(form.price),
      image: form.image,
      supplierIds: form.supplierIds,
    };
    onSave(saved);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Nuevo artículo' : 'Editar artículo'}
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>Cancelar</Button>
          <Button variant="filled" onClick={handleSubmit} icon="save">Guardar</Button>
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
            <div className="flex flex-wrap gap-2">
              {SUPPLIERS.map(s => {
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
          </div>
        </div>
      </form>
    </Modal>
  );
};

// ---------- Vista principal ----------
const ArticlesView: React.FC = () => {
  const [articles, setArticles] = useLocalStorage<Article[]>('plantarte_articles', []);
  const [editing, setEditing] = useState<Article | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Article | null>(null);
  const toast = useToast();

  const handleSave = (article: Article) => {
    const isNew = !articles.some(a => a.id === article.id);
    setArticles(prev =>
      isNew ? [...prev, article] : prev.map(a => a.id === article.id ? article : a)
    );
    toast('success', `${article.name} ${isNew ? 'agregado' : 'actualizado'}`);
    setEditing(null);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    setArticles(prev => prev.filter(a => a.id !== confirmDelete.id));
    toast('success', `${confirmDelete.name} eliminado`);
    setConfirmDelete(null);
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 pb-28 md:pb-10">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-epilogue text-3xl font-bold text-on-background">Artículos</h1>
          <p className="text-on-surface-variant mt-0.5">
            {articles.length === 0 ? 'Sin artículos' : `${articles.length} artículo${articles.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button variant="filled" icon="add" onClick={() => setEditing('new')}>
          Nuevo artículo
        </Button>
      </div>

      {/* Estado vacío */}
      {articles.length === 0 && (
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

      {/* Grilla */}
      {articles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {articles.map(a => (
            <ArticleCard
              key={a.id}
              article={a}
              onEdit={setEditing}
              onDelete={setConfirmDelete}
            />
          ))}
        </div>
      )}

      {/* Modal edición */}
      {editing !== null && (
        <ArticleEditModal
          article={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {/* Modal confirmar eliminación */}
      {confirmDelete && (
        <Modal
          open
          onClose={() => setConfirmDelete(null)}
          title="Eliminar artículo"
          maxWidth="max-w-sm"
          footer={
            <>
              <Button variant="neutral" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
              <Button variant="danger" icon="delete" onClick={handleDelete}>Eliminar</Button>
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
