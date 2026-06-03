import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireRole(["OWNER"]);
    const batches = await prisma.productBatch.findMany({
      include: { product: true },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      take: 200
    });

    return NextResponse.json(
      batches.map((batch) => ({
        ...batch,
        unitCost: Number(batch.unitCost),
        product: {
          id: batch.product.id,
          name: batch.product.name,
          barcode: batch.product.barcode,
          unit: batch.product.unit
        }
      }))
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ไม่สามารถโหลดล็อตสินค้าได้" }, { status: 403 });
  }
}
