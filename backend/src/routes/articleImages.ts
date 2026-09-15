import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';

// Article images are stored as base64 data URIs. Embedding them in every order
// payload made those responses huge and uncacheable, so they are served from
// here instead and referenced by URL.
//
// This router is mounted before authenticateToken: an <img src> cannot send an
// Authorization header. Article ids are cuids, so they are not enumerable, and
// the response carries nothing but the picture itself.

const router = Router();

const DATA_URI = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/;

router.get('/:id/image', async (req: Request, res: Response) => {
    try {
        const article = await prisma.article.findUnique({
            where: { id: req.params.id },
            select: { image: true, updatedAt: true },
        });

        if (!article?.image) {
            res.status(404).json({ error: 'Imagen no encontrada' });
            return;
        }

        const match = DATA_URI.exec(article.image);
        if (!match) {
            // Already a plain URL (legacy Woo import) — send the client there.
            if (/^https?:\/\//.test(article.image)) {
                res.redirect(302, article.image);
                return;
            }
            res.status(404).json({ error: 'Imagen no encontrada' });
            return;
        }

        const [, mimeType, base64] = match;
        const etag = `W/"${createHash('sha1').update(article.image).digest('hex')}"`;

        // helmet() defaults this to same-origin, which would stop the frontend
        // on its own domain from loading the image. Set on every response,
        // including the 304, or a revalidation would be blocked.
        res.set({
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Cross-Origin-Resource-Policy': 'cross-origin',
            ETag: etag,
        });

        if (req.headers['if-none-match'] === etag) {
            res.status(304).end();
            return;
        }

        res.set('Content-Type', mimeType);
        res.send(Buffer.from(base64, 'base64'));
    } catch (err) {
        console.error('Error al servir imagen de articulo:', err);
        res.status(500).json({ error: 'Error al servir imagen' });
    }
});

export default router;
