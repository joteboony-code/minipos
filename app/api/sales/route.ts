import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CheckoutItem = { productId: string; quantity: number };
type PaymentMethodInput = "CASH" | "TRANSFER" | "CREDIT";

const receiptDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function receiptDatePart() {
  return receiptDateFormatter.format(new Date()).replaceAll("-", "");
}

async function nextReceiptNo(tx: { sale: typeof prisma.sale }) {
  const prefix = `POS-${receiptDatePart()}-`;
  const latest = await tx.sale.findFirst({
    where: { receiptNo: { startsWith: prefix } },
    orderBy: { receiptNo: "desc" }
  });
  const next = latest ? Number(latest.receiptNo.slice(-4)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function normalizeItems(rawItems: unknown): CheckoutItem[] {
  if (!Array.isArray(rawItems)) {
    throw new Error("ไม่มีสินค้าในตะกร้า");
  }

  const byProduct = new Map<string, number>();
  for (const raw of rawItems) {
    const item = raw as Partial<CheckoutItem>;
    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    const quantity = Number(item.quantity);

    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("จำนวนสินค้าไม่ถูกต้อง");
    }

    byProduct.set(productId, (byProduct.get(productId) ?? 0) + quantity);
  }

  const items = [...byProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  if (items.length === 0) {
    throw new Error("ไม่มีสินค้าในตะกร้า");
  }
  return items;
}

function parseCashReceived(value: unknown) {
  if (value === null || value === undefined || value === "") {
    throw new Error("กรุณาระบุเงินสดที่รับมา");
  }
  let cash: Prisma.Decimal;
  try {
    cash = new Prisma.Decimal(String(value));
  } catch {
    throw new Error("จำนวนเงินสดไม่ถูกต้อง");
  }
  if (cash.isNaN() || cash.isNegative()) {
    throw new Error("จำนวนเงินสดไม่ถูกต้อง");
  }
  return cash.toDecimalPlaces(2);
}

function parsePaymentMethod(value: unknown): PaymentMethodInput {
  if (value === "TRANSFER" || value === "CREDIT") return value;
  return "CASH";
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function createSale(body: unknown) {
  const checkout = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const items = normalizeItems(checkout.items);
  const paymentMethod = parsePaymentMethod(checkout.paymentMethod);
  const idempotencyKey = typeof checkout.idempotencyKey === "string" && checkout.idempotencyKey.trim() ? checkout.idempotencyKey.trim() : null;
  const creditCustomerName = optionalText(checkout.creditCustomerName);
  const creditCustomerPhone = optionalText(checkout.creditCustomerPhone);
  const creditNote = optionalText(checkout.creditNote);

  if (paymentMethod === "CREDIT" && !creditCustomerName) {
    throw new Error("กรุณาใส่ชื่อลูกค้าเงินเชื่อ");
  }

  return prisma.$transaction(async (tx) => {
    if (idempotencyKey) {
      const existing = await tx.sale.findUnique({
        where: { idempotencyKey },
        include: { items: true }
      });
      if (existing) return existing;
    }

    const products = await tx.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } }
    });

    const lines = items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) throw new Error("ไม่พบสินค้า");
      if (!product.isActive) throw new Error(`${product.name} ถูกปิดใช้งาน`);
      if (product.stockQty < item.quantity) throw new Error(`${product.name} มีสต็อกไม่พอ`);

      const unitPrice = product.salePrice;
      const costPrice = product.costPrice;
      const quantity = new Prisma.Decimal(item.quantity);
      const lineTotal = unitPrice.mul(quantity);
      const lineCost = costPrice.mul(quantity);

      return {
        product,
        quantity: item.quantity,
        unitPrice,
        costPrice,
        lineTotal,
        lineProfit: lineTotal.sub(lineCost)
      };
    });

    const totalAmount = lines.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));
    const totalCost = lines.reduce((sum, line) => sum.add(line.costPrice.mul(line.quantity)), new Prisma.Decimal(0));
    const grossProfit = totalAmount.sub(totalCost);
    const cashReceived = paymentMethod === "CASH" ? parseCashReceived(checkout.cashReceived) : null;
    const changeAmount = paymentMethod === "CASH" && cashReceived ? cashReceived.sub(totalAmount) : paymentMethod === "CREDIT" ? new Prisma.Decimal(0) : null;

    if (cashReceived && cashReceived.lessThan(totalAmount)) {
      throw new Error("เงินสดที่รับมาน้อยกว่ายอดรวม");
    }

    const receiptNo = await nextReceiptNo(tx);
    const created = await tx.sale.create({
      data: {
        receiptNo,
        totalAmount,
        totalCost,
        grossProfit,
        paymentMethod,
        cashReceived,
        changeAmount,
        creditCustomerName: paymentMethod === "CREDIT" ? creditCustomerName : null,
        creditCustomerPhone: paymentMethod === "CREDIT" ? creditCustomerPhone : null,
        creditNote: paymentMethod === "CREDIT" ? creditNote : null,
        creditDueAmount: paymentMethod === "CREDIT" ? totalAmount : new Prisma.Decimal(0),
        creditPaidAmount: new Prisma.Decimal(0),
        creditStatus: paymentMethod === "CREDIT" ? "UNPAID" : null,
        idempotencyKey,
        items: {
          create: lines.map((line) => ({
            productId: line.product.id,
            productNameSnapshot: line.product.name,
            barcodeSnapshot: line.product.barcode,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            costPrice: line.costPrice,
            lineTotal: line.lineTotal,
            lineProfit: line.lineProfit
          }))
        }
      },
      include: { items: true }
    });

    for (const line of lines) {
      const beforeQty = line.product.stockQty;
      const afterQty = beforeQty - line.quantity;
      const updated = await tx.product.updateMany({
        where: {
          id: line.product.id,
          isActive: true,
          stockQty: beforeQty
        },
        data: { stockQty: { decrement: line.quantity } }
      });

      if (updated.count !== 1 || afterQty < 0) {
        throw new Error(`${line.product.name} มีสต็อกไม่พอ`);
      }

      await tx.stockMovement.create({
        data: {
          productId: line.product.id,
          type: "SALE",
          quantityChange: -line.quantity,
          beforeQty,
          afterQty,
          note: created.receiptNo
        }
      });
    }

    return created;
  });
}

