import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const timestampFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function timestamp() {
  const parts = Object.fromEntries(timestampFormatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}

function csvValue(value: unknown) {
  if (value === null || value === undefined) return "\"\"";
  return `"${String(value).replaceAll("\"", "\"\"")}"`;
}

function csvResponse(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

function jsonResponse(filename: string, data: unknown) {
  return NextResponse.json(data, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(["OWNER"]);
    const type = request.nextUrl.searchParams.get("type") ?? "full";
    const stamp = timestamp();

    if (type === "products") {
      const products = await prisma.product.findMany({
        include: { category: true },
        orderBy: { name: "asc" }
      });

      return csvResponse(
        `products-${stamp}.csv`,
        ["บาร์โค้ด", "ชื่อสินค้า", "หมวดหมู่", "ราคาทุน", "ราคาขาย", "สต๊อก", "หน่วย", "แจ้งเตือนใกล้หมด", "เปิดใช้งาน", "ปุ่มขายด่วน"],
        products.map((product) => [
          product.barcode,
          product.name,
          product.category?.name ?? "",
          product.costPrice.toString(),
          product.salePrice.toString(),
          product.stockQty,
          product.unit,
          product.lowStockAlertQty,
          product.isActive ? "ใช่" : "ไม่",
          product.isQuickSale ? "ใช่" : "ไม่"
        ])
      );
    }

    if (type === "sales") {
      const sales = await prisma.sale.findMany({
        include: { items: true },
        orderBy: { createdAt: "desc" }
      });

      return csvResponse(
        `sales-${stamp}.csv`,
        ["เลขที่บิล", "วันที่/เวลา", "ยอดรวม", "ต้นทุนรวม", "กำไรขั้นต้น", "วิธีชำระเงิน", "รับเงิน", "เงินทอน", "จำนวนสินค้า"],
        sales.map((sale) => [
          sale.receiptNo,
          sale.createdAt.toISOString(),
          sale.totalAmount.toString(),
          sale.totalCost.toString(),
          sale.grossProfit.toString(),
          sale.paymentMethod,
          sale.cashReceived?.toString() ?? "",
          sale.changeAmount?.toString() ?? "",
          sale.items.reduce((sum, item) => sum + item.quantity, 0)
        ])
      );
    }

    if (type === "stock") {
      const movements = await prisma.stockMovement.findMany({
        include: { product: true },
        orderBy: { createdAt: "desc" }
      });

      return csvResponse(
        `stock-movements-${stamp}.csv`,
        ["วันที่/เวลา", "ชื่อสินค้า", "บาร์โค้ด", "ประเภท", "จำนวนเปลี่ยนแปลง", "ก่อน", "หลัง", "หมายเหตุ"],
        movements.map((movement) => [
          movement.createdAt.toISOString(),
          movement.product.name,
          movement.product.barcode,
          movement.type,
          movement.quantityChange,
          movement.beforeQty,
          movement.afterQty,
          movement.note ?? ""
        ])
      );
    }

    const [categories, products, sales, saleItems, stockMovements] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.product.findMany({ orderBy: { name: "asc" } }),
      prisma.sale.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.saleItem.findMany({ orderBy: { id: "asc" } }),
      prisma.stockMovement.findMany({ orderBy: { createdAt: "desc" } })
    ]);

    return jsonResponse(`minimart-pos-backup-${stamp}.json`, {
      exportedAt: new Date().toISOString(),
      categories,
      products,
      sales,
      saleItems,
      stockMovements
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ไม่สามารถส่งออกข้อมูลได้" }, { status: 403 });
  }
}
