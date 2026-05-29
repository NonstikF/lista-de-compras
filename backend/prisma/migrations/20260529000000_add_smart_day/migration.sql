-- Smart Day: regla de oferta recurrente por proveedor + marca por artículo
ALTER TABLE "Supplier" ADD COLUMN "smartDayEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Supplier" ADD COLUMN "smartDayWeekday" INTEGER;
ALTER TABLE "Supplier" ADD COLUMN "smartDayWeek" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "smartDayLeadDays" INTEGER NOT NULL DEFAULT 7;

ALTER TABLE "Article" ADD COLUMN "smartDay" BOOLEAN NOT NULL DEFAULT false;
