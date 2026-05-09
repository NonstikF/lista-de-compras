import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const recipeCategories = ['caliente', 'fria', 'especial'] as const;
type RecipeCategory = typeof recipeCategories[number];

const recipeTypes = ['alimento', 'bebida'] as const;
type RecipeType = typeof recipeTypes[number];

const drinkTemps = ['fria', 'caliente'] as const;
type DrinkTemp = typeof drinkTemps[number];

const drinkSizes = ['10oz', '12oz', '16oz'] as const;

function normalizeRecipeCategory(category: unknown): RecipeCategory {
    return recipeCategories.includes(category as RecipeCategory) ? category as RecipeCategory : 'especial';
}

function normalizeRecipeType(t: unknown): RecipeType {
    return recipeTypes.includes(t as RecipeType) ? t as RecipeType : 'alimento';
}

function normalizeDrinkTemp(t: unknown): DrinkTemp | null {
    return drinkTemps.includes(t as DrinkTemp) ? t as DrinkTemp : null;
}

type PrismaRecipe = {
    id: string;
    name: string;
    description: string;
    recipeType: string;
    category: string;
    drinkTemp: string | null;
    image: string | null;
    instructions: string;
    servings: number;
    createdAt: Date;
    updatedAt: Date;
    ingredients: { name: string; quantity: string; unit: string }[];
    sizeVariants: {
        id: number;
        size: string;
        ingredients: { name: string; quantity: string; unit: string }[];
    }[];
};

function formatRecipe(recipe: PrismaRecipe) {
    return {
        ...recipe,
        recipeType: normalizeRecipeType(recipe.recipeType),
        category: normalizeRecipeCategory(recipe.category),
        drinkTemp: normalizeDrinkTemp(recipe.drinkTemp),
        image: recipe.image ?? null,
        description: recipe.description ?? '',
        instructions: recipe.instructions ?? '',
        servings: Math.max(1, Number(recipe.servings) || 1),
        ingredients: recipe.ingredients ?? [],
        sizeVariants: (recipe.sizeVariants ?? []).map(sv => ({
            id: sv.id,
            size: sv.size,
            ingredients: sv.ingredients ?? [],
        })),
    };
}

const sizeIngredientSchema = z.object({
    name: z.string(),
    quantity: z.string(),
    unit: z.string(),
});

const sizeVariantSchema = z.object({
    size: z.enum(drinkSizes),
    ingredients: z.array(sizeIngredientSchema).default([]),
});

const recipeSchema = z.object({
    name: z.string().min(1, 'Nombre requerido'),
    description: z.string().default(''),
    recipeType: z.string().default('alimento').transform(normalizeRecipeType),
    category: z.string().default('especial').transform(normalizeRecipeCategory),
    drinkTemp: z.string().nullable().default(null).transform(normalizeDrinkTemp),
    image: z.string().nullable().default(null),
    instructions: z.string().default(''),
    servings: z.number().int().min(1).default(1),
    ingredients: z.array(z.object({
        name: z.string(),
        quantity: z.string(),
        unit: z.string(),
    })).default([]),
    sizeVariants: z.array(sizeVariantSchema).default([]),
});

const includeAll = {
    ingredients: true,
    sizeVariants: { include: { ingredients: true } },
};

router.get('/', async (_req: Request, res: Response) => {
    try {
        const recipes = await prisma.recipe.findMany({
            include: includeAll,
            orderBy: { createdAt: 'asc' },
        });
        res.json(recipes.map(r => formatRecipe(r as unknown as PrismaRecipe)));
    } catch (err) {
        console.error('Error al obtener recetas:', err);
        res.status(500).json({ error: 'Error al obtener recetas' });
    }
});

router.post('/', async (req: Request, res: Response) => {
    const parsed = recipeSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { ingredients, sizeVariants, ...rest } = parsed.data;
    try {
        const recipe = await prisma.recipe.create({
            data: {
                ...rest,
                ingredients: { create: ingredients },
                sizeVariants: {
                    create: sizeVariants.map(sv => ({
                        size: sv.size,
                        ingredients: { create: sv.ingredients },
                    })),
                },
            },
            include: includeAll,
        });
        res.status(201).json(formatRecipe(recipe as unknown as PrismaRecipe));
    } catch (err) {
        console.error('Error al crear receta:', err);
        res.status(500).json({ error: 'Error al crear receta' });
    }
});

router.put('/:id', async (req: Request, res: Response) => {
    const parsed = recipeSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { ingredients, sizeVariants, ...rest } = parsed.data;
    try {
        // Delete existing size variants (cascade deletes their ingredients)
        await prisma.recipeSizeVariant.deleteMany({ where: { recipeId: req.params.id } });

        const recipe = await prisma.recipe.update({
            where: { id: req.params.id },
            data: {
                ...rest,
                ingredients: { deleteMany: {}, create: ingredients },
                sizeVariants: {
                    create: sizeVariants.map(sv => ({
                        size: sv.size,
                        ingredients: { create: sv.ingredients },
                    })),
                },
            },
            include: includeAll,
        });
        res.json(formatRecipe(recipe as unknown as PrismaRecipe));
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
