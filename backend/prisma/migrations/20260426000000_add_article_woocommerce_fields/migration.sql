ALTER TABLE "Article" ADD COLUMN "wooProductId" INTEGER;
ALTER TABLE "Article" ADD COLUMN "sku" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "category" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "stockStatus" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX "Article_wooProductId_key" ON "Article"("wooProductId");
