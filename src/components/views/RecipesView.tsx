import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Recipe, RecipeIngredient, RecipeSizeVariant, DrinkTemp, DrinkSize, RecipeType, RecipeStatus, RecipePhoto } from '../../types';
import { AuthError, getRecipes, createRecipe, updateRecipe, deleteRecipe, uploadRecipePhoto, deleteRecipePhoto } from '../../services/api';
import { Modal, Button, Field, Input, Select, Textarea, MIcon, useToast } from '../ui';

interface RecipesViewProps {
    authToken: string;
    onAuthError: () => void;
}

const CATEGORY_META = {
    caliente: { label: 'Caliente', icon: 'local_fire_department', color: 'bg-secondary-container/60 text-on-secondary-container' },
    fria:     { label: 'Fría',     icon: 'ac_unit',               color: 'bg-primary-fixed/60 text-on-primary-fixed' },
    especial: { label: 'Especial', icon: 'auto_awesome',          color: 'bg-tertiary-container/50 text-tertiary' },
} as const;

type RecipeCategory = keyof typeof CATEGORY_META;

const STATUS_META: Record<RecipeStatus, { label: string; icon: string; color: string }> = {
    completa:   { label: 'Con receta', icon: 'check_circle', color: 'bg-primary-fixed/60 text-on-primary-fixed' },
    incompleta: { label: 'Incompleta', icon: 'pending',      color: 'bg-amber-100 text-amber-800' },
    sin_receta: { label: 'Sin receta', icon: 'error',        color: 'bg-error-container/70 text-error' },
};

const RECIPE_STATUSES = Object.keys(STATUS_META) as RecipeStatus[];

const DRINK_SIZES: DrinkSize[] = ['10oz', '12oz', '16oz'];
const DRINK_TEMPS: DrinkTemp[] = ['fria', 'caliente'];

const UNITS = ['g', 'kg', 'ml', 'L', 'pza', 'cdta', 'cda', 'taza', 'al gusto'];

const normalizeCategory = (category: unknown): RecipeCategory => {
    if (category === 'caliente' || category === 'fria' || category === 'especial') return category;
    return 'especial';
};

const normalizeRecipeType = (t: unknown): RecipeType => {
    if (t === 'alimento' || t === 'bebida' || t === 'otros') return t;
    return 'alimento';
};

const normalizeDrinkTemps = (raw: unknown): DrinkTemp[] => {
    if (!Array.isArray(raw)) return [];
    return raw.filter((t): t is DrinkTemp => t === 'fria' || t === 'caliente');
};

const normalizeStatus = (s: unknown): RecipeStatus =>
    RECIPE_STATUSES.includes(s as RecipeStatus) ? s as RecipeStatus : 'completa';

const getCategoryMeta = (category: unknown) => CATEGORY_META[normalizeCategory(category)];

const StatusBadge: React.FC<{ status: RecipeStatus; large?: boolean }> = ({ status, large }) => {
    if (status === 'completa') return null;
    const meta = STATUS_META[status];
    return (
        <span className={`inline-flex items-center gap-1 font-bold rounded-full ${large ? 'text-sm px-3 py-1' : 'text-[11px] px-2 py-0.5'} ${meta.color}`}>
            <MIcon name={meta.icon} className={large ? 'text-base' : 'text-sm'} fill />
            {meta.label}
        </span>
    );
};

const searchKey = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const normalizeRecipe = (recipe: Recipe): Recipe => ({
    ...recipe,
    recipeType: normalizeRecipeType(recipe.recipeType),
    category: normalizeCategory(recipe.category),
    drinkTemps: normalizeDrinkTemps(recipe.drinkTemps),
    image: recipe.image ?? null,
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    sizeVariants: Array.isArray(recipe.sizeVariants) ? recipe.sizeVariants : [],
    instructions: recipe.instructions ?? '',
    description: recipe.description ?? '',
    servings: Math.max(1, Number(recipe.servings) || 1),
    status: normalizeStatus(recipe.status),
    menuCategory: recipe.menuCategory ?? '',
    notes: recipe.notes ?? '',
    photos: Array.isArray(recipe.photos) ? recipe.photos : [],
});

// Phone photos of a recipe sheet are several MB; shrink them before upload so
// they stay legible but fit the API body limit.
const resizeImageFile = (file: File, maxSide = 1600, quality = 0.75): Promise<string> =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
        img.src = url;
    });

// ---------- Visor de foto a pantalla completa ----------
const PhotoViewer: React.FC<{ photos: RecipePhoto[]; index: number; title: string; onClose: () => void }> = ({ photos, index, title, onClose }) => {
    const [i, setI] = useState(index);
    useEffect(() => {
        // Capture phase + stopPropagation so Escape closes only the viewer, not
        // the recipe modal underneath (it listens on window in the bubble phase).
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
            if (e.key === 'ArrowRight') setI(n => Math.min(photos.length - 1, n + 1));
            if (e.key === 'ArrowLeft') setI(n => Math.max(0, n - 1));
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [photos.length, onClose]);
    const nav = 'absolute top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-30';
    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col" onClick={onClose}>
            <div className="flex items-center justify-between px-4 py-3 text-white" onClick={e => e.stopPropagation()}>
                <span className="text-sm font-semibold truncate">{title} · Hoja {i + 1} de {photos.length}</span>
                <div className="flex items-center gap-1">
                    <a href={photos[i].url} target="_blank" rel="noreferrer" className="p-2 rounded-full hover:bg-white/15" aria-label="Abrir en otra pestaña">
                        <MIcon name="open_in_new" size={20} />
                    </a>
                    <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-white/15" aria-label="Cerrar">
                        <MIcon name="close" size={22} />
                    </button>
                </div>
            </div>
            <div className="relative flex-1 min-h-0 flex items-center justify-center px-2 pb-4">
                <img src={photos[i].url} alt={`${title}, hoja ${i + 1}`} className="max-w-full max-h-[calc(100dvh-5rem)] object-contain" onClick={e => e.stopPropagation()} />
                {photos.length > 1 && (
                    <>
                        <button type="button" className={`${nav} left-2`} disabled={i === 0} aria-label="Anterior"
                            onClick={e => { e.stopPropagation(); setI(i - 1); }}>
                            <MIcon name="chevron_left" size={28} />
                        </button>
                        <button type="button" className={`${nav} right-2`} disabled={i === photos.length - 1} aria-label="Siguiente"
                            onClick={e => { e.stopPropagation(); setI(i + 1); }}>
                            <MIcon name="chevron_right" size={28} />
                        </button>
                    </>
                )}
            </div>
        </div>,
        document.body,
    );
};

