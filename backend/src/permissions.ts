import { Request, Response, NextFunction } from 'express';

export const PERMISSION_KEYS = [
    'dashboard',
    'orders',
    'recipes',
    'articles',
    'store',
    'suppliers',
    'users',
    'inventory',
    'settings',
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];
export type UserPermissions = Record<PermissionKey, boolean>;

export const DEFAULT_PERMISSIONS: UserPermissions = {
    dashboard: true,
    orders: true,
    recipes: true,
    articles: true,
    store: true,
    suppliers: true,
    users: true,
    inventory: true,
    settings: true,
};

export function normalizePermissions(value: unknown): UserPermissions {
    const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return Object.fromEntries(
        PERMISSION_KEYS.map((key) => [key, raw[key] === true])
    ) as UserPermissions;
}

export function requirePermission(permission: PermissionKey) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user?.permissions?.[permission]) {
            res.status(403).json({ error: 'No tienes permiso para acceder a esta seccion' });
            return;
        }
        next();
    };
}
