CREATE TABLE "CreditPayment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CreditPayment_amount_positive" CHECK ("amount" > 0)
);

CREATE INDEX "CreditPayment_saleId_idx" ON "CreditPayment"("saleId");
CREATE INDEX "CreditPayment_createdAt_idx" ON "CreditPayment"("createdAt");

ALTER TABLE "CreditPayment" ADD CONSTRAINT "CreditPayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
