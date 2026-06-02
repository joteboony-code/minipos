import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function todayRange() {
  const now = new Date();
  const bangkokDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const start = new Date(`${bangkokDate}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function GET() {
  const { start, end } = todayRange();
  const [aggregate, billCount, products, recentSales] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: { gte: start, lt: end } },
      _sum: { totalAmount: true, grossProfit: true }
    }),
    prisma.sale.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { stockQty: true, lowStockAlertQty: true }
    }),
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { items: true }
    })
  ]);

  return NextResponse.json({
    totalSales: Number(aggregate._sum.totalAmount ?? 0),
    billCount,
    grossProfit: Number(aggregate._sum.grossProfit ?? 0),
    lowStockCount: products.filter((product) => product.stockQty <= product.lowStockAlertQty).length,
    recentSales: recentSales.map((sale) => ({
      ...sale,
      totalAmount: Number(sale.totalAmount),
      grossProfit: Number(sale.grossProfit),
      itemCount: sale.items.reduce((sum, item) => sum + item.quantity, 0)
    }))
  });
}
