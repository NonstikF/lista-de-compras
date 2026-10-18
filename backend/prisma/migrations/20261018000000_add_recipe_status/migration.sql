-- Recipe status, menu category and notes so the catalog can list every menu
-- product, including the ones that still have no recipe.
ALTER TABLE "Recipe" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'completa';
ALTER TABLE "Recipe" ADD COLUMN "menuCategory" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Recipe" ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';
