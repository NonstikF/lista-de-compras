-- Add zones array to Supplier (stored as JSON string)
ALTER TABLE "Supplier" ADD COLUMN "zones" TEXT NOT NULL DEFAULT '[]';

-- Add zone to ArticleSupplier junction
ALTER TABLE "ArticleSupplier" ADD COLUMN "zone" TEXT NOT NULL DEFAULT '';
