-- Bring the migration history in line with schema.prisma.
--
-- These changes reached production outside a migration (the database already
-- has them), so a database rebuilt from migrations alone was missing
-- StoreOrderItem.supplierId and creating a store order failed. Every statement
-- is a no-op where the change already exists, so this is safe to apply to
-- production as well as to a fresh database.

ALTER TABLE "StoreOrderItem" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

CREATE INDEX IF NOT EXISTS "StoreOrderItem_orderId_articleId_idx" ON "StoreOrderItem"("orderId", "articleId");

-- 20260509000003 added "temp" with DEFAULT 'caliente'; the schema has no default.
ALTER TABLE "RecipeSizeVariant" ALTER COLUMN "temp" DROP DEFAULT;
