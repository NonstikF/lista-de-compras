-- Add temp column to RecipeSizeVariant
ALTER TABLE "RecipeSizeVariant" ADD COLUMN "temp" TEXT NOT NULL DEFAULT 'caliente';
