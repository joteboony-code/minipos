-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('SALE', 'RECEIVE', 'ADJUST');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "salePrice" DECIMAL(10,2) NOT NULL,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'ชิ้น',
    "lowStockAlertQty" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Product_costPrice_non_negative" CHECK ("costPrice" >= 0),
    CONSTRAINT "Product_salePrice_non_negative" CHECK ("salePrice" >= 0),
    CONSTRAINT "Product_stockQty_non_negative" CHECK ("stockQty" >= 0),
    CONSTRAINT "Product_lowStockAlertQty_non_negative" CHECK ("lowStockAlertQty" >= 0),
    CONSTRAINT "Product_barcode_not_blank" CHECK (length(btrim("barcode")) > 0),
    CONSTRAINT "Product_name_not_blank" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "Product_unit_not_blank" CHECK (length(btrim("unit")) > 0)
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "grossProfit" DECIMAL(10,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "cashReceived" DECIMAL(10,2),
    "changeAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Sale_totalAmount_non_negative" CHECK ("totalAmount" >= 0),
    CONSTRAINT "Sale_totalCost_non_negative" CHECK ("totalCost" >= 0),
    CONSTRAINT "Sale_cashReceived_non_negative" CHECK ("cashReceived" IS NULL OR "cashReceived" >= 0),
    CONSTRAINT "Sale_changeAmount_non_negative" CHECK ("changeAmount" IS NULL OR "changeAmount" >= 0),
    CONSTRAINT "Sale_cash_fields_match_payment" CHECK (
        ("paymentMethod" = 'CASH' AND "cashReceived" IS NOT NULL AND "changeAmount" IS NOT NULL AND "cashReceived" >= "totalAmount")
        OR
        ("paymentMethod" = 'TRANSFER' AND "cashReceived" IS NULL AND "changeAmount" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "barcodeSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "lineProfit" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SaleItem_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "SaleItem_unitPrice_non_negative" CHECK ("unitPrice" >= 0),
    CONSTRAINT "SaleItem_costPrice_non_negative" CHECK ("costPrice" >= 0),
    CONSTRAINT "SaleItem_lineTotal_non_negative" CHECK ("lineTotal" >= 0),
    CONSTRAINT "SaleItem_productNameSnapshot_not_blank" CHECK (length(btrim("productNameSnapshot")) > 0),
    CONSTRAINT "SaleItem_barcodeSnapshot_not_blank" CHECK (length(btrim("barcodeSnapshot")) > 0)
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "beforeQty" INTEGER NOT NULL,
    "afterQty" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StockMovement_beforeQty_non_negative" CHECK ("beforeQty" >= 0),
    CONSTRAINT "StockMovement_afterQty_non_negative" CHECK ("afterQty" >= 0),
    CONSTRAINT "StockMovement_quantity_matches" CHECK ("afterQty" = "beforeQty" + "quantityChange"),
    CONSTRAINT "StockMovement_type_sign_matches" CHECK (
        ("type" = 'SALE' AND "quantityChange" < 0)
        OR
        ("type" = 'RECEIVE' AND "quantityChange" > 0)
        OR
        ("type" = 'ADJUST' AND "quantityChange" <> 0)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_receiptNo_key" ON "Sale"("receiptNo");

-- CreateIndex
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
