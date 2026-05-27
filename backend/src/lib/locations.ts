import { prisma } from './prisma';

/**
 * Resuelve un SKU/código de ubicación libre a un Location.id.
 * - Trim + uppercase para normalizar
 * - Si el code existe, devuelve su id
 * - Si no existe, crea Location con name=code
 * - Si el input es vacío/null, devuelve null (desasignar ubicación)
 */
export async function resolveLocationSkuToId(rawSku: string | null | undefined): Promise<string | null> {
    if (rawSku == null) return null;
    const code = String(rawSku).trim().toUpperCase();
    if (!code) return null;

    const existing = await prisma.location.findUnique({ where: { code }, select: { id: true } });
    if (existing) return existing.id;

    const created = await prisma.location.create({
        data: { code, name: code, active: true },
        select: { id: true },
    });
    return created.id;
}
