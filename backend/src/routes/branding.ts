import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';

// Company name and logo for the app chrome (sidebar header). Every user sees
// them, not only those with the `settings` permission, so this router is
// mounted before authenticateToken. It exposes nothing beyond what the sidebar
// already shows. The logo is a base64 data URI in CompanySettings; it is served
// as an image by URL so the ~0.5 MB blob is fetched once and cached.

const router = Router();

const DATA_URI = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/;

router.get('/', async (_req: Request, res: Response) => {
    try {
        const settings = await prisma.companySettings.findUnique({
            where: { id: 1 },
            select: { name: true, updatedAt: true },
        });
        // Ask whether a logo exists without reading it.
        const [{ hasLogo }] = await prisma.$queryRaw<{ hasLogo: boolean }[]>`
            SELECT EXISTS (SELECT 1 FROM "CompanySettings" WHERE "id" = 1 AND "logo" IS NOT NULL AND "logo" <> '') AS "hasLogo"
        `;
        res.json({
            name: settings?.name ?? '',
            logoUrl: hasLogo && settings ? `/api/branding/logo?v=${settings.updatedAt.getTime()}` : null,
        });
    } catch (err) {
        console.error('Error al obtener branding:', err);
        res.status(500).json({ error: 'Error al obtener datos de la empresa' });
    }
});

router.get('/logo', async (req: Request, res: Response) => {
    try {
        // Same reasoning as routes/articleImages.ts: helmet defaults CORP to
        // same-origin, which would block the frontend's own domain.
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        const settings = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { logo: true } });
        const match = settings?.logo ? DATA_URI.exec(settings.logo) : null;
        if (!match) { res.status(404).json({ error: 'Sin logotipo' }); return; }

        const [, mimeType, base64] = match;
        const etag = `W/"${createHash('sha1').update(settings!.logo!).digest('hex')}"`;
        res.set({ 'Cache-Control': 'public, max-age=31536000, immutable', ETag: etag });
        if (req.headers['if-none-match'] === etag) { res.status(304).end(); return; }

        res.set('Content-Type', mimeType);
        res.send(Buffer.from(base64, 'base64'));
    } catch (err) {
        console.error('Error al servir logotipo:', err);
        res.status(500).json({ error: 'Error al servir logotipo' });
    }
});

export default router;
