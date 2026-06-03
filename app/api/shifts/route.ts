import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireRole(["OWNER"]);
    const [currentShift, history] = await Promise.all([
      prisma.cashShift.findFirst({ where: { status: "OPEN" }, orderBy: { openedAt: "desc" } }),
      prisma.cashShift.findMany({ where: { status: "CLOSED" }, orderBy: { openedAt: "desc" }, take: 30 })
    ]);

    let runningTotals: {
      cashSalesTotal: number;
      transferSalesTotal: number;
      creditSalesTotal: number;
      totalSales: number;
      billCount: number;
      expectedCash: number;
    } | null = null;

    if (currentShift) {
      const sales = await prisma.sale.findMany({
        where: { createdAt: { gte: currentShift.openedAt } }
      });
      const cashSalesTotal = sales.filter((s) => s.paymentMethod === "CASH").reduce((sum, s) => sum + Number(s.totalAmount), 0);
      const transferSalesTotal = sales.filter((s) => s.paymentMethod === "TRANSFER").reduce((sum, s) => sum + Number(s.totalAmount), 0);
      const creditSalesTotal = sales.filter((s) => s.paymentMethod === "CREDIT").reduce((sum, s) => sum + Number(s.totalAmount), 0);
      runningTotals = {
        cashSalesTotal,
        transferSalesTotal,
        creditSalesTotal,
        totalSales: cashSalesTotal + transferSalesTotal + creditSalesTotal,
        billCount: sales.length,
        expectedCash: Number(currentShift.openingCash) + cashSalesTotal
      };
    }

    return NextResponse.json({ current: currentShift, runningTotals, history });
  } catch {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["OWNER"]);
    const body = await request.json();
    const openingCash = Number(body.openingCash);
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      return NextResponse.json({ error: "จำนวนเงินเปิดกะต้องมากกว่าหรือเท่ากับ 0" }, { status: 400 });
    }

    const existing = await prisma.cashShift.findFirst({ where: { status: "OPEN" } });
    if (existing) {
      return NextResponse.json({ error: "มีกะที่เปิดอยู่แล้ว กรุณาปิดกะก่อน" }, { status: 409 });
    }

    const shift = await prisma.cashShift.create({
      data: {
        openedByRole: session.role,
        openingCash: new Prisma.Decimal(openingCash),
        status: "OPEN"
      }
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "เปิดกะไม่สำเร็จ" }, { status: 400 });
  }
}
