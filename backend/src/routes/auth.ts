import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { loginLimiter } from '../middleware/rateLimiter';
import { normalizePermissions } from '../permissions';

const router = Router();

const loginSchema = z.object({
    username: z.string().min(1, 'Username es requerido'),
    password: z.string().min(1, 'Password es requerido'),
});

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
    }

    const { username, password } = parsed.data;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('JWT_SECRET no configurado');
        res.status(500).json({ error: 'Error de configuracion del servidor' });
        return;
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.activo) {
        res.status(401).json({ error: 'Credenciales invalidas' });
        return;
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
        res.status(401).json({ error: 'Credenciales invalidas' });
        return;
    }

    const permissions = normalizePermissions(user.permissions);
    const token = jwt.sign({ userId: user.id, username: user.username }, jwtSecret, { expiresIn: '30d' });
    res.json({
        token,
        user: { id: user.id, username: user.username, nombre: user.nombre, permissions },
    });
});

export default router;
