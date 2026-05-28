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

    try {
        const upserted = await prisma.location.upsert({
            where: { code },
            update: {},
            create: { code, name: code, active: true },
            select: { id: true },
        });
        return upserted.id;
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
            const existing = await prisma.location.findUnique({ where: { code }, select: { id: true } });
            if (existing) return existing.id;
            const target = (err as { meta?: { target?: string[] } }).meta?.target?.[0];
            throw new Error(target === 'name' ? `Ya existe una ubicación con el nombre "${code}"` : 'No se pudo crear la ubicación');
        }
        throw err;
    }
}
