const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

interface CachedProduct {
    category: string;
    imageUrl: string | null;
    cachedAt: number;
}

const cache = new Map<number, CachedProduct>();

export function getCachedProduct(productId: number): { category: string; imageUrl: string | null } | null {
    const cached = cache.get(productId);
    if (!cached) return null;
    if (Date.now() - cached.cachedAt > CACHE_TTL) {
        cache.delete(productId);
        return null;
    }
    return { category: cached.category, imageUrl: cached.imageUrl };
}

export function setCachedProduct(productId: number, category: string, imageUrl: string | null): void {
    cache.set(productId, { category, imageUrl, cachedAt: Date.now() });
}
