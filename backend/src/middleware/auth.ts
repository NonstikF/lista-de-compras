import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { normalizePermissions } from '../permissions';

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ error: 'Token de acceso requerido' });
        return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('JWT_SECRET no configurado en variables de entorno');
        res.status(500).json({ error: 'Error de configuracion del servidor' });
        return;
    }

    try {
        const payload = jwt.verify(token, jwtSecret) as { userId: string; username: string };
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, username: true, nombre: true, activo: true, permissions: true },
        });
        if (!user || !user.activo) {
            res.status(401).json({ error: 'Token invalido o expirado' });
            return;
        }
        req.user = {
            userId: user.id,
            username: user.username,
            nombre: user.nombre,
            permissions: normalizePermissions(user.permissions),
        };
        next();
    } catch {
        res.status(401).json({ error: 'Token invalido o expirado' });
    }
}
