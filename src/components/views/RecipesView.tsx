import React, { useState, useEffect, useRef } from 'react';
import type { Recipe, RecipeIngredient, RecipeSizeVariant, DrinkTemp, DrinkSize, RecipeType } from '../../types';
import { AuthError, getRecipes, createRecipe, updateRecipe, deleteRecipe } from '../../services/api';
import { Modal, Button, Field, Input, Select, Textarea, Chip, MIcon, useToast } from '../ui';

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

const getCategoryMeta = (category: unknown) => CATEGORY_META[normalizeCategory(category)];

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
});

// ---------- Imagen o placeholder ----------
const RecipeImage: React.FC<{ recipe: Recipe; className?: string }> = ({ recipe, className = '' }) => {
    const meta = getCategoryMeta(recipe.category);
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
            <div className="h-40 overflow-hidden">
                <RecipeImage recipe={recipe} />
            </div>
            <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
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
                    <span className={`inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full ${typeColor}`}>
                        <MIcon name={typeIcon} className="text-base" fill />
                        {typeLabel}
                    </span>
                    {!isBebida && recipe.servings > 0 && (
                        <span className="text-sm text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
                            {recipe.servings} porción{recipe.servings !== 1 ? 'es' : ''}
                        </span>
                    )}
                </div>
                {recipe.description && <p className="text-on-surface-variant">{recipe.description}</p>}

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
            </div>
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
    onClose: () => void;
    onSave: (data: RecipeForm) => Promise<void>;
}> = ({ recipe, initialTypeSelection, onClose, onSave }) => {
    const isNew = recipe === 'new';

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
            </form>
        </Modal>
    );
};

// ---------- Vista principal ----------
type CategoryFilter = 'todas' | Recipe['category'];

const RecipesView: React.FC<RecipesViewProps> = ({ authToken, onAuthError }) => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [typeSelection, setTypeSelection] = useState<RecipeTypeSelection | null>(null);
    const [editing, setEditing] = useState<Recipe | 'new' | null>(null);
    const [viewing, setViewing] = useState<Recipe | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Recipe | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [catFilter, setCatFilter] = useState<CategoryFilter>('todas');
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

    const filtered = catFilter === 'todas' ? recipes : recipes.filter(r => normalizeCategory(r.category) === catFilter);

    const handleNewRecipe = () => setShowTypeModal(true);

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
                    </p>
                </div>
                <Button variant="filled" icon="add" onClick={handleNewRecipe}>
                    Nueva receta
                </Button>
            </div>

            {!isLoading && recipes.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-6">
                    <Chip active={catFilter === 'todas'} onClick={() => setCatFilter('todas')} icon="apps">Todas</Chip>
                    <Chip active={catFilter === 'caliente'} onClick={() => setCatFilter('caliente')} icon="local_fire_department">Caliente</Chip>
                    <Chip active={catFilter === 'fria'} onClick={() => setCatFilter('fria')} icon="ac_unit">Fría</Chip>
                    <Chip active={catFilter === 'especial'} onClick={() => setCatFilter('especial')} icon="auto_awesome">Especial</Chip>
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

            {!isLoading && filtered.length > 0 && (
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

            {!isLoading && filtered.length === 0 && recipes.length > 0 && (
                <div className="text-center py-16 text-on-surface-variant">
                    Sin recetas en esta categoría.
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
