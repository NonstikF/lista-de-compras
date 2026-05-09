-- Add recipeType and drinkTemp to Recipe
ALTER TABLE "Recipe" ADD COLUMN "recipeType" TEXT NOT NULL DEFAULT 'alimento';
ALTER TABLE "Recipe" ADD COLUMN "drinkTemp" TEXT;

-- Create RecipeSizeVariant table
CREATE TABLE "RecipeSizeVariant" (
    "id"       SERIAL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "size"     TEXT NOT NULL,
    CONSTRAINT "RecipeSizeVariant_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create RecipeSizeIngredient table
CREATE TABLE "RecipeSizeIngredient" (
    "id"        SERIAL PRIMARY KEY,
    "variantId" INTEGER NOT NULL,
    "name"      TEXT NOT NULL,
    "quantity"  TEXT NOT NULL,
    "unit"      TEXT NOT NULL,
    CONSTRAINT "RecipeSizeIngredient_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "RecipeSizeVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
