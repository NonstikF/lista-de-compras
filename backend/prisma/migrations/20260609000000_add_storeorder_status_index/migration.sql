-- Speeds up pending/completed store order queries (was full-table scan).
CREATE INDEX "StoreOrder_status_dateCreated_idx" ON "StoreOrder"("status", "dateCreated");
