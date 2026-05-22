import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// GET /api/settings — get company settings (upsert singleton)
router.get('/', async (_req: Request, res: Response) => {
    try {
        const settings = await prisma.companySettings.upsert({
            where: { id: 1 },
            update: {},
            create: { id: 1, name: '', logo: null },
        });
        res.json(settings);
    } catch (err) {
        console.error('Error fetching settings:', err);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

// PUT /api/settings — update company settings
router.put('/', async (req: Request, res: Response) => {
    try {
        const { name, logo } = req.body;
        const settings = await prisma.companySettings.upsert({
            where: { id: 1 },
            update: {
                ...(name !== undefined && { name }),
                ...(logo !== undefined && { logo }),
            },
            create: { id: 1, name: name ?? '', logo: logo ?? null },
        });
        res.json(settings);
    } catch (err) {
        console.error('Error updating settings:', err);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
});

export default router;
