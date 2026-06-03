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

    const lines: Array<{
      product: (typeof products)[number];
      quantity: number;
      unitPrice: Prisma.Decimal;
      costPrice: Prisma.Decimal;
      lineCost: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
      lineProfit: Prisma.Decimal;
      allocations: Array<{
        batchId: string;
        previousRemainingQty: number;
        quantity: number;
        unitCost: Prisma.Decimal;
        totalCost: Prisma.Decimal;
      }>;
    }> = [];
    for (const item of items) {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) throw new Error("ไม่พบสินค้า");
      if (!product.isActive) throw new Error(`${product.name} ถูกปิดใช้งาน`);
      if (product.stockQty < item.quantity) throw new Error(`${product.name} มีสต็อกไม่พอ`);

      const unitPrice = product.salePrice;
      const quantity = new Prisma.Decimal(item.quantity);
      const lineTotal = unitPrice.mul(quantity).toDecimalPlaces(2);
      const batches = await tx.productBatch.findMany({
        where: { productId: item.productId, remainingQty: { gt: 0 } },
        orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }]
      });

      let remainingToAllocate = item.quantity;
      const allocations = [];
      for (const batch of batches) {
        if (remainingToAllocate <= 0) break;
        const allocatedQty = Math.min(batch.remainingQty, remainingToAllocate);
        const totalCost = batch.unitCost.mul(allocatedQty).toDecimalPlaces(2);
        allocations.push({
          batchId: batch.id,
          previousRemainingQty: batch.remainingQty,
          quantity: allocatedQty,
          unitCost: batch.unitCost,
          totalCost
        });
        remainingToAllocate -= allocatedQty;
      }

      if (remainingToAllocate > 0) {
        throw new Error(`${product.name} ยังไม่มีล็อตสินค้าเพียงพอ กรุณาตั้งล็อตยอดยกมา`);
      }

      const lineCost = allocations.reduce((sum, allocation) => sum.add(allocation.totalCost), new Prisma.Decimal(0)).toDecimalPlaces(2);
      const costPrice = lineCost.div(quantity).toDecimalPlaces(2);

      lines.push({
        product,
        quantity: item.quantity,
        unitPrice,
        costPrice,
        lineCost,
        lineTotal,
        lineProfit: lineTotal.sub(lineCost).toDecimalPlaces(2),
        allocations
      });
    }

    const totalAmount = lines.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0)).toDecimalPlaces(2);
    const totalCost = lines.reduce((sum, line) => sum.add(line.lineCost), new Prisma.Decimal(0)).toDecimalPlaces(2);
    const grossProfit = totalAmount.sub(totalCost).toDecimalPlaces(2);
    const cashReceived = paymentMethod === "CASH" ? parseCashReceived(checkout.cashReceived) : null;
    const changeAmount = paymentMethod === "CASH" && cashReceived ? cashReceived.sub(totalAmount) : paymentMethod === "CREDIT" ? new Prisma.Decimal(0) : null;

    if (cashReceived && cashReceived.lessThan(totalAmount)) {
      throw new Error("เงินสดที่รับมาน้อยกว่ายอดรวม");
    }

    const receiptNo = await nextReceiptNo(tx);
    const sale = await tx.sale.create({
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
        idempotencyKey
      }
    });

    for (const line of lines) {
      const saleItem = await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: line.product.id,
          productNameSnapshot: line.product.name,
          barcodeSnapshot: line.product.barcode,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          costPrice: line.costPrice,
          lineTotal: line.lineTotal,
          lineProfit: line.lineProfit
        }
      });

      for (const allocation of line.allocations) {
        const updatedBatch = await tx.productBatch.updateMany({
          where: {
            id: allocation.batchId,
            remainingQty: allocation.previousRemainingQty
          },
          data: { remainingQty: { decrement: allocation.quantity } }
        });
        if (updatedBatch.count !== 1) {
          throw new Error(`${line.product.name} ล็อตสินค้าเปลี่ยนแปลง กรุณาลองใหม่`);
        }
        await tx.saleItemBatch.create({
          data: {
            saleItemId: saleItem.id,
            productBatchId: allocation.batchId,
            quantity: allocation.quantity,
            unitCost: allocation.unitCost,
            totalCost: allocation.totalCost
          }
        });
      }

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
          note: sale.receiptNo
        }
      });
    }

    return tx.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: { items: { include: { itemBatches: true } } }
    });
  });
}

export async function GET() {
  const session = await getSession();
  const canSeeProfit = session?.role === "OWNER";
  const sales = await prisma.sale.findMany({
    include: {
      items: {
        include: {
          itemBatches: {
            include: { productBatch: true },
            orderBy: { createdAt: "asc" }
          }
        }
      },
      creditPayments: { orderBy: { createdAt: "desc" } }
    },
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
        lineProfit: canSeeProfit ? Number(item.lineProfit) : null,
        itemBatches: canSeeProfit
          ? item.itemBatches.map((batch) => ({
              id: batch.id,
              productBatchId: batch.productBatchId,
              quantity: batch.quantity,
              unitCost: Number(batch.unitCost),
              totalCost: Number(batch.totalCost),
              receivedAt: batch.productBatch.receivedAt,
              note: batch.productBatch.note
            }))
          : []
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
