-- Add invoiced field to OrderTicket
ALTER TABLE "OrderTicket" ADD COLUMN "invoiced" BOOLEAN NOT NULL DEFAULT false;
