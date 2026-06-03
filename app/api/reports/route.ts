import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const todayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function rangeForBangkokDate(dateText: string) {
  const start = new Date(`${dateText}T00:00:00+07:00`);
  return { start, end: addDays(start, 1) };
}

function rangeForBangkokMonth(monthText: string) {
  const [year, month] = monthText.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) throw new Error("เดือนรายงานไม่ถูกต้อง");
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+07:00`);
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = new Date(`${endYear}-${String(endMonth).padStart(2, "0")}-01T00:00:00+07:00`);
  return { start, end };
}

async function summary(start: Date, end: Date) {
  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: { items: true },
    orderBy: { createdAt: "desc" }
  });

  const totals = sales.reduce(
    (sum, sale) => {
      sum.totalAmount = sum.totalAmount.add(sale.totalAmount);
      sum.grossProfit = sum.grossProfit.add(sale.grossProfit);
      if (sale.paymentMethod === "CASH") sum.cashTotal = sum.cashTotal.add(sale.totalAmount);
      if (sale.paymentMethod === "TRANSFER") sum.transferTotal = sum.transferTotal.add(sale.totalAmount);
      if (sale.paymentMethod === "CREDIT") sum.creditTotal = sum.creditTotal.add(sale.totalAmount);
      if (sale.paymentMethod === "CREDIT") {
        const due = new Prisma.Decimal(sale.creditDueAmount ?? sale.totalAmount);
        const paid = new Prisma.Decimal(sale.creditPaidAmount ?? 0);
        const remaining = due.sub(paid);
        sum.creditPaidTotal = sum.creditPaidTotal.add(paid);
        sum.creditOutstandingTotal = sum.creditOutstandingTotal.add(remaining.gt(0) ? remaining : new Prisma.Decimal(0));
        if (sale.creditStatus !== "PAID") sum.creditOpenBillCount += 1;
      }
      return sum;
    },
    {
      totalAmount: new Prisma.Decimal(0),
      grossProfit: new Prisma.Decimal(0),
      cashTotal: new Prisma.Decimal(0),
      transferTotal: new Prisma.Decimal(0),
      creditTotal: new Prisma.Decimal(0),
      creditPaidTotal: new Prisma.Decimal(0),
      creditOutstandingTotal: new Prisma.Decimal(0),
      creditOpenBillCount: 0
    }
  );

  const products = new Map<string, { name: string; barcode: string; quantity: number; totalAmount: Prisma.Decimal }>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const key = item.barcodeSnapshot || item.productNameSnapshot;
      const current = products.get(key) ?? {
        name: item.productNameSnapshot,
        barcode: item.barcodeSnapshot,
        quantity: 0,
        totalAmount: new Prisma.Decimal(0)
      };
      current.quantity += item.quantity;
      current.totalAmount = current.totalAmount.add(item.lineTotal);
      products.set(key, current);
    }
  }

  return {
    totalAmount: Number(totals.totalAmount),
    billCount: sales.length,
    grossProfit: Number(totals.grossProfit),
    cashTotal: Number(totals.cashTotal),
    transferTotal: Number(totals.transferTotal),
    creditTotal: Number(totals.creditTotal),
    creditPaidTotal: Number(totals.creditPaidTotal),
    creditOutstandingTotal: Number(totals.creditOutstandingTotal),
    creditOpenBillCount: totals.creditOpenBillCount,
    topProducts: [...products.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map((product) => ({ ...product, totalAmount: Number(product.totalAmount) })),
    recentSales: sales.slice(0, 10).map((sale) => ({
      id: sale.id,
      receiptNo: sale.receiptNo,
      totalAmount: Number(sale.totalAmount),
      paymentMethod: sale.paymentMethod,
      createdAt: sale.createdAt
    }))
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(["OWNER"]);
    const todayText = todayFormatter.format(new Date());
    const monthText = request.nextUrl.searchParams.get("month") ?? todayText.slice(0, 7);
    const todayRange = rangeForBangkokDate(todayText);
    const monthRange = rangeForBangkokMonth(monthText);

    const [today, month, lowStock, outOfStock] = await Promise.all([
      summary(todayRange.start, todayRange.end),
      summary(monthRange.start, monthRange.end),
      prisma.product.findMany({
        where: { isActive: true, stockQty: { gt: 0 } },
        orderBy: { stockQty: "asc" }
      }),
      prisma.product.findMany({
        where: { isActive: true, stockQty: 0 },
        orderBy: { name: "asc" },
        take: 20
      })
    ]);

    return NextResponse.json({
      today,
      month,
      monthText,
      lowStock: lowStock
        .filter((product) => product.stockQty <= product.lowStockAlertQty)
        .slice(0, 20)
        .map((product) => ({
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          stockQty: product.stockQty,
          lowStockAlertQty: product.lowStockAlertQty
        })),
      outOfStock: outOfStock.map((product) => ({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        stockQty: product.stockQty
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ไม่สามารถโหลดรายงานได้" }, { status: 403 });
  }
}
