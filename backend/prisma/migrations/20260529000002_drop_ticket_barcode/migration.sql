-- Revertir escaneo de código de barras: eliminar columna no usada
ALTER TABLE "SupplierTicket" DROP COLUMN "barcode";
