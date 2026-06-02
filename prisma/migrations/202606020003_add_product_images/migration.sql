ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "imageAlt" TEXT;

ALTER TABLE "Product" ADD CONSTRAINT "Product_imageUrl_allowed_format"
CHECK (
  "imageUrl" IS NULL
  OR "imageUrl" = ''
  OR "imageUrl" LIKE 'http://%'
  OR "imageUrl" LIKE 'https://%'
  OR "imageUrl" LIKE '/%'
);
