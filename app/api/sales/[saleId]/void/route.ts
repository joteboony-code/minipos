import { NextRequest, NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function optionalReason(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ saleId: string }> }) {
  try {
    const session = await requireRole(["OWNER"]);
    const { saleId } = await params;
    const body = await request.json();
    const reason = optionalReason(body.reason);

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          items: { include: { itemBatches: true, product: true } },
          returns: { select: { id: true }, take: 1 },
          creditPayments: true
        }
      });
      if (!sale) throw new Error("เนเธกเนเธเธเธเธดเธฅเธเธตเน");
      if (sale.status === "VOIDED") throw new Error("เธเธดเธฅเธเธตเนเธ–เธนเธเธขเธเน€เธฅเธดเธเนเธฅเนเธง");
      if (sale.returns.length > 0) throw new Error("บิลนี้มีการคืนสินค้าแล้ว ไม่สามารถยกเลิกทั้งบิลได้");
      if (sale.creditPayments.length > 0) throw new Error("เธเธดเธฅเธเธตเนเธกเธตเธเธฒเธฃเธฃเธฑเธเธเธณเธฃเธฐเน€เธเธดเธเน€เธเธทเนเธญเนเธฅเนเธง เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธขเธเน€เธฅเธดเธเนเธ”เน");

      const closedShift = await tx.cashShift.findFirst({
        where: {
          status: "CLOSED",
          openedAt: { lte: sale.createdAt },
          closedAt: { gte: sale.createdAt }
        }
      });
      if (closedShift) throw new Error("เธเธดเธฅเธเธตเนเธญเธขเธนเนเนเธเธเธฐเธ—เธตเนเธเธดเธ”เนเธฅเนเธง เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธขเธเน€เธฅเธดเธเนเธ”เน");

      for (const item of sale.items) {
        for (const batch of item.itemBatches) {
          await tx.productBatch.update({
            where: { id: batch.productBatchId },
            data: { remainingQty: { increment: batch.quantity } }
          });
        }

        const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
        const beforeQty = product.stockQty;
        const afterQty = beforeQty + item.quantity;
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: afterQty }
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "ADJUST",
            quantityChange: item.quantity,
            beforeQty,
            afterQty,
            note: `เธขเธเน€เธฅเธดเธเธเธดเธฅ ${sale.receiptNo}`
          }
        });
      }

      return tx.sale.update({
        where: { id: sale.id },
        data: {
          status: "VOIDED",
          voidedAt: new Date(),
          voidReason: reason,
          voidedByRole: session.role
        }
      });
    }, { maxWait: 5000, timeout: 15000 });

    await recordAuditLog({
      actorRole: session.role,
      action: "SALE_VOIDED",
      entityType: "Sale",
      entityId: result.id,
      description: result.receiptNo,
      metadata: { reason }
    });

    return NextResponse.json({ ok: true, sale: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "เธขเธเน€เธฅเธดเธเธเธดเธฅเนเธกเนเธชเธณเน€เธฃเนเธ" }, { status: 400 });
  }
}

