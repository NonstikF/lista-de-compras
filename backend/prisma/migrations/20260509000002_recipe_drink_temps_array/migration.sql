-- Rename drinkTemp to drinkTemps and change to JSON array string
ALTER TABLE "Recipe" RENAME COLUMN "drinkTemp" TO "drinkTemps";
ALTER TABLE "Recipe" ALTER COLUMN "drinkTemps" SET DEFAULT '[]';
UPDATE "Recipe" SET "drinkTemps" = '[]' WHERE "drinkTemps" IS NULL;
UPDATE "Recipe" SET "drinkTemps" = '["' || "drinkTemps" || '"]' WHERE "drinkTemps" != '[]' AND "drinkTemps" IS NOT NULL;
ALTER TABLE "Recipe" ALTER COLUMN "drinkTemps" SET NOT NULL;
