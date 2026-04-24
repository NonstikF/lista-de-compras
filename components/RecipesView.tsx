import React, { useState, useRef } from 'react';
import type { Recipe, RecipeIngredient } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Modal, Button, Field, Input, Select, Textarea, Chip, MIcon, useToast } from './ui';

const CATEGORY_META = {
  caliente: { label: 'Caliente', icon: 'local_fire_department', color: 'bg-secondary-container/60 text-on-secondary-container' },
  fria:     { label: 'Fría',     icon: 'ac_unit',               color: 'bg-primary-fixed/60 text-on-primary-fixed' },
  especial: { label: 'Especial', icon: 'auto_awesome',          color: 'bg-tertiary-container/50 text-tertiary' },
} as const;

const UNITS = ['g', 'kg', 'ml', 'L', 'pza', 'cdta', 'cda', 'taza', 'al gusto'];

// ---------- Imagen o placeholder ----------
const RecipeImage: React.FC<{ recipe: Recipe; className?: string }> = ({ recipe, className = '' }) => {
  const meta = CATEGORY_META[recipe.category];
  if (recipe.image) {
    return <img src={recipe.image} alt={recipe.name} className={`w-full h-full object-cover ${className}`} />;
  }
  return (
    <div className={`w-full h-full flex items-center justify-center ${meta.color} ${className}`}>
      <MIcon name={meta.icon} size={48} fill />
    </div>
  );
};

// ---------- Tarjeta de receta ----------
const RecipeCard: React.FC<{
  recipe: Recipe;
  onView: (r: Recipe) => void;
  onEdit: (r: Recipe) => void;
  onDelete: (r: Recipe) => void;
}> = ({ recipe, onView, onEdit, onDelete }) => {
  const meta = CATEGORY_META[recipe.category];
  return (
    <div className="bg-white rounded-2xl border border-surface-variant shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className="h-40 overflow-hidden">
        <RecipeImage recipe={recipe} />
      </div>
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
            <MIcon name={meta.icon} className="text-sm" fill />
            {meta.label}
          </span>
          <span className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
            {recipe.ingredients.length} ingrediente{recipe.ingredients.length !== 1 ? 's' : ''}
          </span>
          {recipe.servings > 1 && (
            <span className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
              {recipe.servings} porciones
            </span>
          )}
        </div>
        <h3 className="font-epilogue font-bold text-on-background leading-tight">{recipe.name}</h3>
        {recipe.description && (
          <p className="text-sm text-on-surface-variant line-clamp-2">{recipe.description}</p>
        )}
      </div>
      <div className="flex gap-1 px-3 pb-3 border-t border-surface-variant pt-2">
        <Button variant="outline" size="sm" icon="visibility" className="flex-1" onClick={() => onView(recipe)}>
          Ver
        </Button>
        <Button variant="tonal" size="sm" icon="edit" onClick={() => onEdit(recipe)}>
          Editar
        </Button>
        <Button variant="text" size="sm" icon="delete" className="text-error hover:bg-error/8" onClick={() => onDelete(recipe)} />
      </div>
    </div>
  );
};

