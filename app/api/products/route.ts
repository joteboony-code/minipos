import { NextRequest, NextResponse } from "next/server";
import { parseProductInput, serializeProduct } from "@/lib/product";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search")?.trim();
  const barcode = request.nextUrl.searchParams.get("barcode")?.trim();
  const categoryId = request.nextUrl.searchParams.get("categoryId")?.trim();
  const quickSale = request.nextUrl.searchParams.get("quickSale") === "true";

  const products = await prisma.product.findMany({
    where: {
      ...(barcode ? { barcode } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(quickSale ? { isActive: true, isQuickSale: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { barcode: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: { category: true },
    orderBy: quickSale ? { name: "asc" } : { updatedAt: "desc" },
    take: barcode ? 1 : 100
  });

  return NextResponse.json(products.map(serializeProduct));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const product = await prisma.product.create({
      data: parseProductInput(body),
      include: { category: true }
    });

    return NextResponse.json(serializeProduct(product), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "บันทึกสินค้าไม่สำเร็จ" }, { status: 400 });
  }
}
