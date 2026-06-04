import { NextRequest, NextResponse } from "next/server";
import { recordAuditLogForCurrentSession } from "@/lib/audit";
import { parseProductInput, serializeProduct } from "@/lib/product";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const product = await prisma.product.update({
      where: { id },
      data: parseProductInput(body),
      include: { category: true }
    });

    await recordAuditLogForCurrentSession({
      action: "PRODUCT_UPDATED",
      entityType: "Product",
      entityId: product.id,
      description: product.name,
      metadata: { barcode: product.barcode }
    });

    return NextResponse.json(serializeProduct(product));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "บันทึกสินค้าไม่สำเร็จ" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const product = await prisma.product.update({
      where: { id },
      data: { isActive: Boolean(body.isActive) },
      include: { category: true }
    });

    await recordAuditLogForCurrentSession({
      action: "PRODUCT_UPDATED",
      entityType: "Product",
      entityId: product.id,
      description: product.name,
      metadata: { barcode: product.barcode, isActive: product.isActive }
    });

    return NextResponse.json(serializeProduct(product));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "บันทึกสินค้าไม่สำเร็จ" }, { status: 400 });
  }
}
