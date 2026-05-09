-- CreateTable
CREATE TABLE "PurchaseStatusBySupplier" (
    "lineItemId" INTEGER NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseStatusBySupplier_pkey" PRIMARY KEY ("lineItemId","supplierId")
);

-- CreateIndex
CREATE INDEX "PurchaseStatusBySupplier_lineItemId_idx" ON "PurchaseStatusBySupplier"("lineItemId");

-- CreateIndex
CREATE INDEX "PurchaseStatusBySupplier_orderId_idx" ON "PurchaseStatusBySupplier"("orderId");
