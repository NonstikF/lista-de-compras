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

// Which articles have a picture, and where it lives. Postgres answers without
// the blob ever leaving the database.
//
// Articles imported from WooCommerce store a plain https link instead of a
// data URI. Those are sent as-is: going through the image route meant a 302
// to another site, and on phones the pictures stopped loading after the hop.
// Only base64 pictures are served by routes/articleImages.ts.
export type ArticleImageSources = Map<string, string | null>;

export async function articleImageSources(ids: string[]): Promise<ArticleImageSources> {
    if (ids.length === 0) return new Map();
    const rows = await prisma.$queryRaw<{ id: string; external: string | null }[]>`
        SELECT "id", CASE WHEN "image" ~ '^https?://' THEN "image" END AS "external"
        FROM "Article"
        WHERE "id" IN (${Prisma.join(ids)})
          AND "image" IS NOT NULL AND "image" <> ''
    `;
    return new Map(rows.map(r => [r.id, r.external]));
}

// The URL to send for an article's picture, or null when it has none.
export function articleImageUrl(article: ArticleRef, sources: ArticleImageSources): string | null {
    if (!sources.has(article.id)) return null;
    return sources.get(article.id) ?? articleImagePath(article);
}

// Swaps updatedAt for an `image` URL (null when the article has no picture).
export function withImageUrl<T extends ArticleRef>(article: T, sources: ArticleImageSources): Omit<T, 'updatedAt'> & { image: string | null } {
    const { updatedAt: _updatedAt, ...rest } = article;
    return { ...rest, image: articleImageUrl(article, sources) };
}