// ---------- Modal detalle ----------
const RecipeDetailModal: React.FC<{ recipe: Recipe; onClose: () => void; onEdit: (r: Recipe) => void }> = ({ recipe, onClose, onEdit }) => {
  const meta = CATEGORY_META[recipe.category];
  return (
    <Modal
      open
      onClose={onClose}
      title={recipe.name}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>Cerrar</Button>
          <Button variant="tonal" icon="edit" onClick={() => { onClose(); onEdit(recipe); }}>Editar</Button>
        </>
      }
    >
      <div className="p-6 space-y-5">
        {recipe.image && (
          <img src={recipe.image} alt={recipe.name} className="w-full h-52 object-cover rounded-xl" />
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full ${meta.color}`}>
            <MIcon name={meta.icon} className="text-base" fill />
            {meta.label}
          </span>
          {recipe.servings > 0 && (
            <span className="text-sm text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
              {recipe.servings} porción{recipe.servings !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
        {recipe.description && (
          <p className="text-on-surface-variant">{recipe.description}</p>
        )}
        {recipe.ingredients.length > 0 && (
          <div>
            <h4 className="font-epilogue font-semibold text-on-background mb-2">Ingredientes</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-on-surface-variant text-xs uppercase tracking-wider border-b border-surface-variant">
                  <th className="pb-2 font-semibold">Ingrediente</th>
                  <th className="pb-2 font-semibold w-20">Cantidad</th>
                  <th className="pb-2 font-semibold w-20">Unidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant">
                {recipe.ingredients.map((ing, i) => (
                  <tr key={i}>
                    <td className="py-1.5 text-on-background">{ing.name}</td>
                    <td className="py-1.5 text-on-surface-variant">{ing.quantity}</td>
                    <td className="py-1.5 text-on-surface-variant">{ing.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {recipe.instructions && (
          <div>
            <h4 className="font-epilogue font-semibold text-on-background mb-2">Preparación</h4>
            <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed bg-surface-container-low rounded-xl p-4">
              {recipe.instructions}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ---------- Fila de ingrediente ----------
const IngredientRow: React.FC<{
  ing: RecipeIngredient;
  index: number;
  onChange: (i: number, f: keyof RecipeIngredient, v: string) => void;
  onRemove: (i: number) => void;
}> = ({ ing, index, onChange, onRemove }) => (
  <div className="flex gap-2 items-start">
    <Input
      placeholder="Ingrediente"
      value={ing.name}
      onChange={e => onChange(index, 'name', e.target.value)}
      className="flex-1"
    />
    <Input
      placeholder="Cant."
      value={ing.quantity}
      onChange={e => onChange(index, 'quantity', e.target.value)}
      className="w-20"
    />
    <Select
      value={ing.unit}
      onChange={e => onChange(index, 'unit', e.target.value)}
      className="w-28"
    >
      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
    </Select>
    <button
      type="button"
      onClick={() => onRemove(index)}
      className="p-2 text-error hover:bg-error/8 rounded-full transition mt-0.5"
    >
      <MIcon name="remove_circle" className="text-xl" />
    </button>
  </div>
);

// ---------- Modal edición ----------
type RecipeForm = Omit<Recipe, 'id'>;

const RecipeEditModal: React.FC<{
  recipe: Recipe | 'new' | null;
  onClose: () => void;
  onSave: (r: Recipe) => void;
}> = ({ recipe, onClose, onSave }) => {
  const isNew = recipe === 'new';
  const blank: RecipeForm = {
    name: '', description: '', category: 'caliente', image: null,
    ingredients: [], instructions: '', servings: 1,
  };
  const initial: RecipeForm = isNew ? blank : { ...(recipe as Recipe) };

  const [form, setForm] = useState<RecipeForm>(initial);
  const [nameError, setNameError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof RecipeForm>(key: K, val: RecipeForm[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 500_000) return;
    const reader = new FileReader();
    reader.onload = ev => update('image', ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const addIngredient = () =>
    update('ingredients', [...form.ingredients, { name: '', quantity: '', unit: 'g' }]);
  const updateIngredient = (i: number, field: keyof RecipeIngredient, value: string) =>
    update('ingredients', form.ingredients.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing));
  const removeIngredient = (i: number) =>
    update('ingredients', form.ingredients.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setNameError('El nombre es requerido'); return; }
    const saved: Recipe = {
      id: isNew ? crypto.randomUUID() : (recipe as Recipe).id,
      ...form,
      name: form.name.trim(),
      servings: Math.max(1, Number(form.servings) || 1),
    };
    onSave(saved);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Nueva receta' : 'Editar receta'}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>Cancelar</Button>
          <Button variant="filled" icon="save" onClick={handleSubmit}>Guardar</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Imagen */}
        <div
          className="w-full h-36 rounded-2xl border-2 border-dashed border-outline-variant hover:border-primary cursor-pointer overflow-hidden flex items-center justify-center bg-surface-container-low transition"
          onClick={() => fileRef.current?.click()}
        >
          {form.image
            ? <img src={form.image} alt="preview" className="w-full h-full object-cover" />
            : (
              <div className="flex flex-col items-center gap-1 text-on-surface-variant">
                <MIcon name="add_photo_alternate" size={36} />
                <span className="text-xs">Imagen opcional (máx. 500 KB)</span>
              </div>
            )
          }
        </div>
        {form.image && (
          <button type="button" className="text-xs text-error hover:underline" onClick={() => update('image', null)}>
            Quitar imagen
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre" required error={nameError}>
            <Input
              value={form.name}
              onChange={e => { update('name', e.target.value); setNameError(''); }}
              placeholder="Ej. Chai Latte"
            />
          </Field>
          <Field label="Porciones">
            <Input
              type="number"
              min="1"
              value={form.servings}
              onChange={e => update('servings', Number(e.target.value))}
            />
          </Field>
        </div>

        {/* Categoría */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block mb-2">Categoría</span>
          <div className="flex gap-2">
            {(Object.keys(CATEGORY_META) as Recipe['category'][]).map(cat => {
              const m = CATEGORY_META[cat];
              const active = form.category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => update('category', cat)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition ${
                    active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <MIcon name={m.icon} className="text-base" fill={active} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Descripción">
          <Textarea
            value={form.description}
            onChange={e => update('description', e.target.value)}
            placeholder="Describe brevemente la receta…"
            style={{ minHeight: '72px' }}
          />
        </Field>

        {/* Ingredientes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Ingredientes</span>
            <Button variant="tonal" size="sm" icon="add" onClick={addIngredient} type="button">
              Agregar
            </Button>
          </div>
          {form.ingredients.length === 0 && (
            <p className="text-sm text-on-surface-variant text-center py-3 bg-surface-container-low rounded-xl">
              Sin ingredientes — haz clic en "Agregar"
            </p>
          )}
          <div className="space-y-2">
            {form.ingredients.map((ing, i) => (
              <IngredientRow key={i} ing={ing} index={i} onChange={updateIngredient} onRemove={removeIngredient} />
            ))}
          </div>
        </div>

        <Field label="Instrucciones / Preparación">
          <Textarea
            value={form.instructions}
            onChange={e => update('instructions', e.target.value)}
            placeholder="Escribe los pasos de preparación…"
            style={{ minHeight: '120px' }}
          />
        </Field>
      </form>
    </Modal>
  );
};

// ---------- Vista principal ----------
type CategoryFilter = 'todas' | Recipe['category'];

const RecipesView: React.FC = () => {
  const [recipes, setRecipes] = useLocalStorage<Recipe[]>('plantarte_recipes', []);
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null);
  const [viewing, setViewing] = useState<Recipe | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Recipe | null>(null);
  const [catFilter, setCatFilter] = useState<CategoryFilter>('todas');
  const toast = useToast();

  const filtered = catFilter === 'todas' ? recipes : recipes.filter(r => r.category === catFilter);

  const handleSave = (recipe: Recipe) => {
    const isNew = !recipes.some(r => r.id === recipe.id);
    setRecipes(prev =>
      isNew ? [...prev, recipe] : prev.map(r => r.id === recipe.id ? recipe : r)
    );
    toast('success', `${recipe.name} ${isNew ? 'creada' : 'actualizada'}`);
    setEditing(null);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    setRecipes(prev => prev.filter(r => r.id !== confirmDelete.id));
    toast('success', `${confirmDelete.name} eliminada`);
    setConfirmDelete(null);
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 pb-28 md:pb-10">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-epilogue text-3xl font-bold text-on-background">Recetas</h1>
          <p className="text-on-surface-variant mt-0.5">
            {recipes.length === 0 ? 'Sin recetas' : `${recipes.length} receta${recipes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button variant="filled" icon="add" onClick={() => setEditing('new')}>
          Nueva receta
        </Button>
      </div>

      {/* Filtros */}
      {recipes.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          <Chip active={catFilter === 'todas'} onClick={() => setCatFilter('todas')} icon="apps">Todas</Chip>
          <Chip active={catFilter === 'caliente'} onClick={() => setCatFilter('caliente')} icon="local_fire_department">Caliente</Chip>
          <Chip active={catFilter === 'fria'} onClick={() => setCatFilter('fria')} icon="ac_unit">Fría</Chip>
          <Chip active={catFilter === 'especial'} onClick={() => setCatFilter('especial')} icon="auto_awesome">Especial</Chip>
        </div>
      )}

      {/* Estado vacío */}
      {recipes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-secondary-container/40 flex items-center justify-center mb-4">
            <MIcon name="menu_book" size={40} className="text-secondary" fill />
          </div>
          <h2 className="font-epilogue text-xl font-bold text-on-background">No hay recetas aún</h2>
          <p className="text-on-surface-variant mt-1 mb-6 max-w-sm">
            Crea recetas de bebidas para tenerlas siempre a la mano.
          </p>
          <Button variant="filled" icon="add" onClick={() => setEditing('new')}>
            Crear receta
          </Button>
        </div>
      )}

      {/* Grilla */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(r => (
            <RecipeCard
              key={r.id}
              recipe={r}
              onView={setViewing}
              onEdit={setEditing}
              onDelete={setConfirmDelete}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && recipes.length > 0 && (
        <div className="text-center py-16 text-on-surface-variant">
          Sin recetas en esta categoría.
        </div>
      )}

      {editing !== null && (
        <RecipeEditModal recipe={editing} onClose={() => setEditing(null)} onSave={handleSave} />
      )}
      {viewing && (
        <RecipeDetailModal recipe={viewing} onClose={() => setViewing(null)} onEdit={setEditing} />
      )}
      {confirmDelete && (
        <Modal
          open
          onClose={() => setConfirmDelete(null)}
          title="Eliminar receta"
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

export default RecipesView;
