import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const movements = await prisma.stockMovement.findMany({
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return NextResponse.json(movements);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    const type = body.type === "ADJUST" ? "ADJUST" : "RECEIVE";
    const quantity = Number(body.quantity);

    if (!productId || !Number.isInteger(quantity) || quantity === 0) {
      return NextResponse.json({ error: "กรุณาระบุสินค้าและจำนวนให้ถูกต้อง" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      const beforeQty = product.stockQty;
      const afterQty = type === "RECEIVE" ? beforeQty + Math.abs(quantity) : beforeQty + quantity;
      if (afterQty < 0) throw new Error("จำนวนสต็อกต้องไม่ติดลบ");

      const updated = await tx.product.updateMany({
        where: { id: productId, stockQty: beforeQty },
        data: { stockQty: afterQty }
      });
      if (updated.count !== 1) throw new Error("สต็อกมีการเปลี่ยนแปลง กรุณาลองใหม่");

      return tx.stockMovement.create({
        data: {
          productId,
          type,
          quantityChange: afterQty - beforeQty,
          beforeQty,
          afterQty,
          note: body.note || null
        },
        include: { product: true }
      });
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดฐานข้อมูล" }, { status: 400 });
  }
}
