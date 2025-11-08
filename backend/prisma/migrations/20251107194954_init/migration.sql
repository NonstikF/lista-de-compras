-- CreateTable
CREATE TABLE "PurchaseStatus" (
    "id" SERIAL NOT NULL,
    "lineItemId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "isPurchased" BOOLEAN NOT NULL DEFAULT false,
    "quantityPurchased" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseStatus_lineItemId_key" ON "PurchaseStatus"("lineItemId");
