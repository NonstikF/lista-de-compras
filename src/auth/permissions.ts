import type { PermissionKey, UserPermissions } from '../types';

export const permissionKeys: PermissionKey[] = [
  'dashboard',
  'orders',
  'recipes',
  'articles',
  'store',
  'suppliers',
  'users',
  'inventory',
  'settings',
];

export const permissionLabels: Record<PermissionKey, string> = {
  dashboard: 'Panel',
  orders: 'Pedidos',
  recipes: 'Recetas',
  articles: 'Articulos',
  store: 'Tienda',
  suppliers: 'Proveedores',
  users: 'Usuarios',
  inventory: 'Inventario',
  settings: 'Configuracion',
};

export const defaultPermissions: UserPermissions = {
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
    permissionKeys.map((key) => [key, raw[key] === true])
  ) as UserPermissions;
}
