import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireRole(["OWNER"]);
    const [lowStock, outOfStock] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, stockQty: { gt: 0 } },
        orderBy: { stockQty: "asc" }
      }),
      prisma.product.findMany({
        where: { isActive: true, stockQty: { lte: 0 } },
        orderBy: { name: "asc" }
      })
    ]);

    return NextResponse.json({
      lowStock: lowStock
        .filter((product) => product.stockQty <= product.lowStockAlertQty)
        .map((product) => ({
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          stockQty: product.stockQty,
          lowStockAlertQty: product.lowStockAlertQty,
          unit: product.unit
        })),
      outOfStock: outOfStock.map((product) => ({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        stockQty: product.stockQty,
        lowStockAlertQty: product.lowStockAlertQty,
        unit: product.unit
      }))
    });
  } catch {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
  }
}
