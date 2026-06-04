import { NextRequest, NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["OWNER"]);
    const body = await request.json();
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    const countedQty = Number(body.countedQty);
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "ปรับสต๊อกจากการนับ";
    if (!productId || !Number.isInteger(countedQty) || countedQty < 0) {
      throw new Error("กรุณาระบุสินค้าและจำนวนที่นับได้ให้ถูกต้อง");
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      const beforeQty = product.stockQty;
      const difference = countedQty - beforeQty;
      if (difference === 0) {
        return { product, beforeQty, afterQty: countedQty, difference, movementId: null as string | null };
      }

      if (difference > 0) {
        await tx.productBatch.create({
          data: {
            productId,
            receivedQty: difference,
            remainingQty: difference,
            unitCost: product.costPrice,
            note: "ปรับสต๊อกจากการนับ"
          }
        });
      } else {
        let remainingToReduce = Math.abs(difference);
        const batches = await tx.productBatch.findMany({
          where: { productId, remainingQty: { gt: 0 } },
          orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }]
        });
        for (const batch of batches) {
          if (remainingToReduce <= 0) break;
          const reducedQty = Math.min(batch.remainingQty, remainingToReduce);
          await tx.productBatch.update({
            where: { id: batch.id },
            data: { remainingQty: { decrement: reducedQty } }
          });
          remainingToReduce -= reducedQty;
        }
        if (remainingToReduce > 0) throw new Error("ล็อตสินค้าไม่พอสำหรับการปรับยอด กรุณาตั้งล็อตยอดยกมา");
      }

      await tx.product.update({
        where: { id: productId },
        data: { stockQty: countedQty }
      });
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          type: "ADJUST",
          quantityChange: difference,
          beforeQty,
          afterQty: countedQty,
          note: reason
        }
      });
      return { product, beforeQty, afterQty: countedQty, difference, movementId: movement.id };
    });

    await recordAuditLog({
      actorRole: session.role,
      action: "STOCK_COUNT_ADJUSTED",
      entityType: "Product",
      entityId: productId,
      description: result.product.name,
      metadata: {
        beforeQty: result.beforeQty,
        afterQty: result.afterQty,
        difference: result.difference,
        movementId: result.movementId,
        reason
      }
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "บันทึกนับสต๊อกไม่สำเร็จ" }, { status: 400 });
  }
}
