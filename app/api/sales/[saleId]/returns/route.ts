import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ReturnInput = { saleItemId: string; quantity: number };

function parseItems(value: unknown): ReturnInput[] {
  if (!Array.isArray(value)) throw new Error("กรุณาเลือกรายการคืนสินค้า");
  const items = value
    .map((entry) => {
      const raw = entry as Partial<ReturnInput>;
      return {
        saleItemId: typeof raw.saleItemId === "string" ? raw.saleItemId.trim() : "",
        quantity: Number(raw.quantity)
      };
    })
    .filter((item) => item.saleItemId && Number.isInteger(item.quantity) && item.quantity > 0);
  if (items.length === 0) throw new Error("กรุณาระบุจำนวนคืนสินค้า");
  return items;
}

function optionalReason(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function restoreBatchQuantities(
  allocations: Array<{ productBatchId: string; quantity: number }>,
  alreadyReturned: number,
  returnQty: number
) {
  const restores: Array<{ productBatchId: string; quantity: number }> = [];
  let skip = alreadyReturned;
  let remaining = returnQty;
  for (const allocation of allocations) {
    if (remaining <= 0) break;
    if (skip >= allocation.quantity) {
      skip -= allocation.quantity;
      continue;
    }
    const available = allocation.quantity - skip;
    const quantity = Math.min(available, remaining);
    restores.push({ productBatchId: allocation.productBatchId, quantity });
    remaining -= quantity;
    skip = 0;
  }
  return restores;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ saleId: string }> }) {
  try {
    const session = await requireRole(["OWNER"]);
    const { saleId } = await params;
    const body = await request.json();
    const requestedItems = parseItems(body.items);
    const reason = optionalReason(body.reason);

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          items: { include: { itemBatches: { orderBy: { createdAt: "asc" } } } }
        }
      });
      if (!sale) throw new Error("ไม่พบบิลนี้");
      if (sale.status === "VOIDED") throw new Error("บิลนี้ถูกยกเลิกแล้ว");

      const saleItemIds = sale.items.map((item) => item.id);
      const existingReturns = await tx.saleReturnItem.findMany({
        where: { saleItemId: { in: saleItemIds } }
      });
      const returnedByItem = new Map<string, number>();
      for (const item of existingReturns) {
        returnedByItem.set(item.saleItemId, (returnedByItem.get(item.saleItemId) ?? 0) + item.quantity);
      }

      const saleReturn = await tx.saleReturn.create({
        data: { saleId: sale.id, reason }
      });

      let totalRefund = new Prisma.Decimal(0);
      let totalReturnedQty = 0;
      for (const requested of requestedItems) {
        const saleItem = sale.items.find((item) => item.id === requested.saleItemId);
        if (!saleItem) throw new Error("รายการคืนสินค้าไม่ถูกต้อง");

        const alreadyReturned = returnedByItem.get(saleItem.id) ?? 0;
        const remainingReturnable = saleItem.quantity - alreadyReturned;
        if (requested.quantity > remainingReturnable) throw new Error(`${saleItem.productNameSnapshot} คืนเกินจำนวนที่ขาย`);

        const refundAmount = saleItem.unitPrice.mul(requested.quantity).toDecimalPlaces(2);
        totalRefund = totalRefund.add(refundAmount);
        totalReturnedQty += requested.quantity;

        await tx.saleReturnItem.create({
          data: {
            saleReturnId: saleReturn.id,
            saleItemId: saleItem.id,
            productId: saleItem.productId,
            quantity: requested.quantity,
            refundAmount
          }
        });

        const batchRestores = restoreBatchQuantities(
          saleItem.itemBatches.map((batch) => ({ productBatchId: batch.productBatchId, quantity: batch.quantity })),
          alreadyReturned,
          requested.quantity
        );
        for (const restore of batchRestores) {
          await tx.productBatch.update({
            where: { id: restore.productBatchId },
            data: { remainingQty: { increment: restore.quantity } }
          });
        }

        const product = await tx.product.findUniqueOrThrow({ where: { id: saleItem.productId } });
        const beforeQty = product.stockQty;
        const afterQty = beforeQty + requested.quantity;
        await tx.product.update({
          where: { id: saleItem.productId },
          data: { stockQty: afterQty }
        });
        await tx.stockMovement.create({
          data: {
            productId: saleItem.productId,
            type: "ADJUST",
            quantityChange: requested.quantity,
            beforeQty,
            afterQty,
            note: `คืนสินค้า ${sale.receiptNo}`
          }
        });
      }

      const totalSoldQty = sale.items.reduce((sum, item) => sum + item.quantity, 0);
      const totalReturnedAfter = existingReturns.reduce((sum, item) => sum + item.quantity, 0) + totalReturnedQty;
      const status = totalReturnedAfter >= totalSoldQty ? "RETURNED_PARTIAL" : "RETURNED_PARTIAL";
      await tx.sale.update({ where: { id: sale.id }, data: { status } });

      return {
        saleReturnId: saleReturn.id,
        receiptNo: sale.receiptNo,
        totalRefund,
        totalReturnedQty
      };
    }, { maxWait: 5000, timeout: 15000 });

    await recordAuditLog({
      actorRole: session.role,
      action: "SALE_RETURNED",
      entityType: "Sale",
      entityId: saleId,
      description: result.receiptNo,
      metadata: {
        saleReturnId: result.saleReturnId,
        totalRefund: Number(result.totalRefund),
        totalReturnedQty: result.totalReturnedQty,
        reason
      }
    });

    return NextResponse.json({
      ok: true,
      saleReturnId: result.saleReturnId,
      totalRefund: Number(result.totalRefund),
      totalReturnedQty: result.totalReturnedQty
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "คืนสินค้าไม่สำเร็จ" }, { status: 400 });
  }
}
