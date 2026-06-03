import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { stockQty: { gt: 0 } },
    include: { productBatches: { take: 1 } },
    orderBy: { name: "asc" }
  });

  let createdCount = 0;
  let skippedCount = 0;

  for (const product of products) {
    if (product.productBatches.length > 0) {
      skippedCount += 1;
      continue;
    }

    await prisma.productBatch.create({
      data: {
        productId: product.id,
        receivedQty: product.stockQty,
        remainingQty: product.stockQty,
        unitCost: product.costPrice,
        note: "ยอดยกมาตั้งต้น"
      }
    });
    createdCount += 1;
  }

  console.log(`Opening batches created: ${createdCount}`);
  console.log(`Products skipped because they already have batches: ${skippedCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
