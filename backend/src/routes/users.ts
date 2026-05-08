import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const createUserSchema = z.object({
    username: z.string().min(2, 'Username debe tener al menos 2 caracteres'),
    nombre: z.string().min(1, 'Nombre es requerido'),
    password: z.string().min(6, 'Password debe tener al menos 6 caracteres'),
});

const updateUserSchema = z.object({
    nombre: z.string().min(1).optional(),
    password: z.string().min(6).optional(),
    activo: z.boolean().optional(),
});

router.get('/', async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
        select: { id: true, username: true, nombre: true, activo: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
    });
    res.json(users);
});

router.post('/', async (req: Request, res: Response) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
    }
    const { username, nombre, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
        res.status(409).json({ error: 'El username ya existe' });
        return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: { username, nombre, passwordHash },
        select: { id: true, username: true, nombre: true, activo: true, createdAt: true },
    });
    res.status(201).json(user);
});

router.put('/:id', async (req: Request, res: Response) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
    }
    const { nombre, password, activo } = parsed.data;
    const data: Record<string, unknown> = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (activo !== undefined) data.activo = activo;
    if (password !== undefined) data.passwordHash = await bcrypt.hash(password, 10);
    try {
        const user = await prisma.user.update({
            where: { id: req.params.id },
            data,
            select: { id: true, username: true, nombre: true, activo: true, createdAt: true },
        });
        res.json(user);
    } catch {
        res.status(404).json({ error: 'Usuario no encontrado' });
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    if (req.user?.userId === req.params.id) {
        res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
        return;
    }
    try {
        const total = await prisma.user.count();
        if (total <= 1) {
            res.status(400).json({ error: 'No puedes eliminar el único usuario del sistema' });
            return;
        }
        await prisma.user.delete({ where: { id: req.params.id } });
        res.status(204).send();
    } catch {
        res.status(404).json({ error: 'Usuario no encontrado' });
    }
});

export default router;
