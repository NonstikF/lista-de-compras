import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const recipeCategories = ['caliente', 'fria', 'especial'] as const;
type RecipeCategory = typeof recipeCategories[number];

function normalizeRecipeCategory(category: unknown): RecipeCategory {
    return recipeCategories.includes(category as RecipeCategory) ? category as RecipeCategory : 'especial';
}

function formatRecipe(recipe: {
    id: string;
    name: string;
    description: string;
    category: string;
    image: string | null;
    instructions: string;
    servings: number;
    createdAt: Date;
    updatedAt: Date;
    ingredients: { name: string; quantity: string; unit: string }[];
}) {
    return {
        ...recipe,
        category: normalizeRecipeCategory(recipe.category),
        image: recipe.image ?? null,
        description: recipe.description ?? '',
        instructions: recipe.instructions ?? '',
        servings: Math.max(1, Number(recipe.servings) || 1),
        ingredients: recipe.ingredients ?? [],
    };
}

const recipeSchema = z.object({
    name: z.string().min(1, 'Nombre requerido'),
    description: z.string().default(''),
    category: z.string().default('especial').transform(normalizeRecipeCategory),
    image: z.string().nullable().default(null),
    instructions: z.string().default(''),
    servings: z.number().int().min(1).default(1),
    ingredients: z.array(z.object({
        name: z.string(),
        quantity: z.string(),
        unit: z.string(),
    })).default([]),
});

router.get('/', async (_req: Request, res: Response) => {
    try {
        const recipes = await prisma.recipe.findMany({
            include: { ingredients: true },
            orderBy: { createdAt: 'asc' },
        });
        res.json(recipes.map(formatRecipe));
    } catch (err) {
        console.error('Error al obtener recetas:', err);
        res.status(500).json({ error: 'Error al obtener recetas' });
    }
});

router.post('/', async (req: Request, res: Response) => {
    const parsed = recipeSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { ingredients, ...rest } = parsed.data;
    try {
        const recipe = await prisma.recipe.create({
            data: { ...rest, ingredients: { create: ingredients } },
            include: { ingredients: true },
        });
        res.status(201).json(formatRecipe(recipe));
    } catch (err) {
        console.error('Error al crear receta:', err);
        res.status(500).json({ error: 'Error al crear receta' });
    }
});

router.put('/:id', async (req: Request, res: Response) => {
    const parsed = recipeSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { ingredients, ...rest } = parsed.data;
    try {
        const recipe = await prisma.recipe.update({
            where: { id: req.params.id },
            data: { ...rest, ingredients: { deleteMany: {}, create: ingredients } },
            include: { ingredients: true },
        });
        res.json(formatRecipe(recipe));
    } catch (err) {
        console.error('Error al actualizar receta:', err);
        res.status(500).json({ error: 'Error al actualizar receta' });
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await prisma.recipe.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        console.error('Error al eliminar receta:', err);
        res.status(500).json({ error: 'Error al eliminar receta' });
    }
});

export default router;
