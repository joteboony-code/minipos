-- CreateTable
CREATE TABLE "CashShift" (
    "id" TEXT NOT NULL,
    "openedByRole" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingCash" DECIMAL(10,2) NOT NULL,
    "closingCash" DECIMAL(10,2),
    "expectedCash" DECIMAL(10,2),
    "cashSalesTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "transferSalesTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "creditSalesTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalSales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "billCount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashShift_status_idx" ON "CashShift"("status");

-- CreateIndex
CREATE INDEX "CashShift_openedAt_idx" ON "CashShift"("openedAt");
