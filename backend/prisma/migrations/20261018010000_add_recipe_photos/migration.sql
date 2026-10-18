-- Photos of the handwritten recipe sheets, several per recipe.
CREATE TABLE "RecipePhoto" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "image" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipePhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecipePhoto_recipeId_idx" ON "RecipePhoto"("recipeId");

ALTER TABLE "RecipePhoto" ADD CONSTRAINT "RecipePhoto_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
