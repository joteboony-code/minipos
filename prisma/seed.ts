import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = ["เครื่องดื่ม", "ขนม", "บะหมี่กึ่งสำเร็จรูป", "ของใช้ประจำวัน"];

const products = [
  { barcode: "8850001000011", name: "โค้ก 500ml", category: "เครื่องดื่ม", costPrice: 14, salePrice: 20, stockQty: 24, unit: "ขวด" },
  { barcode: "8850001000028", name: "น้ำเปล่า 600ml", category: "เครื่องดื่ม", costPrice: 5, salePrice: 10, stockQty: 48, unit: "ขวด" },
  { barcode: "8850001000035", name: "เลย์", category: "ขนม", costPrice: 13, salePrice: 20, stockQty: 18, unit: "ซอง" },
  { barcode: "8850001000042", name: "มาม่า", category: "บะหมี่กึ่งสำเร็จรูป", costPrice: 5.5, salePrice: 8, stockQty: 36, unit: "ซอง" },
  { barcode: "8850001000059", name: "นมกล่อง", category: "เครื่องดื่ม", costPrice: 9, salePrice: 14, stockQty: 20, unit: "กล่อง" },
  { barcode: "8850001000066", name: "กาแฟกระป๋อง", category: "เครื่องดื่ม", costPrice: 11, salePrice: 18, stockQty: 16, unit: "กระป๋อง" }
];

async function main() {
  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  for (const item of products) {
    const category = await prisma.category.findUniqueOrThrow({ where: { name: item.category } });
    await prisma.product.upsert({
      where: { barcode: item.barcode },
      update: {
        name: item.name,
        categoryId: category.id,
        costPrice: item.costPrice,
        salePrice: item.salePrice,
        stockQty: item.stockQty,
        unit: item.unit,
        lowStockAlertQty: 5,
        isActive: true
      },
      create: {
        barcode: item.barcode,
        name: item.name,
        categoryId: category.id,
        costPrice: item.costPrice,
        salePrice: item.salePrice,
        stockQty: item.stockQty,
        unit: item.unit,
        lowStockAlertQty: 5
      }
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