const PhotoThumbs: React.FC<{ photos: RecipePhoto[]; onOpen: (index: number) => void; onRemove?: (photo: RecipePhoto) => void }> = ({ photos, onOpen, onRemove }) => (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map((p, idx) => (
            <div key={p.id} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-surface-variant bg-surface-container-low">
                <button type="button" className="w-full h-full" onClick={() => onOpen(idx)} aria-label={`Ver hoja ${idx + 1}`}>
                    <img src={p.url} alt={`Hoja ${idx + 1}`} loading="lazy" className="w-full h-full object-contain" />
                </button>
                {onRemove && (
                    <button type="button" onClick={() => onRemove(p)} aria-label={`Quitar hoja ${idx + 1}`}
                        className="absolute top-1 right-1 p-1 rounded-full bg-white/90 text-error shadow hover:bg-white">
                        <MIcon name="close" size={16} />
                    </button>
                )}
            </div>
        ))}
    </div>
);

// ---------- Imagen o placeholder ----------
const RecipeImage: React.FC<{ recipe: Recipe; className?: string }> = ({ recipe, className = '' }) => {
    const meta = getCategoryMeta(recipe.category);
    if (recipe.image) {
        return <img src={recipe.image} alt={recipe.name} loading="lazy" className={`w-full h-full object-contain bg-surface-container-low ${className}`} />;
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
    const isBebida = recipe.recipeType === 'bebida';
    const isOtros = recipe.recipeType === 'otros';

    const typeLabel = isBebida
        ? `Bebida${recipe.drinkTemps.length > 0 ? ' · ' + recipe.drinkTemps.map(t => t === 'fria' ? 'Fría' : 'Caliente').join(' & ') : ''}`
        : isOtros ? 'Otros'
        : 'Alimento';

    const typeIcon = isBebida ? 'local_cafe' : isOtros ? 'category' : 'restaurant';
    const typeColor = isBebida
        ? getCategoryMeta(recipe.category).color
        : isOtros
        ? 'bg-surface-variant text-on-surface-variant'
        : 'bg-tertiary-container/50 text-tertiary';

    const sizesLabel = isBebida && recipe.sizeVariants.length > 0
        ? recipe.sizeVariants.map(sv => sv.size).join(', ')
        : null;

    return (
        <div className="bg-white rounded-2xl border border-surface-variant shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            <button type="button" className="aspect-square overflow-hidden" onClick={() => onView(recipe)} aria-label={`Ver ${recipe.name}`}>
                <RecipeImage recipe={recipe} />
            </button>
            <div className="p-2.5 sm:p-4 flex-1 flex flex-col gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                    <StatusBadge status={recipe.status} />
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${typeColor}`}>
                        <MIcon name={typeIcon} className="text-sm" fill />
                        {typeLabel}
                    </span>
                    {sizesLabel && (
                        <span className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                            {sizesLabel}
                        </span>
                    )}
                    {!isBebida && recipe.ingredients.length > 0 && (
                        <span className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                            {recipe.ingredients.length} ingrediente{recipe.ingredients.length !== 1 ? 's' : ''}
                        </span>
                    )}
                    {recipe.photos.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full" title="Fotos de la hoja de receta">
                            <MIcon name="description" className="text-sm" />
                            {recipe.photos.length}
                        </span>
                    )}
                </div>
                <h3 className="font-epilogue font-bold text-sm sm:text-base text-on-background leading-tight">{recipe.name}</h3>
                {recipe.description && (
                    <p className="text-xs sm:text-sm text-on-surface-variant line-clamp-2">{recipe.description}</p>
                )}
                {recipe.status !== 'completa' && recipe.notes && (
                    <p className="text-xs text-amber-800 line-clamp-2">{recipe.notes}</p>
                )}
            </div>
            <div className="flex gap-1 px-2 sm:px-3 pb-2 sm:pb-3 border-t border-surface-variant pt-2">
                <Button variant="outline" size="sm" icon="visibility" className="flex-1 !px-2 sm:!px-3" onClick={() => onView(recipe)} aria-label="Ver">
                    <span className="hidden sm:inline">Ver</span>
                </Button>
                <Button variant="tonal" size="sm" icon="edit" className="flex-1 sm:flex-none !px-2 sm:!px-3" onClick={() => onEdit(recipe)} aria-label="Editar">
                    <span className="hidden sm:inline">Editar</span>
                </Button>
                <Button variant="text" size="sm" icon="delete" className="text-error hover:bg-error/8 !px-2 sm:!px-3" onClick={() => onDelete(recipe)} aria-label="Eliminar" />
            </div>
        </div>
    );
};

// ---------- Modal detalle ----------
const RecipeDetailModal: React.FC<{ recipe: Recipe; onClose: () => void; onEdit: (r: Recipe) => void }> = ({ recipe, onClose, onEdit }) => {
    const isBebida = recipe.recipeType === 'bebida';
    const isOtros = recipe.recipeType === 'otros';

    const typeLabel = isBebida
        ? `Bebida${recipe.drinkTemps.length > 0 ? ' · ' + recipe.drinkTemps.map(t => t === 'fria' ? 'Fría' : 'Caliente').join(' & ') : ''}`
        : isOtros ? 'Otros'
        : 'Alimento';
    const typeIcon = isBebida ? 'local_cafe' : isOtros ? 'category' : 'restaurant';
    const typeColor = isBebida
        ? getCategoryMeta(recipe.category).color
        : isOtros
        ? 'bg-surface-variant text-on-surface-variant'
        : 'bg-tertiary-container/50 text-tertiary';

    const [activeSize, setActiveSize] = useState<DrinkSize | null>(
        recipe.sizeVariants.length > 0 ? recipe.sizeVariants[0].size as DrinkSize : null
    );
    const activeVariant = recipe.sizeVariants.find(sv => sv.size === activeSize);
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);

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
                    <img src={recipe.image} alt={recipe.name} className="w-full max-h-96 object-contain rounded-xl bg-surface-container-low" />
                )}
                <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={recipe.status} large />
                    <span className={`inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full ${typeColor}`}>
                        <MIcon name={typeIcon} className="text-base" fill />
                        {typeLabel}
                    </span>
                    {!isBebida && recipe.servings > 0 && (
                        <span className="text-sm text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
                            {recipe.servings} porción{recipe.servings !== 1 ? 'es' : ''}
                        </span>
                    )}
                    {recipe.menuCategory && (
                        <span className="text-sm text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
                            {recipe.menuCategory}
                        </span>
                    )}
                </div>
                {recipe.description && <p className="text-on-surface-variant">{recipe.description}</p>}

                {recipe.status === 'sin_receta' && !recipe.notes && (
                    <p className="text-sm text-error bg-error-container/30 rounded-xl p-4">
                        Este producto todavía no tiene receta. Edítalo para agregarla.
                    </p>
                )}
                {recipe.notes && (
                    <div className="bg-amber-50 rounded-xl p-4">
                        <h4 className="font-epilogue font-semibold text-amber-900 mb-1 flex items-center gap-1.5">
                            <MIcon name="sticky_note_2" className="text-base" />
                            Pendientes y notas
                        </h4>
                        <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{recipe.notes}</p>
                    </div>
                )}

                {/* Bebida: size tabs */}
                {isBebida && recipe.sizeVariants.length > 0 && (
                    <div>
                        <h4 className="font-epilogue font-semibold text-on-background mb-3">Ingredientes por tamaño</h4>
                        <div className="flex gap-2 mb-4">
                            {recipe.sizeVariants.map(sv => (
                                <button
                                    key={sv.size}
                                    type="button"
                                    onClick={() => setActiveSize(sv.size as DrinkSize)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
                                        activeSize === sv.size
                                            ? 'bg-primary text-on-primary border-primary'
                                            : 'bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container'
                                    }`}
                                >
                                    {sv.size}
                                </button>
                            ))}
                        </div>
                        {activeVariant && activeVariant.ingredients.length > 0 && (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-on-surface-variant text-xs uppercase tracking-wider border-b border-surface-variant">
                                        <th className="pb-2 font-semibold">Ingrediente</th>
                                        <th className="pb-2 font-semibold w-20">Cantidad</th>
                                        <th className="pb-2 font-semibold w-20">Unidad</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-variant">
                                    {activeVariant.ingredients.map((ing, i) => (
                                        <tr key={i}>
                                            <td className="py-1.5 text-on-background">{ing.name}</td>
                                            <td className="py-1.5 text-on-surface-variant">{ing.quantity}</td>
                                            <td className="py-1.5 text-on-surface-variant">{ing.unit}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {activeVariant && activeVariant.ingredients.length === 0 && (
                            <p className="text-sm text-on-surface-variant">Sin ingredientes para {activeSize}.</p>
                        )}
                    </div>
                )}

                {/* Alimento / Otros: regular ingredients */}
                {!isBebida && recipe.ingredients.length > 0 && (
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

                {recipe.photos.length > 0 && (
                    <div>
                        <h4 className="font-epilogue font-semibold text-on-background mb-2">
                            Hoja de receta <span className="text-sm font-normal text-on-surface-variant">({recipe.photos.length})</span>
                        </h4>
                        <PhotoThumbs photos={recipe.photos} onOpen={setViewerIndex} />
                    </div>
                )}
            </div>
            {viewerIndex !== null && (
                <PhotoViewer photos={recipe.photos} index={viewerIndex} title={recipe.name} onClose={() => setViewerIndex(null)} />
            )}
        </Modal>
    );
};

// ---------- Fila de ingrediente con unidad editable ----------
const IngredientRow: React.FC<{
    ing: RecipeIngredient;
    index: number;
    onChange: (i: number, f: keyof RecipeIngredient, v: string) => void;
    onRemove: (i: number) => void;
}> = ({ ing, index, onChange, onRemove }) => {
    const isCustom = !UNITS.includes(ing.unit);
    const [showCustom, setShowCustom] = useState(isCustom);

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === '__custom__') {
            setShowCustom(true);
            onChange(index, 'unit', '');
        } else {
            setShowCustom(false);
            onChange(index, 'unit', val);
        }
    };

    return (
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
            {showCustom ? (
                <div className="flex gap-1 items-start">
                    <Input
                        placeholder="Unidad"
                        value={ing.unit}
                        onChange={e => onChange(index, 'unit', e.target.value)}
                        className="w-24"
                        autoFocus
                    />
                    <button
                        type="button"
                        title="Volver a lista"
                        onClick={() => { setShowCustom(false); onChange(index, 'unit', 'g'); }}
                        className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full mt-0.5"
                    >
                        <MIcon name="list" className="text-lg" />
                    </button>
                </div>
            ) : (
                <Select
                    value={UNITS.includes(ing.unit) ? ing.unit : '__custom__'}
                    onChange={handleSelectChange}
                    className="w-32"
                >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    <option value="__custom__">+ Otra…</option>
                </Select>
            )}
            <button
                type="button"
                onClick={() => onRemove(index)}
                className="p-2 text-error hover:bg-error/8 rounded-full transition mt-0.5"
            >
                <MIcon name="remove_circle" className="text-xl" />
            </button>
        </div>
    );
};

// ---------- Modal selector de tipo de receta ----------
interface RecipeTypeSelection {
    recipeType: RecipeType;
    drinkTemps: DrinkTemp[];
    sizesByTemp: Partial<Record<DrinkTemp, DrinkSize[]>>;
}

const SizeSelector: React.FC<{
    temp: DrinkTemp;
    sizes: DrinkSize[];
    onChange: (sizes: DrinkSize[]) => void;
}> = ({ temp, sizes, onChange }) => {
    const tempLabel = temp === 'fria' ? 'Fría' : 'Caliente';
    const tempIcon = temp === 'fria' ? 'ac_unit' : 'local_fire_department';
    const toggle = (size: DrinkSize) =>
        onChange(sizes.includes(size) ? sizes.filter(s => s !== size) : [...sizes, size]);
    return (
        <div>
            <div className="flex items-center gap-1.5 mb-2">
                <MIcon name={tempIcon} className="text-sm text-on-surface-variant" />
                <span className="text-xs font-semibold text-on-surface-variant">{tempLabel}</span>
            </div>
            <div className="flex gap-2">
                {DRINK_SIZES.map(size => {
                    const active = sizes.includes(size);
                    return (
                        <button
                            key={size}
                            type="button"
                            onClick={() => toggle(size)}
                            className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition relative ${
                                active
                                    ? 'border-primary bg-primary/8 text-primary'
                                    : 'border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container'
                            }`}
                        >
                            {active && (
                                <span className="absolute top-0.5 right-0.5">
                                    <MIcon name="check_circle" className="text-primary text-xs" fill />
                                </span>
                            )}
                            {size}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const RecipeTypeModal: React.FC<{
    onConfirm: (sel: RecipeTypeSelection) => void;
    onClose: () => void;
}> = ({ onConfirm, onClose }) => {
    const [recipeType, setRecipeType] = useState<RecipeType | null>(null);
    const [drinkTemps, setDrinkTemps] = useState<DrinkTemp[]>([]);
    const [sizesByTemp, setSizesByTemp] = useState<Partial<Record<DrinkTemp, DrinkSize[]>>>({});

    const toggleTemp = (temp: DrinkTemp) => {
        setDrinkTemps(prev => {
            const removing = prev.includes(temp);
            if (removing) setSizesByTemp(s => { const n = { ...s }; delete n[temp]; return n; });
            return removing ? prev.filter(t => t !== temp) : [...prev, temp];
        });
    };

    const setSizesForTemp = (temp: DrinkTemp, sizes: DrinkSize[]) =>
        setSizesByTemp(prev => ({ ...prev, [temp]: sizes }));

    const allTempsHaveSizes = drinkTemps.length > 0 &&
        drinkTemps.every(t => (sizesByTemp[t] ?? []).length > 0);

    const canConfirm =
        recipeType === 'alimento' ||
        recipeType === 'otros' ||
        (recipeType === 'bebida' && allTempsHaveSizes);

    const handleConfirm = () => {
        if (!recipeType) return;
        onConfirm({ recipeType, drinkTemps, sizesByTemp });
    };

    return (
        <Modal
            open
            onClose={onClose}
            title="Tipo de receta"
            maxWidth="max-w-sm"
            footer={
                <>
                    <Button variant="neutral" onClick={onClose}>Cancelar</Button>
                    <Button variant="filled" icon="arrow_forward" onClick={handleConfirm} disabled={!canConfirm}>
                        Continuar
                    </Button>
                </>
            }
        >
            <div className="p-6 space-y-5">
                {/* Tipo principal */}
                <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block mb-3">
                        ¿Qué tipo de receta?
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                        {([
                            { type: 'alimento' as RecipeType, icon: 'restaurant', label: 'Alimento' },
                            { type: 'bebida'   as RecipeType, icon: 'local_cafe', label: 'Bebida' },
                            { type: 'otros'    as RecipeType, icon: 'category',   label: 'Otros' },
                        ]).map(({ type, icon, label }) => {
                            const active = recipeType === type;
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => {
                                        setRecipeType(type);
                                        if (type !== 'bebida') { setDrinkTemps([]); setSizesByTemp({}); }
                                    }}
                                    className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition ${
                                        active
                                            ? 'border-primary bg-primary/8'
                                            : 'border-outline-variant bg-surface-container-low hover:bg-surface-container'
                                    }`}
                                >
                                    <MIcon name={icon} size={28} className={active ? 'text-primary' : 'text-on-surface-variant'} fill={active} />
                                    <span className={`text-xs font-semibold ${active ? 'text-primary' : 'text-on-surface'}`}>{label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Temperatura — multi-select */}
                {recipeType === 'bebida' && (
                    <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block mb-3">
                            Temperatura <span className="text-on-surface-variant/60 normal-case font-normal">(una o ambas)</span>
                        </span>
                        <div className="grid grid-cols-2 gap-3">
                            {DRINK_TEMPS.map(temp => {
                                const icon = temp === 'fria' ? 'ac_unit' : 'local_fire_department';
                                const label = temp === 'fria' ? 'Fría' : 'Caliente';
                                const active = drinkTemps.includes(temp);
                                return (
                                    <button
                                        key={temp}
                                        type="button"
                                        onClick={() => toggleTemp(temp)}
                                        className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition relative ${
                                            active
                                                ? 'border-primary bg-primary/8'
                                                : 'border-outline-variant bg-surface-container-low hover:bg-surface-container'
                                        }`}
                                    >
                                        {active && (
                                            <span className="absolute top-1.5 right-1.5">
                                                <MIcon name="check_circle" className="text-primary text-sm" fill />
                                            </span>
                                        )}
                                        <MIcon name={icon} size={28} className={active ? 'text-primary' : 'text-on-surface-variant'} fill={active} />
                                        <span className={`text-sm font-semibold ${active ? 'text-primary' : 'text-on-surface'}`}>{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {drinkTemps.length === 0 && (
                            <p className="text-xs text-error mt-2">Selecciona al menos una temperatura</p>
                        )}
                    </div>
                )}

                {/* Tamaños por temperatura */}
                {recipeType === 'bebida' && drinkTemps.length > 0 && (
                    <div className="space-y-4">
                        <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block">
                            Tamaños por temperatura
                        </span>
                        {drinkTemps.map(temp => (
                            <SizeSelector
                                key={temp}
                                temp={temp}
                                sizes={sizesByTemp[temp] ?? []}
                                onChange={sizes => setSizesForTemp(temp, sizes)}
                            />
                        ))}
                        {!allTempsHaveSizes && (
                            <p className="text-xs text-error">Cada temperatura necesita al menos un tamaño</p>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};

// ---------- Modal edición ----------
type RecipeForm = Omit<Recipe, 'id'>;

const RecipeEditModal: React.FC<{
    recipe: Recipe | 'new' | null;
    initialTypeSelection?: RecipeTypeSelection;
    menuCategories: string[];
    authToken: string;
    onPhotosChange: (recipeId: string, photos: RecipePhoto[]) => void;
    onClose: () => void;
    onSave: (data: RecipeForm) => Promise<void>;
}> = ({ recipe, initialTypeSelection, menuCategories, authToken, onPhotosChange, onClose, onSave }) => {
    const isNew = recipe === 'new';
    const toast = useToast();

    const buildBlank = (sel?: RecipeTypeSelection): RecipeForm => {
        const rt = sel?.recipeType ?? 'alimento';
        const dts = sel?.drinkTemps ?? [];
        const hasCold = dts.includes('fria');
        const hasHot = dts.includes('caliente');
        const category: RecipeCategory = hasHot && !hasCold ? 'caliente' : hasCold && !hasHot ? 'fria' : 'especial';
        const sizeVariants: RecipeSizeVariant[] = dts.flatMap(temp =>
            (sel?.sizesByTemp?.[temp] ?? []).map(size => ({ temp, size, ingredients: [] }))
        );
        return {
            name: '', description: '', recipeType: rt, category, drinkTemps: dts,
            image: null, ingredients: [], sizeVariants, instructions: '', servings: 1,
            status: 'completa', menuCategory: '', notes: '', photos: [],
        };
    };

    const initial: RecipeForm = isNew ? buildBlank(initialTypeSelection) : {
        name: (recipe as Recipe).name,
        description: (recipe as Recipe).description,
        recipeType: (recipe as Recipe).recipeType,
        category: normalizeCategory((recipe as Recipe).category),
        drinkTemps: normalizeDrinkTemps((recipe as Recipe).drinkTemps),
        image: (recipe as Recipe).image,
        ingredients: (recipe as Recipe).ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
        sizeVariants: (recipe as Recipe).sizeVariants.map(sv => ({
            id: sv.id,
            temp: sv.temp,
            size: sv.size,
            ingredients: sv.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
        })),
        instructions: (recipe as Recipe).instructions,
        servings: (recipe as Recipe).servings,
        status: normalizeStatus((recipe as Recipe).status),
        menuCategory: (recipe as Recipe).menuCategory ?? '',
        notes: (recipe as Recipe).notes ?? '',
        photos: (recipe as Recipe).photos,
    };

    const [form, setForm] = useState<RecipeForm>(initial);
    const [nameError, setNameError] = useState('');
    const [saving, setSaving] = useState(false);
    type VariantKey = string; // `${temp}:${size}`
    const variantKey = (temp: DrinkTemp, size: DrinkSize): VariantKey => `${temp}:${size}`;
    const firstVariant = initial.sizeVariants[0];
    const [activeVariantKey, setActiveVariantKey] = useState<VariantKey | null>(
        firstVariant ? variantKey(firstVariant.temp, firstVariant.size) : null
    );
    const fileRef = useRef<HTMLInputElement>(null);

    // Sheet photos are saved right away (not on "Guardar"), so they need an
    // existing recipe id.
    const recipeId = isNew ? null : (recipe as Recipe).id;
    const [photos, setPhotos] = useState<RecipePhoto[]>(initial.photos);
    const [uploading, setUploading] = useState(false);
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);

    const changePhotos = (next: RecipePhoto[]) => {
        setPhotos(next);
        if (recipeId) onPhotosChange(recipeId, next);
    };

    const handlePhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = '';
        if (!recipeId || files.length === 0) return;
        setUploading(true);
        let next = photos;
        try {
            for (const file of files) {
                const photo = await uploadRecipePhoto(authToken, recipeId, await resizeImageFile(file));
                next = [...next, photo];
                changePhotos(next);
            }
        } catch (err) {
            toast('error', err instanceof Error ? err.message : 'Error al subir la foto');
        } finally {
            setUploading(false);
        }
    };

    const removePhoto = async (photo: RecipePhoto) => {
        if (!recipeId) return;
        try {
            await deleteRecipePhoto(authToken, recipeId, photo.id);
            changePhotos(photos.filter(p => p.id !== photo.id));
        } catch (err) {
            toast('error', err instanceof Error ? err.message : 'Error al quitar la foto');
        }
    };

    const isBebida = form.recipeType === 'bebida';

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

    const getVariant = (temp: DrinkTemp, size: DrinkSize) =>
        form.sizeVariants.find(sv => sv.temp === temp && sv.size === size);

    const updateVariantIngredients = (temp: DrinkTemp, size: DrinkSize, ingredients: RecipeSizeVariant['ingredients']) => {
        setForm(f => ({
            ...f,
            sizeVariants: f.sizeVariants.map(sv =>
                sv.temp === temp && sv.size === size ? { ...sv, ingredients } : sv
            ),
        }));
    };

    const addVariantIngredient = (temp: DrinkTemp, size: DrinkSize) => {
        const v = getVariant(temp, size);
        if (!v) return;
        updateVariantIngredients(temp, size, [...v.ingredients, { name: '', quantity: '', unit: 'g' }]);
    };

    const updateVariantIngredient = (temp: DrinkTemp, size: DrinkSize, i: number, field: keyof RecipeIngredient, value: string) => {
        const v = getVariant(temp, size);
        if (!v) return;
        updateVariantIngredients(temp, size, v.ingredients.map((ing, idx) =>
            idx === i ? { ...ing, [field]: value } : ing
        ));
    };

    const removeVariantIngredient = (temp: DrinkTemp, size: DrinkSize, i: number) => {
        const v = getVariant(temp, size);
        if (!v) return;
        updateVariantIngredients(temp, size, v.ingredients.filter((_, idx) => idx !== i));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { setNameError('El nombre es requerido'); return; }
        setSaving(true);
        try {
            await onSave({
                ...form,
                name: form.name.trim(),
                servings: Math.max(1, Number(form.servings) || 1),
            });
        } finally {
            setSaving(false);
        }
    };

    const typeLabel = isBebida
        ? `Bebida${form.drinkTemps.length > 0 ? ' · ' + form.drinkTemps.map(t => t === 'fria' ? 'Fría' : 'Caliente').join(' & ') : ''}`
        : form.recipeType === 'otros' ? 'Otros' : 'Alimento';
    const typeIcon = isBebida ? 'local_cafe' : form.recipeType === 'otros' ? 'category' : 'restaurant';
    const typeColor = isBebida
        ? getCategoryMeta(form.category).color
        : form.recipeType === 'otros'
        ? 'bg-surface-variant text-on-surface-variant'
        : 'bg-tertiary-container/50 text-tertiary';

    return (
        <Modal
            open
            onClose={onClose}
            title={isNew ? 'Nueva receta' : 'Editar receta'}
            maxWidth="max-w-2xl"
            footer={
                <>
                    <Button variant="neutral" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button variant="filled" icon="save" onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Guardando…' : 'Guardar'}
                    </Button>
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
                        ? <img src={form.image} alt="preview" className="w-full h-full object-contain" />
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

                {/* Tipo badge read-only */}
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${typeColor}`}>
                        <MIcon name={typeIcon} className="text-sm" fill />
                        {typeLabel}
                        {isBebida && form.sizeVariants.length > 0 && (
                            <span className="ml-1 opacity-80">· {
                                form.drinkTemps.map(t => {
                                    const sizes = form.sizeVariants.filter(sv => sv.temp === t).map(sv => sv.size);
                                    return sizes.length > 0 ? `${t === 'fria' ? 'Fría' : 'Cal'}: ${sizes.join('/')}` : null;
                                }).filter(Boolean).join(' · ')
                            }</span>
                        )}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Nombre" required error={nameError}>
                        <Input
                            value={form.name}
                            onChange={e => { update('name', e.target.value); setNameError(''); }}
                            placeholder="Ej. Chai Latte"
                        />
                    </Field>
                    {!isBebida && (
                        <Field label="Porciones">
                            <Input
                                type="number"
                                min="1"
                                value={form.servings}
                                onChange={e => update('servings', Number(e.target.value))}
                            />
                        </Field>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Estado">
                        <Select
                            value={form.status}
                            onChange={e => update('status', normalizeStatus(e.target.value))}
                        >
                            {RECIPE_STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                        </Select>
                    </Field>
                    <Field label="Categoría del menú">
                        <Input
                            value={form.menuCategory}
                            onChange={e => update('menuCategory', e.target.value)}
                            placeholder="Ej. Bebidas Frías"
                            list="recipe-menu-categories"
                        />
                        <datalist id="recipe-menu-categories">
                            {menuCategories.map(c => <option key={c} value={c} />)}
                        </datalist>
                    </Field>
                </div>

                <Field label="Descripción">
                    <Textarea
                        value={form.description}
                        onChange={e => update('description', e.target.value)}
                        placeholder="Describe brevemente la receta…"
                        style={{ minHeight: '72px' }}
                    />
                </Field>

                {/* Ingredientes bebida: tabs agrupados por temp → size */}
                {isBebida && form.sizeVariants.length > 0 && (() => {
                    const activeVKey = activeVariantKey;
                    const activeParts = activeVKey ? activeVKey.split(':') : [];
                    const activeTemp = activeParts[0] as DrinkTemp | undefined;
                    const activeSize = activeParts[1] as DrinkSize | undefined;
                    const activeV = activeTemp && activeSize ? getVariant(activeTemp, activeSize) : undefined;

                    // Group variants by temp preserving insertion order
                    const tempGroups = form.drinkTemps.map(t => ({
                        temp: t,
                        variants: form.sizeVariants.filter(sv => sv.temp === t),
                    })).filter(g => g.variants.length > 0);

                    return (
                        <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block mb-3">
                                Ingredientes por tamaño
                            </span>
                            {/* Tab strip grouped by temp */}
                            <div className="space-y-2 mb-4">
                                {tempGroups.map(({ temp, variants }) => (
                                    <div key={temp} className="flex items-center gap-2">
                                        <MIcon
                                            name={temp === 'fria' ? 'ac_unit' : 'local_fire_department'}
                                            className="text-sm text-on-surface-variant flex-shrink-0"
                                        />
                                        <div className="flex gap-2">
                                            {variants.map(sv => {
                                                const key = variantKey(sv.temp, sv.size);
                                                const isActive = activeVKey === key;
                                                return (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => setActiveVariantKey(key)}
                                                        className={`px-3 py-1.5 rounded-xl border text-sm font-semibold transition ${
                                                            isActive
                                                                ? 'bg-primary text-on-primary border-primary'
                                                                : 'bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container'
                                                        }`}
                                                    >
                                                        {sv.size}
                                                        <span className="ml-1 text-[10px] opacity-70">({sv.ingredients.length})</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Active variant ingredients */}
                            {activeV && activeTemp && activeSize && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-on-surface-variant">
                                            <strong>{activeSize}</strong> · {activeTemp === 'fria' ? 'Fría' : 'Caliente'}
                                        </span>
                                        <Button variant="tonal" size="sm" icon="add" type="button"
                                            onClick={() => addVariantIngredient(activeTemp, activeSize)}>
                                            Agregar
                                        </Button>
                                    </div>
                                    {activeV.ingredients.length === 0 && (
                                        <p className="text-sm text-on-surface-variant text-center py-3 bg-surface-container-low rounded-xl">
                                            Sin ingredientes — haz clic en "Agregar"
                                        </p>
                                    )}
                                    <div className="space-y-2">
                                        {activeV.ingredients.map((ing, i) => (
                                            <IngredientRow
                                                key={i}
                                                ing={ing}
                                                index={i}
                                                onChange={(idx, field, val) => updateVariantIngredient(activeTemp, activeSize, idx, field, val)}
                                                onRemove={idx => removeVariantIngredient(activeTemp, activeSize, idx)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Ingredientes alimento / otros */}
                {!isBebida && (
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
                )}

                <Field label="Instrucciones / Preparación">
                    <Textarea
                        value={form.instructions}
                        onChange={e => update('instructions', e.target.value)}
                        placeholder="Escribe los pasos de preparación…"
                        style={{ minHeight: '120px' }}
                    />
                </Field>

                <Field label="Pendientes y notas">
                    <Textarea
                        value={form.notes}
                        onChange={e => update('notes', e.target.value)}
                        placeholder="Dudas, cantidades por confirmar, lo que falta…"
                        style={{ minHeight: '72px' }}
                    />
                </Field>

                <div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                            Hoja de receta {photos.length > 0 && `(${photos.length})`}
                        </span>
                        {recipeId && (
                            <Button variant="tonal" size="sm" icon={uploading ? 'hourglass_top' : 'add_a_photo'} type="button"
                                disabled={uploading} onClick={() => photoInputRef.current?.click()}>
                                {uploading ? 'Subiendo…' : 'Agregar foto'}
                            </Button>
                        )}
                    </div>
                    {!recipeId && (
                        <p className="text-sm text-on-surface-variant text-center py-3 bg-surface-container-low rounded-xl">
                            Guarda la receta para poder agregarle fotos de la hoja.
                        </p>
                    )}
                    {recipeId && photos.length === 0 && !uploading && (
                        <p className="text-sm text-on-surface-variant text-center py-3 bg-surface-container-low rounded-xl">
                            Sin fotos — toma una foto de la hoja escrita y agrégala aquí.
                        </p>
                    )}
                    {photos.length > 0 && <PhotoThumbs photos={photos} onOpen={setViewerIndex} onRemove={removePhoto} />}
                    <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoFiles} />
                </div>
            </form>
            {viewerIndex !== null && photos.length > 0 && (
                <PhotoViewer photos={photos} index={Math.min(viewerIndex, photos.length - 1)} title={form.name || 'Receta'} onClose={() => setViewerIndex(null)} />
            )}
        </Modal>
    );
};

// ---------- Vista principal ----------
// Compact native dropdown; highlighted while it holds a non-default value.
const FilterSelect: React.FC<{
    label: string;
    value: string;
    active: boolean;
    onChange: (v: string) => void;
    children: React.ReactNode;
}> = ({ label, value, active, onChange, children }) => (
    <label className="relative min-w-0">
        <span className="sr-only">{label}</span>
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className={`w-full appearance-none truncate pl-3 pr-7 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold outline-none transition focus:ring-2 focus:ring-primary/20 ${
                active
                    ? 'bg-primary-fixed/60 border-primary text-on-primary-fixed'
                    : 'bg-white border-outline-variant text-on-surface'
            }`}
        >
            {children}
        </select>
        <MIcon name="expand_more" size={18} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
    </label>
);

const RecipesView: React.FC<RecipesViewProps> = ({ authToken, onAuthError }) => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [typeSelection, setTypeSelection] = useState<RecipeTypeSelection | null>(null);
    const [editing, setEditing] = useState<Recipe | 'new' | null>(null);
    const [viewing, setViewing] = useState<Recipe | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Recipe | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [tempFilter, setTempFilter] = useState<DrinkTemp | null>(null);
    const [statusFilter, setStatusFilter] = useState<RecipeStatus | 'todas'>('todas');
    const [menuFilter, setMenuFilter] = useState('todas');
    const [query, setQuery] = useState('');
    const toast = useToast();

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await getRecipes(authToken);
                if (!cancelled) setRecipes(data.map(normalizeRecipe));
            } catch (err) {
                if (err instanceof AuthError) { onAuthError(); return; }
                if (!cancelled) toast('error', err instanceof Error ? err.message : 'Error al cargar recetas');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [authToken]);

    // Menu categories keep the order in which recipes were first created (the
    // import follows the OlaClick menu order); uncategorized recipes go last.
    const menuCategories = [...new Set(recipes.map(r => r.menuCategory).filter(Boolean))];

    const q = searchKey(query.trim());
    // Everything except the status filter, so the status counts reflect the
    // category, temperature and search currently selected.
    const scoped = recipes.filter(r =>
        (menuFilter === 'todas' || r.menuCategory === menuFilter) &&
        (!tempFilter || r.drinkTemps.includes(tempFilter)) &&
        (!q || searchKey(r.name).includes(q) || searchKey(r.description).includes(q))
    );
    const statusCount = (s: RecipeStatus) => scoped.filter(r => r.status === s).length;
    const filtered = statusFilter === 'todas' ? scoped : scoped.filter(r => r.status === statusFilter);
    const hasFilters = menuFilter !== 'todas' || statusFilter !== 'todas' || tempFilter !== null || q !== '';
    const clearFilters = () => { setMenuFilter('todas'); setStatusFilter('todas'); setTempFilter(null); setQuery(''); };
    const groups = [...menuCategories, '']
        .map(cat => ({ cat, items: filtered.filter(r => r.menuCategory === cat) }))
        .filter(g => g.items.length > 0);

    const handleNewRecipe = () => setShowTypeModal(true);

    const handlePhotosChange = (recipeId: string, photos: RecipePhoto[]) =>
        setRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, photos } : r));

    const handleTypeConfirm = (sel: RecipeTypeSelection) => {
        setTypeSelection(sel);
        setShowTypeModal(false);
        setEditing('new');
    };

    const handleSave = async (data: RecipeForm) => {
        const isNew = editing === 'new';
        try {
            if (isNew) {
                const created = normalizeRecipe(await createRecipe(authToken, data));
                setRecipes(prev => [...prev, created]);
                toast('success', `${data.name} creada`);
            } else {
                const updated = normalizeRecipe(await updateRecipe(authToken, (editing as Recipe).id, data));
                setRecipes(prev => prev.map(r => r.id === updated.id ? updated : r));
                toast('success', `${data.name} actualizada`);
            }
            setEditing(null);
            setTypeSelection(null);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al guardar');
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        setDeleting(true);
        try {
            await deleteRecipe(authToken, confirmDelete.id);
            setRecipes(prev => prev.filter(r => r.id !== confirmDelete.id));
            toast('success', `${confirmDelete.name} eliminada`);
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
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h1 className="font-epilogue text-3xl font-bold text-on-background">Recetas</h1>
                    <p className="text-on-surface-variant mt-0.5">
                        {isLoading ? 'Cargando…' : recipes.length === 0 ? 'Sin recetas' : `${recipes.length} receta${recipes.length !== 1 ? 's' : ''}`}
                        {!isLoading && recipes.some(r => r.status === 'sin_receta') && ` · ${recipes.filter(r => r.status === 'sin_receta').length} sin receta`}
                    </p>
                </div>
                <Button variant="filled" icon="add" onClick={handleNewRecipe}>
                    Nueva receta
                </Button>
            </div>

            {!isLoading && recipes.length > 0 && (
                <div className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-3 mb-5 bg-background/95 backdrop-blur border-b border-surface-variant space-y-2.5">
                    {/* Búsqueda */}
                    <div className="relative">
                        <MIcon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                        <Input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Buscar receta…"
                            className="w-full !pl-10 !pr-10 !bg-white"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                aria-label="Borrar búsqueda"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-on-surface-variant hover:bg-surface-container"
                            >
                                <MIcon name="close" size={16} />
                            </button>
                        )}
                    </div>

                    {/* Categoría · Estado · Temperatura */}
                    <div className="grid grid-cols-3 gap-2">
                        <FilterSelect label="Categoría del menú" value={menuFilter} active={menuFilter !== 'todas'} onChange={setMenuFilter}>
                            <option value="todas">Categoría</option>
                            {menuCategories.map(c => (
                                <option key={c} value={c}>{c} ({recipes.filter(r => r.menuCategory === c).length})</option>
                            ))}
                        </FilterSelect>
                        <FilterSelect label="Estado" value={statusFilter} active={statusFilter !== 'todas'} onChange={v => setStatusFilter(v as RecipeStatus | 'todas')}>
                            <option value="todas">Estado</option>
                            {RECIPE_STATUSES.map(s => (
                                <option key={s} value={s}>{STATUS_META[s].label} ({statusCount(s)})</option>
                            ))}
                        </FilterSelect>
                        <FilterSelect label="Temperatura" value={tempFilter ?? ''} active={tempFilter !== null} onChange={v => setTempFilter(v ? v as DrinkTemp : null)}>
                            <option value="">Temperatura</option>
                            <option value="fria">Fría</option>
                            <option value="caliente">Caliente</option>
                        </FilterSelect>
                    </div>

                    {hasFilters && (
                        <div className="flex items-center justify-between text-xs text-on-surface-variant">
                            <span>{filtered.length} de {recipes.length} recetas</span>
                            <button type="button" onClick={clearFilters} className="font-semibold text-primary hover:underline">
                                Limpiar filtros
                            </button>
                        </div>
                    )}
                </div>
            )}

            {isLoading && (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
                </div>
            )}

            {!isLoading && recipes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-full bg-secondary-container/40 flex items-center justify-center mb-4">
                        <MIcon name="menu_book" size={40} className="text-secondary" fill />
                    </div>
                    <h2 className="font-epilogue text-xl font-bold text-on-background">No hay recetas aún</h2>
                    <p className="text-on-surface-variant mt-1 mb-6 max-w-sm">
                        Crea recetas de bebidas y alimentos para tenerlas siempre a la mano.
                    </p>
                    <Button variant="filled" icon="add" onClick={handleNewRecipe}>
                        Crear receta
                    </Button>
                </div>
            )}

            {!isLoading && groups.map(({ cat, items }) => (
                <section key={cat || '__none__'} className="mb-8">
                    {(menuCategories.length > 0) && (
                        <h2 className="font-epilogue text-lg font-bold text-on-background mb-3 flex items-baseline gap-2">
                            {cat || 'Sin categoría del menú'}
                            <span className="text-sm font-normal text-on-surface-variant">{items.length}</span>
                        </h2>
                    )}
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                        {items.map(r => (
                            <RecipeCard
                                key={r.id}
                                recipe={r}
                                onView={setViewing}
                                onEdit={setEditing}
                                onDelete={setConfirmDelete}
                            />
                        ))}
                    </div>
                </section>
            ))}

            {!isLoading && filtered.length === 0 && recipes.length > 0 && (
                <div className="text-center py-16 text-on-surface-variant">
                    Ninguna receta coincide con los filtros.
                </div>
            )}

            {showTypeModal && (
                <RecipeTypeModal
                    onConfirm={handleTypeConfirm}
                    onClose={() => setShowTypeModal(false)}
                />
            )}
            {editing !== null && (
                <RecipeEditModal
                    recipe={editing}
                    initialTypeSelection={typeSelection ?? undefined}
                    menuCategories={menuCategories}
                    authToken={authToken}
                    onPhotosChange={handlePhotosChange}
                    onClose={() => { setEditing(null); setTypeSelection(null); }}
                    onSave={handleSave}
                />
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

export default RecipesView;
