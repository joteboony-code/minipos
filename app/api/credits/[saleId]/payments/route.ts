import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { recordAuditLogForCurrentSession } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseAmount(value: unknown) {
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(String(value));
  } catch {
    throw new Error("จำนวนเงินไม่ถูกต้อง");
  }
  if (amount.isNaN() || amount.lte(0)) throw new Error("จำนวนเงินไม่ถูกต้อง");
  return amount.toDecimalPlaces(2);
}

function creditStatus(paid: Prisma.Decimal, due: Prisma.Decimal) {
  if (paid.gte(due)) return "PAID";
  if (paid.gt(0)) return "PARTIAL";
  return "UNPAID";
}

function serializePayment(payment: { id: string; saleId: string; amount: Prisma.Decimal; note: string | null; createdAt: Date }) {
  return {
    ...payment,
    amount: Number(payment.amount),
    createdAt: payment.createdAt.toISOString()
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ saleId: string }> }) {
  try {
    await requireRole(["OWNER"]);
    const { saleId } = await params;
    const payments = await prisma.creditPayment.findMany({
      where: { saleId },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(payments.map(serializePayment));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ไม่สามารถโหลดประวัติชำระเงินได้" }, { status: 403 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ saleId: string }> }) {
  try {
    await requireRole(["OWNER"]);
    const { saleId } = await params;
    const body = await request.json();
    const amount = parseAmount(body.amount);
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id: saleId } });
      if (!sale) throw new Error("ไม่พบบิลเงินเชื่อ");
      if (sale.paymentMethod !== "CREDIT") throw new Error("บิลนี้ไม่ใช่เงินเชื่อ");

      const due = new Prisma.Decimal(sale.creditDueAmount ?? sale.totalAmount);
      const paid = new Prisma.Decimal(sale.creditPaidAmount ?? 0);
      const remaining = due.sub(paid);
      if (amount.gt(remaining)) throw new Error("จำนวนเงินเกินยอดค้างชำระ");

      const nextPaid = paid.add(amount);
      const nextStatus = creditStatus(nextPaid, due);
      const payment = await tx.creditPayment.create({
        data: { saleId, amount, note }
      });
      const updated = await tx.sale.updateMany({
        where: { id: saleId, creditPaidAmount: sale.creditPaidAmount },
        data: {
          creditPaidAmount: nextPaid,
          creditStatus: nextStatus
        }
      });
      if (updated.count !== 1) throw new Error("ยอดเงินเชื่อมีการเปลี่ยนแปลง กรุณาลองใหม่");
      const updatedSale = await tx.sale.findUniqueOrThrow({ where: { id: saleId } });

      return {
        payment,
        sale: updatedSale,
        remainingAmount: due.sub(nextPaid),
        creditStatus: nextStatus
      };
    });

    await recordAuditLogForCurrentSession({
      action: "CREDIT_PAYMENT_CREATED",
      entityType: "Sale",
      entityId: saleId,
      description: result.sale.receiptNo,
      metadata: {
        paymentId: result.payment.id,
        amount: Number(result.payment.amount),
        creditStatus: result.creditStatus,
        remainingAmount: Number(result.remainingAmount)
      }
    });

    return NextResponse.json({
      payment: serializePayment(result.payment),
      sale: {
        ...result.sale,
        totalAmount: Number(result.sale.totalAmount),
        totalCost: Number(result.sale.totalCost),
        grossProfit: Number(result.sale.grossProfit),
        cashReceived: result.sale.cashReceived === null ? null : Number(result.sale.cashReceived),
        changeAmount: result.sale.changeAmount === null ? null : Number(result.sale.changeAmount),
        creditDueAmount: result.sale.creditDueAmount === null ? null : Number(result.sale.creditDueAmount),
        creditPaidAmount: result.sale.creditPaidAmount === null ? null : Number(result.sale.creditPaidAmount)
      },
      remainingAmount: Number(result.remainingAmount),
      creditStatus: result.creditStatus
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "บันทึกรับชำระไม่สำเร็จ" }, { status: 400 });
  }
}
