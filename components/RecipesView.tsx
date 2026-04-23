import React, { useState, useEffect } from 'react';
import { Toast } from './Toast';
import { PlusIcon, TrashIcon, PencilIcon, BookOpenIcon, XIcon, PlusCircleIcon } from './icons';

interface Ingredient {
    id?: number;
    name: string;
    amount: string;
}

interface Recipe {
    id: number;
    name: string;
    description: string | null;
    instructions: string | null;
    imageUrl: string | null;
    category: string;
    ingredients: Ingredient[];
}

interface RecipesViewProps {
    authToken: string;
    onAuthError: () => void;
}

const RecipesView: React.FC<RecipesViewProps> = ({ authToken, onAuthError }) => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [category, setCategory] = useState('Bebidas');
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);

    const API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8080';

    const fetchRecipes = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/recipes`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (response.status === 401 || response.status === 403) {
                onAuthError();
                return;
            }

            if (!response.ok) throw new Error('Error al cargar recetas');

            const data = await response.json();
            setRecipes(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecipes();
    }, [authToken]);

    const openModal = (recipe: Recipe | null = null) => {
        if (recipe) {
            setEditingRecipe(recipe);
            setName(recipe.name);
            setDescription(recipe.description || '');
            setInstructions(recipe.instructions || '');
            setImageUrl(recipe.imageUrl || '');
            setCategory(recipe.category);
            setIngredients(recipe.ingredients);
        } else {
            setEditingRecipe(null);
            setName('');
            setDescription('');
            setInstructions('');
            setImageUrl('');
            setCategory('Bebidas');
            setIngredients([]);
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingRecipe(null);
    };

    const handleAddIngredient = () => {
        setIngredients([...ingredients, { name: '', amount: '' }]);
    };

    const handleIngredientChange = (index: number, field: keyof Ingredient, value: string) => {
        const newIngredients = [...ingredients];
        newIngredients[index] = { ...newIngredients[index], [field]: value };
        setIngredients(newIngredients);
    };

    const handleRemoveIngredient = (index: number) => {
        setIngredients(ingredients.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const recipeData = {
            name,
            description,
            instructions,
            imageUrl,
            category,
            ingredients: ingredients.filter(ing => ing.name.trim() !== '')
        };

        try {
            const method = editingRecipe ? 'PUT' : 'POST';
            const url = editingRecipe 
                ? `${API_URL}/api/recipes/${editingRecipe.id}`
                : `${API_URL}/api/recipes`;

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(recipeData)
            });

            if (!response.ok) throw new Error('Error al guardar la receta');

            Toast.success(editingRecipe ? 'Receta actualizada' : 'Receta creada');
            closeModal();
            fetchRecipes();
        } catch (err) {
            Toast.error(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar esta receta?')) return;

        try {
            const response = await fetch(`${API_URL}/api/recipes/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (!response.ok) throw new Error('Error al eliminar');

            Toast.success('Receta eliminada');
            fetchRecipes();
        } catch (err) {
            Toast.error(err instanceof Error ? err.message : 'Error al eliminar');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <BookOpenIcon className="w-7 h-7 text-indigo-600" />
                    Recetas de Bebidas
                </h1>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                    <PlusIcon className="w-5 h-5" />
                    Nueva Receta
                </button>
            </div>

            {loading && recipes.length === 0 ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            ) : recipes.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <BookOpenIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No hay recetas guardadas todavía.</p>
                    <button
                        onClick={() => openModal()}
                        className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                        Crear la primera receta
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recipes.map((recipe) => (
                        <div key={recipe.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                            {recipe.imageUrl ? (
                                <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-48 object-cover" />
                            ) : (
                                <div className="w-full h-48 bg-slate-100 flex items-center justify-center">
                                    <BookOpenIcon className="w-12 h-12 text-slate-300" />
                                </div>
                            )}
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-lg font-bold text-slate-800">{recipe.name}</h3>
                                    <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-1 rounded uppercase">
                                        {recipe.category}
                                    </span>
                                </div>
                                <p className="text-slate-600 text-sm line-clamp-2 mb-4">
                                    {recipe.description || 'Sin descripción'}
                                </p>
                                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                                    <div className="text-xs text-slate-400">
                                        {recipe.ingredients.length} ingredientes
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openModal(recipe)}
                                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(recipe.id)}
                                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal para Crear/Editar */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingRecipe ? 'Editar Receta' : 'Nueva Receta'}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Nombre de la Bebida *</label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Ej. Mojito Clásico"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Categoría</label>
                                    <input
                                        type="text"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Ej. Cocteles, Jugos..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Imagen URL</label>
                                <input
                                    type="url"
                                    value={imageUrl}
                                    onChange={(e) => setImageUrl(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="https://images.unsplash.com/..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Descripción Corta</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    rows={2}
                                    placeholder="Breve descripción de la bebida..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Instrucciones de Preparación</label>
                                <textarea
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    rows={4}
                                    placeholder="Paso 1: Mezclar...
Paso 2: Agitar..."
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-semibold text-slate-700">Ingredientes</label>
                                    <button
                                        type="button"
                                        onClick={handleAddIngredient}
                                        className="text-indigo-600 hover:text-indigo-800 text-sm font-bold flex items-center gap-1"
                                    >
                                        <PlusCircleIcon className="w-4 h-4" />
                                        Añadir
                                    </button>
                                </div>
                                
                                {ingredients.length === 0 && (
                                    <p className="text-xs text-slate-400 italic">No has añadido ingredientes.</p>
                                )}

                                <div className="space-y-3">
                                    {ingredients.map((ing, index) => (
                                        <div key={index} className="flex gap-3">
                                            <input
                                                type="text"
                                                placeholder="Ingrediente (ej. Ron)"
                                                value={ing.name}
                                                onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Cantidad (ej. 2 oz)"
                                                value={ing.amount}
                                                onChange={(e) => handleIngredientChange(index, 'amount', e.target.value)}
                                                className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveIngredient(index)}
                                                className="text-slate-400 hover:text-red-500 p-2"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-[2] px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {loading ? 'Guardando...' : (editingRecipe ? 'Guardar Cambios' : 'Crear Receta')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecipesView;
