-- CreateTable
CREATE TABLE "ProductBatch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "receivedQty" INTEGER NOT NULL,
    "remainingQty" INTEGER NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductBatch_receivedQty_positive" CHECK ("receivedQty" > 0),
    CONSTRAINT "ProductBatch_remainingQty_non_negative" CHECK ("remainingQty" >= 0),
    CONSTRAINT "ProductBatch_remainingQty_not_over_receivedQty" CHECK ("remainingQty" <= "receivedQty"),
    CONSTRAINT "ProductBatch_unitCost_non_negative" CHECK ("unitCost" >= 0)
);

-- CreateTable
CREATE TABLE "SaleItemBatch" (
    "id" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "productBatchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleItemBatch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SaleItemBatch_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "SaleItemBatch_unitCost_non_negative" CHECK ("unitCost" >= 0),
    CONSTRAINT "SaleItemBatch_totalCost_non_negative" CHECK ("totalCost" >= 0)
);

-- CreateIndex
CREATE INDEX "ProductBatch_productId_receivedAt_idx" ON "ProductBatch"("productId", "receivedAt");

-- CreateIndex
CREATE INDEX "ProductBatch_productId_remainingQty_idx" ON "ProductBatch"("productId", "remainingQty");

-- CreateIndex
CREATE INDEX "ProductBatch_receivedAt_idx" ON "ProductBatch"("receivedAt");

-- CreateIndex
CREATE INDEX "SaleItemBatch_saleItemId_idx" ON "SaleItemBatch"("saleItemId");

-- CreateIndex
CREATE INDEX "SaleItemBatch_productBatchId_idx" ON "SaleItemBatch"("productBatchId");

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItemBatch" ADD CONSTRAINT "SaleItemBatch_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItemBatch" ADD CONSTRAINT "SaleItemBatch_productBatchId_fkey" FOREIGN KEY ("productBatchId") REFERENCES "ProductBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
