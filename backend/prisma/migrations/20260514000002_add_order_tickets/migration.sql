-- CreateTable
CREATE TABLE "OrderTicket" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "supplierName" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderTicket_orderId_idx" ON "OrderTicket"("orderId");

-- CreateIndex
CREATE INDEX "OrderTicket_orderId_supplierName_idx" ON "OrderTicket"("orderId", "supplierName");
