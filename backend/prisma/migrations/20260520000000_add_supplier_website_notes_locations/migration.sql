-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "website" TEXT NOT NULL DEFAULT '',
                       ADD COLUMN "notes" TEXT NOT NULL DEFAULT '',
                       ADD COLUMN "locations" TEXT NOT NULL DEFAULT '[]';
