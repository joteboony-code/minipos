import { NextRequest, NextResponse } from "next/server";
import { recordAuditLogForCurrentSession } from "@/lib/audit";
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
    const unitCost = body.unitCost === undefined || body.unitCost === "" ? null : Number(body.unitCost);

    if (!productId || !Number.isInteger(quantity) || quantity === 0) {
      return NextResponse.json({ error: "กรุณาระบุสินค้าและจำนวนให้ถูกต้อง" }, { status: 400 });
    }
    if (type === "RECEIVE" && quantity <= 0) {
      return NextResponse.json({ error: "จำนวนรับเข้าต้องมากกว่า 0" }, { status: 400 });
    }
    if (type === "RECEIVE" && (unitCost === null || !Number.isFinite(unitCost) || unitCost < 0)) {
      return NextResponse.json({ error: "ราคาทุนต่อหน่วยไม่ถูกต้อง" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      if (type === "RECEIVE" && !product.isActive) throw new Error("สินค้าถูกปิดการใช้งาน");
      const beforeQty = product.stockQty;
      const afterQty = type === "RECEIVE" ? beforeQty + Math.abs(quantity) : beforeQty + quantity;
      if (afterQty < 0) throw new Error("จำนวนสต็อกต้องไม่ติดลบ");

      const updated = await tx.product.updateMany({
        where: { id: productId, stockQty: beforeQty },
        data: {
          stockQty: afterQty,
          ...(type === "RECEIVE" && unitCost !== null ? { costPrice: unitCost } : {})
        }
      });
      if (updated.count !== 1) throw new Error("สต็อกมีการเปลี่ยนแปลง กรุณาลองใหม่");

      if (type === "RECEIVE" && unitCost !== null) {
        await tx.productBatch.create({
          data: {
            productId,
            receivedQty: Math.abs(quantity),
            remainingQty: Math.abs(quantity),
            unitCost,
            note: body.note || null
          }
        });
      }
      if (type === "ADJUST" && afterQty > beforeQty) {
        await tx.productBatch.create({
          data: {
            productId,
            receivedQty: afterQty - beforeQty,
            remainingQty: afterQty - beforeQty,
            unitCost: product.costPrice,
            note: body.note || "ปรับยอดเพิ่ม"
          }
        });
      }
      if (type === "ADJUST" && afterQty < beforeQty) {
        let remainingToReduce = beforeQty - afterQty;
        const batches = await tx.productBatch.findMany({
          where: { productId, remainingQty: { gt: 0 } },
          orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
        });
        for (const batch of batches) {
          if (remainingToReduce <= 0) break;
          const reducedQty = Math.min(batch.remainingQty, remainingToReduce);
          const updatedBatch = await tx.productBatch.updateMany({
            where: { id: batch.id, remainingQty: batch.remainingQty },
            data: { remainingQty: { decrement: reducedQty } }
          });
          if (updatedBatch.count !== 1) throw new Error("ล็อตสินค้าเปลี่ยนแปลง กรุณาลองใหม่");
          remainingToReduce -= reducedQty;
        }
        if (remainingToReduce > 0) throw new Error("ล็อตสินค้าไม่พอสำหรับการปรับยอด กรุณาตั้งล็อตยอดยกมา");
      }

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

    await recordAuditLogForCurrentSession({
      action: type === "RECEIVE" ? "STOCK_RECEIVED" : "STOCK_ADJUSTED",
      entityType: "Product",
      entityId: productId,
      description: result.product.name,
      metadata: {
        type,
        quantityChange: result.quantityChange,
        beforeQty: result.beforeQty,
        afterQty: result.afterQty,
        note: result.note
      }
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดฐานข้อมูล" }, { status: 400 });
  }
}
