-- Add orderRef and invoiced fields to SupplierTicket
ALTER TABLE "SupplierTicket" ADD COLUMN "orderRef" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SupplierTicket" ADD COLUMN "invoiced" BOOLEAN NOT NULL DEFAULT false;
