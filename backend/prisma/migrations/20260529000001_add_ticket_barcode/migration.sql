-- Código de barras detectado del ticket (escaneado en el navegador)
ALTER TABLE "SupplierTicket" ADD COLUMN "barcode" TEXT NOT NULL DEFAULT '';
