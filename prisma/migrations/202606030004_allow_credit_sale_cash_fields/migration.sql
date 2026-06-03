ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_cash_fields_match_payment";

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cash_fields_match_payment" CHECK (
    ("paymentMethod" = 'CASH' AND "cashReceived" IS NOT NULL AND "changeAmount" IS NOT NULL AND "cashReceived" >= "totalAmount")
    OR
    ("paymentMethod" = 'TRANSFER' AND "cashReceived" IS NULL AND "changeAmount" IS NULL)
    OR
    ("paymentMethod" = 'CREDIT' AND "cashReceived" IS NULL AND "changeAmount" = 0)
);
