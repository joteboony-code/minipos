ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CREDIT';

ALTER TABLE "Sale"
  ADD COLUMN "creditCustomerName" TEXT,
  ADD COLUMN "creditCustomerPhone" TEXT,
  ADD COLUMN "creditNote" TEXT,
  ADD COLUMN "creditDueAmount" DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN "creditPaidAmount" DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN "creditStatus" TEXT;

CREATE INDEX "Sale_paymentMethod_idx" ON "Sale"("paymentMethod");
CREATE INDEX "Sale_creditStatus_idx" ON "Sale"("creditStatus");