export async function GET() {
  const session = await getSession();
  const canSeeProfit = session?.role === "OWNER";
  const sales = await prisma.sale.findMany({
    include: { items: true, creditPayments: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json(
    sales.map((sale) => ({
      ...sale,
      totalAmount: Number(sale.totalAmount),
      totalCost: canSeeProfit ? Number(sale.totalCost) : null,
      grossProfit: canSeeProfit ? Number(sale.grossProfit) : null,
      cashReceived: sale.cashReceived === null ? null : Number(sale.cashReceived),
      changeAmount: sale.changeAmount === null ? null : Number(sale.changeAmount),
      creditDueAmount: sale.creditDueAmount === null ? null : Number(sale.creditDueAmount),
      creditPaidAmount: sale.creditPaidAmount === null ? null : Number(sale.creditPaidAmount),
      creditPayments: sale.creditPayments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount)
      })),
      itemCount: sale.items.reduce((sum, item) => sum + item.quantity, 0),
      items: sale.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        costPrice: canSeeProfit ? Number(item.costPrice) : null,
        lineTotal: Number(item.lineTotal),
        lineProfit: canSeeProfit ? Number(item.lineProfit) : null
      }))
    }))
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const canSeeProfit = session?.role === "OWNER";
    const body = await request.json();
    let sale = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        sale = await createSale(body);
        break;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || attempt === 2) {
          throw error;
        }
      }
    }

    if (!sale) throw new Error("สร้างเลขที่ใบเสร็จไม่สำเร็จ");

    return NextResponse.json(
      {
        ...sale,
        totalAmount: Number(sale.totalAmount),
        totalCost: canSeeProfit ? Number(sale.totalCost) : null,
        grossProfit: canSeeProfit ? Number(sale.grossProfit) : null,
        cashReceived: sale.cashReceived === null ? null : Number(sale.cashReceived),
        changeAmount: sale.changeAmount === null ? null : Number(sale.changeAmount),
        creditDueAmount: sale.creditDueAmount === null ? null : Number(sale.creditDueAmount),
        creditPaidAmount: sale.creditPaidAmount === null ? null : Number(sale.creditPaidAmount)
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดฐานข้อมูล" }, { status: 400 });
  }
}
