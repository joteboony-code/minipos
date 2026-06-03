import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["OWNER"]);
    const { id } = await params;
    const body = await request.json();
    const closingCash = Number(body.closingCash);
    if (!Number.isFinite(closingCash) || closingCash < 0) {
      return NextResponse.json({ error: "จำนวนเงินปิดกะต้องมากกว่าหรือเท่ากับ 0" }, { status: 400 });
    }

    const shift = await prisma.cashShift.findUnique({ where: { id } });
    if (!shift) return NextResponse.json({ error: "ไม่พบกะนี้" }, { status: 404 });
    if (shift.status !== "OPEN") return NextResponse.json({ error: "กะนี้ปิดแล้ว" }, { status: 409 });

    const closedAt = new Date();
    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: shift.openedAt, lt: closedAt } }
    });

    const cashSalesTotal = sales.filter((s) => s.paymentMethod === "CASH").reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const transferSalesTotal = sales.filter((s) => s.paymentMethod === "TRANSFER").reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const creditSalesTotal = sales.filter((s) => s.paymentMethod === "CREDIT").reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const totalSales = cashSalesTotal + transferSalesTotal + creditSalesTotal;
    const expectedCash = Number(shift.openingCash) + cashSalesTotal;

    const closed = await prisma.cashShift.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt,
        closingCash: new Prisma.Decimal(closingCash),
        expectedCash: new Prisma.Decimal(expectedCash),
        cashSalesTotal: new Prisma.Decimal(cashSalesTotal),
        transferSalesTotal: new Prisma.Decimal(transferSalesTotal),
        creditSalesTotal: new Prisma.Decimal(creditSalesTotal),
        totalSales: new Prisma.Decimal(totalSales),
        billCount: sales.length,
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null
      }
    });

    return NextResponse.json(closed);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ปิดกะไม่สำเร็จ" }, { status: 400 });
  }
}
