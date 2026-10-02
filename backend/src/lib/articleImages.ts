import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

// Article images are base64 data URIs in the database. Inlining them made
// every article list tens of megabytes, so payloads carry a URL to
// routes/articleImages.ts instead. updatedAt busts the browser cache when the
// picture changes.

// The article fields other payloads embed. `image` holds the base64 blob and is
// deliberately left out; withImageUrl() puts a URL in its place.
export const articleSummarySelect = { id: true, name: true, category: true, updatedAt: true } as const;

type ArticleRef = { id: string; updatedAt: Date };

export function articleImagePath(article: ArticleRef): string {
    return `/api/articles/${article.id}/image?v=${article.updatedAt.getTime()}`;
}

// A URL that points back at an article's own image route. The edit form sends
// the article's image back as-is, and saving it would overwrite the picture
// with its own link.
export function isArticleImageUrl(value: string): boolean {
    return /\/api\/articles\/[^/]+\/image(\?|$)/.test(value);
}

// Asks Postgres which articles have a picture without reading the blob.
export async function articleIdsWithImage(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Article"
        WHERE "id" IN (${Prisma.join(ids)})
          AND "image" IS NOT NULL AND "image" <> ''
    `;
    return new Set(rows.map(r => r.id));
}

// Swaps updatedAt for an `image` URL (null when the article has no picture).
export function withImageUrl<T extends ArticleRef>(article: T, withImage: Set<string>): Omit<T, 'updatedAt'> & { image: string | null } {
    const { updatedAt: _updatedAt, ...rest } = article;
    return { ...rest, image: withImage.has(article.id) ? articleImagePath(article) : null };
}
