-- CreateTable
CREATE TABLE "SupplierTicket" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierTicket_supplierId_idx" ON "SupplierTicket"("supplierId");

-- AddForeignKey
ALTER TABLE "SupplierTicket" ADD CONSTRAINT "SupplierTicket_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
