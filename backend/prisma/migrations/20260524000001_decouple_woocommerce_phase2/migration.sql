-- Phase 2: cleanup tras correr archive-woo.ts.
-- IMPORTANTE: NO aplicar antes de ejecutar `npm run archive-woo` en backend.
-- Cualquier OrderTicket.orderId que NO mapee a StoreOrder.id sera eliminado por la FK CASCADE.

-- Limpiar tickets huerfanos (orderId no apunta a ningun StoreOrder.id).
-- Comentar este DELETE si quieres preservar huerfanos en otra tabla antes de borrar.
DELETE FROM "OrderTicket"
WHERE "orderId" NOT IN (SELECT "id" FROM "StoreOrder");

-- Agregar FK OrderTicket.orderId -> StoreOrder.id
ALTER TABLE "OrderTicket"
  ADD CONSTRAINT "OrderTicket_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "StoreOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop tablas PurchaseStatus (datos ya consolidados en StoreOrderItem por archive-woo.ts).
DROP TABLE IF EXISTS "PurchaseStatusBySupplier";
DROP TABLE IF EXISTS "PurchaseStatus";
