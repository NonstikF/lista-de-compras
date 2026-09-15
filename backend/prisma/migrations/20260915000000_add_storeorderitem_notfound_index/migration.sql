-- Drives the pending-items lookup, which filters StoreOrderItem on notFound
-- and previously scanned every row in the table.
CREATE INDEX "StoreOrderItem_notFound_idx" ON "StoreOrderItem"("notFound");
