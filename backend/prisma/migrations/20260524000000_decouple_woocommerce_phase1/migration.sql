-- Phase 1: prepare schema for WooCommerce decoupling.
-- Safe to run with data present. Does NOT drop anything.

-- Article.wooProductId -> legacyWooProductId
ALTER TABLE "Article" RENAME COLUMN "wooProductId" TO "legacyWooProductId";
ALTER INDEX IF EXISTS "Article_wooProductId_key" RENAME TO "Article_legacyWooProductId_key";

-- StoreOrder: add legacy columns + index
ALTER TABLE "StoreOrder" ADD COLUMN "legacyWooOrderId" INTEGER;
ALTER TABLE "StoreOrder" ADD COLUMN "legacySource" TEXT;
CREATE UNIQUE INDEX "StoreOrder_legacyWooOrderId_key" ON "StoreOrder"("legacyWooOrderId");
CREATE INDEX "StoreOrder_legacyWooOrderId_idx" ON "StoreOrder"("legacyWooOrderId");

-- StoreOrderItem: add legacy column
ALTER TABLE "StoreOrderItem" ADD COLUMN "legacyWooLineItemId" INTEGER;
CREATE UNIQUE INDEX "StoreOrderItem_legacyWooLineItemId_key" ON "StoreOrderItem"("legacyWooLineItemId");

-- OrderTicket -> StoreOrder FK (optional; existing rows pointing to Woo IDs stay orphan until archive script runs).
-- Skipping FK constraint creation here because legacy rows would violate it.
-- Phase 2 (after archive-woo.ts repoints orderId values) will add the FK constraint:
--   ALTER TABLE "OrderTicket" ADD CONSTRAINT "OrderTicket_orderId_fkey"
--     FOREIGN KEY ("orderId") REFERENCES "StoreOrder"("id") ON DELETE CASCADE;
