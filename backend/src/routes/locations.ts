import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const createSchema = z.object({
    name: z.string().min(1, 'Nombre requerido').max(80, 'Máximo 80 caracteres'),
    code: z.string().max(40, 'Máximo 40 caracteres').optional(),
    description: z.string().default(''),
    active: z.boolean().default(true),
});

const updateSchema = z.object({
    name: z.string().min(1, 'Nombre requerido').max(80, 'Máximo 80 caracteres').optional(),
    code: z.string().min(1, 'Código requerido').max(40, 'Máximo 40 caracteres').optional(),
    description: z.string().optional(),
    active: z.boolean().optional(),
});

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(): string {
    let out = 'LOC-';
    for (let i = 0; i < 4; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return out;
}

async function generateUniqueCode(): Promise<string> {
    for (let i = 0; i < 8; i++) {
        const code = randomCode();
        const existing = await prisma.location.findUnique({ where: { code }, select: { id: true } });
        if (!existing) return code;
    }
    throw new Error('No se pudo generar un código único');
}

router.get('/', async (_req: Request, res: Response) => {
    try {
        const locations = await prisma.location.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { items: true } } },
        });
        res.json(locations);
    } catch (err) {
        console.error('Error al obtener ubicaciones:', err);
        res.status(500).json({ error: 'Error al obtener ubicaciones' });
    }
});

router.get('/by-code/:code', async (req: Request, res: Response) => {
    try {
        const location = await prisma.location.findUnique({
            where: { code: req.params.code },
            include: {
                items: {
                    include: { article: { select: { id: true, name: true, image: true, category: true } } },
                    orderBy: { article: { name: 'asc' } },
                },
            },
        });
        if (!location) { res.status(404).json({ error: 'Ubicación no encontrada' }); return; }
        res.json(location);
    } catch (err) {
        console.error('Error al obtener ubicación por código:', err);
        res.status(500).json({ error: 'Error al obtener ubicación' });
    }
});

router.get('/:id', async (req: Request, res: Response) => {
    try {
        const location = await prisma.location.findUnique({
            where: { id: req.params.id },
            include: {
                items: {
                    include: { article: { select: { id: true, name: true, image: true, category: true } } },
                    orderBy: { article: { name: 'asc' } },
                },
            },
        });
        if (!location) { res.status(404).json({ error: 'Ubicación no encontrada' }); return; }
        res.json(location);
    } catch (err) {
        console.error('Error al obtener ubicación:', err);
        res.status(500).json({ error: 'Error al obtener ubicación' });
    }
});

router.post('/', async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const code = parsed.data.code?.trim() || await generateUniqueCode();
        const location = await prisma.location.create({
            data: {
                name: parsed.data.name.trim(),
                code,
                description: parsed.data.description,
                active: parsed.data.active,
            },
        });
        res.status(201).json(location);
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
            const target = (err as { meta?: { target?: string[] } }).meta?.target?.[0];
            res.status(409).json({ error: target === 'code' ? 'El código ya existe' : 'El nombre ya existe' });
            return;
        }
        console.error('Error al crear ubicación:', err);
        res.status(500).json({ error: 'Error al crear ubicación' });
    }
});

router.put('/:id', async (req: Request, res: Response) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const data: { name?: string; code?: string; description?: string; active?: boolean } = {};
        if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
        if (parsed.data.code !== undefined) data.code = parsed.data.code.trim();
        if (parsed.data.description !== undefined) data.description = parsed.data.description;
        if (parsed.data.active !== undefined) data.active = parsed.data.active;
        const location = await prisma.location.update({ where: { id: req.params.id }, data });
        res.json(location);
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err) {
            const code = (err as { code: string }).code;
            if (code === 'P2025') { res.status(404).json({ error: 'Ubicación no encontrada' }); return; }
            if (code === 'P2002') {
                const target = (err as { meta?: { target?: string[] } }).meta?.target?.[0];
                res.status(409).json({ error: target === 'code' ? 'El código ya existe' : 'El nombre ya existe' });
                return;
            }
        }
        console.error('Error al actualizar ubicación:', err);
        res.status(500).json({ error: 'Error al actualizar ubicación' });
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await prisma.location.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
            res.status(404).json({ error: 'Ubicación no encontrada' }); return;
        }
        console.error('Error al eliminar ubicación:', err);
        res.status(500).json({ error: 'Error al eliminar ubicación' });
    }
});

export default router;
