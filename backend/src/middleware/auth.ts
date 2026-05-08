import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
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
        req.user = { userId: payload.userId, username: payload.username };
        next();
    } catch {
        res.status(403).json({ error: 'Token invalido o expirado' });
    }
}
