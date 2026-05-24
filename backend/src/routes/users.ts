import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { DEFAULT_PERMISSIONS, PERMISSION_KEYS, normalizePermissions } from '../permissions';

const router = Router();

const createUserSchema = z.object({
    username: z.string().min(2, 'Username debe tener al menos 2 caracteres'),
    nombre: z.string().min(1, 'Nombre es requerido'),
    password: z.string().min(6, 'Password debe tener al menos 6 caracteres'),
    permissions: z.record(z.enum(PERMISSION_KEYS), z.boolean()).optional(),
});

const updateUserSchema = z.object({
    nombre: z.string().min(1).optional(),
    password: z.string().min(6).optional(),
    activo: z.boolean().optional(),
    permissions: z.record(z.enum(PERMISSION_KEYS), z.boolean()).optional(),
});

const userSelect = {
    id: true,
    username: true,
    nombre: true,
    activo: true,
    permissions: true,
    createdAt: true,
};

async function activeUserManagersCount(): Promise<number> {
    const users = await prisma.user.findMany({
        where: { activo: true },
        select: { permissions: true },
    });
    return users.filter((user) => normalizePermissions(user.permissions).users).length;
}

function formatUser(user: {
    id: string;
    username: string;
    nombre: string;
    activo: boolean;
    permissions: unknown;
    createdAt: Date;
}) {
    return {
        ...user,
        permissions: normalizePermissions(user.permissions),
    };
}

router.get('/', async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
        select: userSelect,
        orderBy: { createdAt: 'asc' },
    });
    res.json(users.map(formatUser));
});

router.post('/', async (req: Request, res: Response) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
    }
    const { username, nombre, password } = parsed.data;
    const permissions = normalizePermissions(parsed.data.permissions ?? DEFAULT_PERMISSIONS);
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
        res.status(409).json({ error: 'El username ya existe' });
        return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: { username, nombre, passwordHash, permissions },
        select: userSelect,
    });
    res.status(201).json(formatUser(user));
});

router.put('/:id', async (req: Request, res: Response) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
    }
    const { nombre, password, activo, permissions } = parsed.data;
    const data: Record<string, unknown> = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (activo !== undefined) data.activo = activo;
    if (permissions !== undefined) data.permissions = normalizePermissions(permissions);
    if (password !== undefined) data.passwordHash = await bcrypt.hash(password, 10);
    try {
        const existing = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { activo: true, permissions: true },
        });
        if (!existing) {
            res.status(404).json({ error: 'Usuario no encontrado' });
            return;
        }
        const currentPermissions = normalizePermissions(existing.permissions);
        const nextPermissions = permissions !== undefined ? normalizePermissions(permissions) : currentPermissions;
        const nextActive = activo !== undefined ? activo : existing.activo;
        if (existing.activo && currentPermissions.users && (!nextActive || !nextPermissions.users)) {
            const managers = await activeUserManagersCount();
            if (managers <= 1) {
                res.status(400).json({ error: 'Debe existir al menos un usuario activo con permiso de Usuarios' });
                return;
            }
        }
        const user = await prisma.user.update({
            where: { id: req.params.id },
            data,
            select: userSelect,
        });
        res.json(formatUser(user));
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
        const existing = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { activo: true, permissions: true },
        });
        if (!existing) {
            res.status(404).json({ error: 'Usuario no encontrado' });
            return;
        }
        if (existing.activo && normalizePermissions(existing.permissions).users) {
            const managers = await activeUserManagersCount();
            if (managers <= 1) {
                res.status(400).json({ error: 'Debe existir al menos un usuario activo con permiso de Usuarios' });
                return;
            }
        }
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
