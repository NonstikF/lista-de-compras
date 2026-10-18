import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Recipe sheet photos are stored as base64 data URIs and served from here so
// GET /api/recipes only carries their URLs.
//
// Mounted before authenticateToken, like routes/articleImages.ts: an <img src>
// cannot send an Authorization header. Photo ids are cuids, so they are not
// enumerable, and a photo never changes once stored (edits create a new one),
// so it is cached as immutable.

const router = Router();

const DATA_URI = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/;

router.get('/:id/image', async (req: Request, res: Response) => {
    try {
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');

        const photo = await prisma.recipePhoto.findUnique({
            where: { id: req.params.id },
            select: { image: true },
        });
        const match = photo ? DATA_URI.exec(photo.image) : null;
        if (!match) {
            res.status(404).json({ error: 'Foto no encontrada' });
            return;
        }

        const [, mimeType, base64] = match;
        res.set({
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Content-Type': mimeType,
        });
        res.send(Buffer.from(base64, 'base64'));
    } catch (err) {
        console.error('Error al servir foto de receta:', err);
        res.status(500).json({ error: 'Error al servir foto' });
    }
});

export default router;
