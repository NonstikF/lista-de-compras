import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const supplierSchema = z.object({
    name: z.string().min(1, 'Nombre requerido'),
    contact: z.string().default(''),
    phone: z.string().default(''),
    zones: z.array(z.string().min(1)).max(10, 'Máximo 10 zonas').default([]),
    website: z.string().default(''),
    notes: z.string().default(''),
    locations: z.array(z.string().min(1)).max(10, 'Máximo 10 ubicaciones').default([]),
});

const ticketSchema = z.object({
    filename: z.string().min(1, 'Nombre de archivo requerido'),
    mimeType: z.string().refine(
        v => ['image/jpeg', 'image/png', 'application/pdf'].includes(v),
        { message: 'Tipo de archivo no permitido. Usa JPG, PNG o PDF.' }
    ),
    size: z.number().int().min(1).max(1_000_000, 'El archivo no puede superar 1 MB'),
    content: z.string().min(1, 'Contenido requerido'),
    orderRef: z.string().default(''),
});

// ---- Suppliers CRUD ----

function formatSupplier(s: { id: string; name: string; contact: string; phone: string; zones: string; website: string; notes: string; locations: string; createdAt: Date }) {
    return {
        id: s.id,
        name: s.name,
        contact: s.contact,
        phone: s.phone,
        zones: (() => { try { return JSON.parse(s.zones); } catch { return []; } })(),
        website: s.website,
        notes: s.notes,
        locations: (() => { try { return JSON.parse(s.locations); } catch { return []; } })(),
        createdAt: s.createdAt,
    };
}

router.get('/', async (_req: Request, res: Response) => {
    try {
        const suppliers = await prisma.supplier.findMany({ orderBy: { createdAt: 'asc' } });
        res.json(suppliers.map(formatSupplier));
    } catch (err) {
        console.error('Error al obtener proveedores:', err);
        res.status(500).json({ error: 'Error al obtener proveedores' });
    }
});

router.post('/', async (req: Request, res: Response) => {
    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const { zones, locations, ...rest } = parsed.data;
        const supplier = await prisma.supplier.create({ data: { ...rest, zones: JSON.stringify(zones), locations: JSON.stringify(locations) } });
        res.status(201).json(formatSupplier(supplier));
    } catch (err) {
        console.error('Error al crear proveedor:', err);
        res.status(500).json({ error: 'Error al crear proveedor' });
    }
});

router.put('/:id', async (req: Request, res: Response) => {
    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    try {
        const { zones, locations, ...rest } = parsed.data;
        const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: { ...rest, zones: JSON.stringify(zones), locations: JSON.stringify(locations) } });
        res.json(formatSupplier(supplier));
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
            select: { id: true, supplierId: true, orderRef: true, invoiced: true, filename: true, mimeType: true, size: true, createdAt: true },
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
            select: { id: true, supplierId: true, orderRef: true, invoiced: true, filename: true, mimeType: true, size: true, createdAt: true },
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

// GET /api/suppliers/:id/order-tickets — OrderTickets que coinciden por nombre de proveedor
router.get('/:id/order-tickets', async (req: Request, res: Response) => {
    try {
        const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id }, select: { id: true, name: true } });
        if (!supplier) { res.status(404).json({ error: 'Proveedor no encontrado' }); return; }
        const tickets = await prisma.orderTicket.findMany({
            where: { supplierName: supplier.name },
            select: { id: true, orderId: true, supplierName: true, filename: true, mimeType: true, size: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(tickets);
    } catch (err) {
        console.error('Error al obtener order-tickets de proveedor:', err);
        res.status(500).json({ error: 'Error al obtener tickets de pedidos' });
    }
});

router.patch('/:id/tickets/:ticketId', async (req: Request, res: Response) => {
    const parsed = z.object({ invoiced: z.boolean() }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invoiced debe ser boolean' }); return; }
    try {
        const ticket = await prisma.supplierTicket.update({
            where: { id: req.params.ticketId },
            data: { invoiced: parsed.data.invoiced },
            select: { id: true, supplierId: true, orderRef: true, invoiced: true, filename: true, mimeType: true, size: true, createdAt: true },
        });
        res.json(ticket);
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
            res.status(404).json({ error: 'Ticket no encontrado' }); return;
        }
        console.error('Error al actualizar ticket:', err);
        res.status(500).json({ error: 'Error al actualizar ticket' });
    }
});

export default router;
