import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const category = await prisma.category.update({ where: { id }, data: { name: body.name } });
  return NextResponse.json(category);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const used = await prisma.product.count({ where: { categoryId: id } });
  if (used > 0) {
    return NextResponse.json({ error: "ไม่สามารถลบหมวดหมู่ที่มีสินค้าใช้งานอยู่" }, { status: 400 });
  }
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
