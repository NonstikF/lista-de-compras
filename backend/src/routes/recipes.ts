import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const recipeCategories = ['caliente', 'fria', 'especial'] as const;
type RecipeCategory = typeof recipeCategories[number];

const recipeTypes = ['alimento', 'bebida', 'otros'] as const;
type RecipeType = typeof recipeTypes[number];

const drinkTempValues = ['fria', 'caliente'] as const;
type DrinkTemp = typeof drinkTempValues[number];

const drinkSizes = ['10oz', '12oz', '16oz'] as const;

const recipeStatuses = ['completa', 'incompleta', 'sin_receta'] as const;
type RecipeStatus = typeof recipeStatuses[number];

function normalizeRecipeStatus(s: unknown): RecipeStatus {
    return recipeStatuses.includes(s as RecipeStatus) ? s as RecipeStatus : 'completa';
}

function normalizeRecipeCategory(category: unknown): RecipeCategory {
    return recipeCategories.includes(category as RecipeCategory) ? category as RecipeCategory : 'especial';
}

function normalizeRecipeType(t: unknown): RecipeType {
    return recipeTypes.includes(t as RecipeType) ? t as RecipeType : 'alimento';
}

function parseDrinkTemps(raw: unknown): DrinkTemp[] {
    if (Array.isArray(raw)) {
        return raw.filter((t): t is DrinkTemp => drinkTempValues.includes(t));
    }
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.filter((t): t is DrinkTemp => drinkTempValues.includes(t));
        } catch { /* ignore */ }
    }
    return [];
}

type PrismaRecipe = {
    id: string;
    name: string;
    description: string;
    recipeType: string;
    category: string;
    drinkTemps: string;
    image: string | null;
    instructions: string;
    servings: number;
    status: string;
    menuCategory: string;
    notes: string;
    createdAt: Date;
    updatedAt: Date;
    ingredients: { name: string; quantity: string; unit: string }[];
    sizeVariants: {
        id: number;
        temp: string;
        size: string;
        ingredients: { name: string; quantity: string; unit: string }[];
    }[];
    photos?: { id: string }[];
};

// Root-relative, resolved against the API base by the frontend (see resolveImageUrl).
const photoUrl = (id: string) => `/api/recipe-photos/${id}/image`;

function formatRecipe(recipe: PrismaRecipe) {
    return {
        ...recipe,
        recipeType: normalizeRecipeType(recipe.recipeType),
        category: normalizeRecipeCategory(recipe.category),
        drinkTemps: parseDrinkTemps(recipe.drinkTemps),
        image: recipe.image ?? null,
        description: recipe.description ?? '',
        instructions: recipe.instructions ?? '',
        servings: Math.max(1, Number(recipe.servings) || 1),
        status: normalizeRecipeStatus(recipe.status),
        menuCategory: recipe.menuCategory ?? '',
        notes: recipe.notes ?? '',
        ingredients: recipe.ingredients ?? [],
        sizeVariants: (recipe.sizeVariants ?? []).map(sv => ({
            id: sv.id,
            temp: drinkTempValues.includes(sv.temp as DrinkTemp) ? sv.temp : 'caliente',
            size: sv.size,
            ingredients: sv.ingredients ?? [],
        })),
        photos: (recipe.photos ?? []).map(p => ({ id: p.id, url: photoUrl(p.id) })),
    };
}

const sizeIngredientSchema = z.object({
    name: z.string(),
    quantity: z.string(),
    unit: z.string(),
});

const sizeVariantSchema = z.object({
    temp: z.enum(drinkTempValues),
    size: z.enum(drinkSizes),
    ingredients: z.array(sizeIngredientSchema).default([]),
});

const recipeSchema = z.object({
    name: z.string().min(1, 'Nombre requerido'),
    description: z.string().default(''),
    recipeType: z.string().default('alimento').transform(normalizeRecipeType),
    category: z.string().default('especial').transform(normalizeRecipeCategory),
    drinkTemps: z.array(z.string()).default([]).transform(arr =>
        JSON.stringify(arr.filter((t): t is DrinkTemp => drinkTempValues.includes(t as DrinkTemp)))
    ),
    image: z.string().nullable().default(null),
    instructions: z.string().default(''),
    servings: z.number().int().min(1).default(1),
    status: z.string().default('completa').transform(normalizeRecipeStatus),
    menuCategory: z.string().default(''),
    notes: z.string().default(''),
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
    photos: { select: { id: true }, orderBy: { position: 'asc' as const } },
};

const photoSchema = z.object({
    image: z.string().regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, 'Imagen inválida'),
});

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
                        temp: sv.temp,
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
        await prisma.recipeSizeVariant.deleteMany({ where: { recipeId: req.params.id } });
        const recipe = await prisma.recipe.update({
            where: { id: req.params.id },
            data: {
                ...rest,
                ingredients: { deleteMany: {}, create: ingredients },
                sizeVariants: {
                    create: sizeVariants.map(sv => ({
                        temp: sv.temp,
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

router.post('/:id/photos', async (req: Request, res: Response) => {
    const parsed = photoSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const recipe = await prisma.recipe.findUnique({ where: { id: req.params.id }, select: { id: true } });
        if (!recipe) { res.status(404).json({ error: 'Receta no encontrada' }); return; }
        const last = await prisma.recipePhoto.aggregate({ where: { recipeId: recipe.id }, _max: { position: true } });
        const photo = await prisma.recipePhoto.create({
            data: { recipeId: recipe.id, image: parsed.data.image, position: (last._max.position ?? -1) + 1 },
            select: { id: true },
        });
        res.status(201).json({ id: photo.id, url: photoUrl(photo.id) });
    } catch (err) {
        console.error('Error al subir foto de receta:', err);
        res.status(500).json({ error: 'Error al subir la foto' });
    }
});

router.delete('/:id/photos/:photoId', async (req: Request, res: Response) => {
    try {
        const { count } = await prisma.recipePhoto.deleteMany({ where: { id: req.params.photoId, recipeId: req.params.id } });
        if (count === 0) { res.status(404).json({ error: 'Foto no encontrada' }); return; }
        res.json({ success: true });
    } catch (err) {
        console.error('Error al eliminar foto de receta:', err);
        res.status(500).json({ error: 'Error al eliminar la foto' });
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
