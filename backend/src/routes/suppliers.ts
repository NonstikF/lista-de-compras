import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const supplierSchema = z.object({
    name: z.string().min(1, 'Nombre requerido'),
    contact: z.string().default(''),
    phone: z.string().default(''),
});

const ticketSchema = z.object({
    filename: z.string().min(1, 'Nombre de archivo requerido'),
    mimeType: z.string().refine(
        v => ['image/jpeg', 'image/png', 'application/pdf'].includes(v),
        { message: 'Tipo de archivo no permitido. Usa JPG, PNG o PDF.' }
    ),
    size: z.number().int().min(1).max(1_000_000, 'El archivo no puede superar 1 MB'),
    content: z.string().min(1, 'Contenido requerido'),
});

// ---- Suppliers CRUD ----

router.get('/', async (_req: Request, res: Response) => {
    try {
        const suppliers = await prisma.supplier.findMany({ orderBy: { createdAt: 'asc' } });
        res.json(suppliers);
    } catch (err) {
        console.error('Error al obtener proveedores:', err);
        res.status(500).json({ error: 'Error al obtener proveedores' });
    }
});

router.post('/', async (req: Request, res: Response) => {
    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const supplier = await prisma.supplier.create({ data: parsed.data });
        res.status(201).json(supplier);
    } catch (err) {
        console.error('Error al crear proveedor:', err);
        res.status(500).json({ error: 'Error al crear proveedor' });
    }
});

router.put('/:id', async (req: Request, res: Response) => {
    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: parsed.data });
        res.json(supplier);
    } catch (err) {
        console.error('Error al actualizar proveedor:', err);
        res.status(500).json({ error: 'Error al actualizar proveedor' });
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await prisma.supplier.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        console.error('Error al eliminar proveedor:', err);
        res.status(500).json({ error: 'Error al eliminar proveedor' });
    }
});

// ---- Supplier Tickets ----

router.get('/:id/tickets', async (req: Request, res: Response) => {
    try {
        const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id }, select: { id: true } });
        if (!supplier) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }
        const tickets = await prisma.supplierTicket.findMany({
            where: { supplierId: req.params.id },
            select: { id: true, supplierId: true, filename: true, mimeType: true, size: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(tickets);
    } catch (err) {
        console.error('Error al obtener tickets:', err);
        res.status(500).json({ error: 'Error al obtener tickets' });
    }
});

router.get('/:id/tickets/:ticketId', async (req: Request, res: Response) => {
    try {
        const ticket = await prisma.supplierTicket.findFirst({
            where: { id: req.params.ticketId, supplierId: req.params.id },
        });
        if (!ticket) { res.status(404).json({ error: 'Ticket no encontrado' }); return; }
        res.json(ticket);
    } catch (err) {
        console.error('Error al obtener ticket:', err);
        res.status(500).json({ error: 'Error al obtener ticket' });
    }
});

router.post('/:id/tickets', async (req: Request, res: Response) => {
    const parsed = ticketSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id }, select: { id: true } });
        if (!supplier) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }
        const ticket = await prisma.supplierTicket.create({
            data: { supplierId: req.params.id, ...parsed.data },
        });
        res.status(201).json(ticket);
    } catch (err) {
        console.error('Error al crear ticket:', err);
        res.status(500).json({ error: 'Error al crear ticket' });
    }
});

router.delete('/:id/tickets/:ticketId', async (req: Request, res: Response) => {
    try {
        await prisma.supplierTicket.delete({ where: { id: req.params.ticketId } });
        res.json({ success: true });
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
            res.status(404).json({ error: 'Ticket no encontrado' }); return;
        }
        console.error('Error al eliminar ticket:', err);
        res.status(500).json({ error: 'Error al eliminar ticket' });
    }
});

export default router;
