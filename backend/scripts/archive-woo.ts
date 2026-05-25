/**
 * archive-woo.ts — one-shot snapshot de WooCommerce a la DB local.
 *
 * Lee TODOS los pedidos de WooCommerce (cualquier estado), los inserta en
 * StoreOrder/StoreOrderItem con marcas legacy, repunta OrderTicket.orderId
 * (que apuntaba al ID Woo) al nuevo StoreOrder.id, y consolida
 * PurchaseStatus / PurchaseStatusBySupplier dentro de StoreOrderItem.
 *
 * Requisitos:
 *   - Variables WOO_URL, WOO_KEY, WOO_SECRET y DATABASE_URL configuradas.
 *   - Migracion phase1 ya aplicada (columnas legacy* presentes).
 *
 * Ejecutar:
 *   cd backend
 *   DATABASE_URL=postgres://... WOO_URL=https://... WOO_KEY=... WOO_SECRET=... \
 *     npx ts-node scripts/archive-woo.ts
 *
 * Modo dry-run:
 *   ARCHIVE_DRY_RUN=1 npx ts-node scripts/archive-woo.ts
 *
 * Idempotente: si encuentra StoreOrder con legacyWooOrderId existente, lo salta.
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.env.ARCHIVE_DRY_RUN === '1';

interface WooLineItem {
    id: number;
    name: string;
    product_id: number;
    quantity: number;
    sku?: string;
    total?: string;
    image?: { src: string };
}

interface WooOrder {
    id: number;
    date_created: string;
    status: string;
    total: string;
    billing: { first_name: string; last_name: string; phone?: string };
    customer_note?: string;
    line_items: WooLineItem[];
}

async function fetchAllWooOrders(): Promise<WooOrder[]> {
    const { WOO_URL, WOO_KEY, WOO_SECRET } = process.env;
    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        throw new Error('WOO_URL, WOO_KEY, WOO_SECRET requeridos');
    }
    const all: WooOrder[] = [];
    let page = 1;
    const perPage = 100;
    while (true) {
        const res = await axios.get<WooOrder[]>(`${WOO_URL}/wp-json/wc/v3/orders`, {
            auth: { username: WOO_KEY, password: WOO_SECRET },
            params: { status: 'any', per_page: perPage, page, orderby: 'date', order: 'asc' },
            timeout: 30000,
        });
        all.push(...res.data);
        console.log(`  pagina ${page}: ${res.data.length} pedidos (acum ${all.length})`);
        if (res.data.length < perPage) break;
        page += 1;
    }
    return all;
}

interface ArchiveStats {
    ordersScanned: number;
    ordersCreated: number;
    ordersSkipped: number;
    itemsCreated: number;
    ticketsRepointed: number;
    ticketsOrphan: number;
    purchaseStatusApplied: number;
}

async function archive(): Promise<ArchiveStats> {
    const stats: ArchiveStats = {
        ordersScanned: 0,
        ordersCreated: 0,
        ordersSkipped: 0,
        itemsCreated: 0,
        ticketsRepointed: 0,
        ticketsOrphan: 0,
        purchaseStatusApplied: 0,
    };

    console.log('Descargando pedidos Woo...');
    const wooOrders = await fetchAllWooOrders();
    stats.ordersScanned = wooOrders.length;
    console.log(`Total pedidos Woo: ${wooOrders.length}`);

    // Mapa wooOrderId -> nuevo StoreOrder.id (incluye orders ya archivados antes).
    const wooToStoreId = new Map<number, number>();

    for (const wo of wooOrders) {
        const existing = await prisma.storeOrder.findUnique({
            where: { legacyWooOrderId: wo.id },
            select: { id: true },
        });
        if (existing) {
            wooToStoreId.set(wo.id, existing.id);
            stats.ordersSkipped += 1;
            continue;
        }

        if (DRY_RUN) {
            console.log(`  [DRY] crearia StoreOrder para Woo#${wo.id}`);
            stats.ordersCreated += 1;
            stats.itemsCreated += wo.line_items.length;
            continue;
        }

        // Map Woo status -> StoreOrder status (pending|completed solo).
        const statusMap: Record<string, string> = {
            completed: 'completed',
            processing: 'pending',
            'on-hold': 'pending',
            pending: 'pending',
            cancelled: 'completed',
            refunded: 'completed',
            failed: 'completed',
        };

        const created = await prisma.storeOrder.create({
            data: {
                legacyWooOrderId: wo.id,
                legacySource: 'woocommerce',
                dateCreated: new Date(wo.date_created),
                status: statusMap[wo.status] ?? 'completed',
                customerName: `${wo.billing.first_name ?? ''} ${wo.billing.last_name ?? ''}`.trim() || 'Cliente Woo',
                customerPhone: wo.billing.phone ?? '',
                notes: wo.customer_note ?? '',
                total: Number.parseFloat(wo.total) || 0,
                items: {
                    create: wo.line_items.map(li => ({
                        legacyWooLineItemId: li.id,
                        articleId: '',
                        name: li.name,
                        price: li.quantity > 0 ? (Number.parseFloat(li.total ?? '0') / li.quantity) : 0,
                        qty: li.quantity,
                        imageUrl: li.image?.src ?? null,
                        supplierName: 'Sin proveedor',
                    })),
                },
            },
            include: { items: true },
        });

        // Relink articleId by Article.legacyWooProductId (best effort).
        for (let i = 0; i < wo.line_items.length; i += 1) {
            const li = wo.line_items[i];
            const item = created.items[i];
            if (!li.product_id) continue;
            const art = await prisma.article.findUnique({
                where: { legacyWooProductId: li.product_id },
                select: { id: true, image: true },
            });
            if (art) {
                await prisma.storeOrderItem.update({
                    where: { id: item.id },
                    data: { articleId: art.id, imageUrl: item.imageUrl ?? art.image },
                });
            }
        }

        wooToStoreId.set(wo.id, created.id);
        stats.ordersCreated += 1;
        stats.itemsCreated += created.items.length;
    }

    // ----- Consolidar PurchaseStatus -----
    // Usamos queryRaw porque el modelo Prisma se elimina en migracion phase2.
    // Tolerante: si la tabla ya no existe (phase2 aplicado), saltamos.
    console.log('Consolidando PurchaseStatus en StoreOrderItem...');
    type PurchaseRow = { lineItemId: number; orderId: number; isPurchased: boolean; quantityPurchased: number };
    let purchaseRows: PurchaseRow[] = [];
    try {
        purchaseRows = await prisma.$queryRawUnsafe<PurchaseRow[]>(
            'SELECT "lineItemId", "orderId", "isPurchased", "quantityPurchased" FROM "PurchaseStatus"'
        );
    } catch {
        console.log('  tabla PurchaseStatus no existe (phase2 ya aplicado), salto');
    }
    for (const ps of purchaseRows) {
        const newOrderId = wooToStoreId.get(ps.orderId);
        if (!newOrderId) continue;
        const item = await prisma.storeOrderItem.findUnique({
            where: { legacyWooLineItemId: ps.lineItemId },
            select: { id: true },
        });
        if (!item) continue;
        if (DRY_RUN) { stats.purchaseStatusApplied += 1; continue; }
        await prisma.storeOrderItem.update({
            where: { id: item.id },
            data: { isPurchased: ps.isPurchased, quantityPurchased: ps.quantityPurchased },
        });
        stats.purchaseStatusApplied += 1;
    }

    // ----- Repointar OrderTicket.orderId -----
    console.log('Repointando OrderTicket.orderId...');
    const tickets = await prisma.orderTicket.findMany({ select: { id: true, orderId: true } });
    for (const t of tickets) {
        // Si orderId ya coincide con un StoreOrder.id nativo, saltar.
        const isAlreadyNative = await prisma.storeOrder.findUnique({
            where: { id: t.orderId },
            select: { id: true },
        });
        if (isAlreadyNative) continue;

        const newOrderId = wooToStoreId.get(t.orderId);
        if (!newOrderId) {
            stats.ticketsOrphan += 1;
            console.warn(`  ticket ${t.id} huerfano (orderId=${t.orderId} no mapea)`);
            continue;
        }
        if (DRY_RUN) { stats.ticketsRepointed += 1; continue; }
        await prisma.orderTicket.update({
            where: { id: t.id },
            data: { orderId: newOrderId },
        });
        stats.ticketsRepointed += 1;
    }

    return stats;
}

async function main() {
    console.log(`=== archive-woo.ts ${DRY_RUN ? '(DRY RUN)' : ''} ===`);
    const t0 = Date.now();
    try {
        const stats = await archive();
        console.log('\n=== Resultado ===');
        console.log(JSON.stringify(stats, null, 2));
        console.log(`Tiempo: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(err => {
    console.error('ERROR fatal:', err);
    process.exit(1);
});
