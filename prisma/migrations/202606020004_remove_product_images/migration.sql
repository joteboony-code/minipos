ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_imageUrl_allowed_format";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "imageUrl";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "imageAlt";
