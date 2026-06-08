import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CheckoutItem = { productId: string; quantity: number; unitPrice?: Prisma.Decimal | null };
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

  const byProductAndPrice = new Map<string, CheckoutItem>();
  for (const raw of rawItems) {
    const item = raw as Partial<{ productId: unknown; quantity: unknown; unitPrice: unknown }>;
    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    const quantity = Number(item.quantity);
    let unitPrice: Prisma.Decimal | null = null;

    if (item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== "") {
      try {
        unitPrice = new Prisma.Decimal(String(item.unitPrice)).toDecimalPlaces(2);
      } catch {
        throw new Error("ราคาสินค้าไม่ถูกต้อง");
      }
      if (unitPrice.isNaN() || unitPrice.lte(0)) throw new Error("ราคาสินค้าไม่ถูกต้อง");
    }

    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("จำนวนสินค้าไม่ถูกต้อง");
    }

    const key = `${productId}:${unitPrice ? unitPrice.toFixed(2) : ""}`;
    const existing = byProductAndPrice.get(key);
    byProductAndPrice.set(key, existing ? { ...existing, quantity: existing.quantity + quantity } : { productId, quantity, unitPrice });
  }

  const items = [...byProductAndPrice.values()];
  if (items.length === 0) {
    throw new Error("ไม่มีสินค้าในตะกร้า");
  }
  return items;
}
function parseCashReceived(value: unknown) {
  if (value === null || value === undefined || value === "") {
    throw new Error("เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธเน€เธเธดเธเธชเธ”เธ—เธตเนเธฃเธฑเธเธกเธฒ");
  }
  let cash: Prisma.Decimal;
  try {
    cash = new Prisma.Decimal(String(value));
  } catch {
    throw new Error("เธเธณเธเธงเธเน€เธเธดเธเธชเธ”เนเธกเนเธ–เธนเธเธ•เนเธญเธ");
  }
  if (cash.isNaN() || cash.isNegative()) {
    throw new Error("เธเธณเธเธงเธเน€เธเธดเธเธชเธ”เนเธกเนเธ–เธนเธเธ•เนเธญเธ");
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
    throw new Error("เธเธฃเธธเธ“เธฒเนเธชเนเธเธทเนเธญเธฅเธนเธเธเนเธฒเน€เธเธดเธเน€เธเธทเนเธญ");
  }

  const cashReceived = paymentMethod === "CASH" ? parseCashReceived(checkout.cashReceived) : null;

  // Check idempotency before opening a transaction
  if (idempotencyKey) {
    const existing = await prisma.sale.findUnique({
      where: { idempotencyKey },
      include: { items: { include: { itemBatches: true } } }
    });
    if (existing) return existing;
  }

  let saleId: string;
  try {
    saleId = await prisma.$transaction(async (tx) => {
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
      if (!product) throw new Error("เนเธกเนเธเธเธชเธดเธเธเนเธฒ");
      if (!product.isActive) throw new Error(`${product.name} เธ–เธนเธเธเธดเธ”เนเธเนเธเธฒเธ`);
      if (product.stockQty < item.quantity) throw new Error(`${product.name} เธกเธตเธชเธ•เนเธญเธเนเธกเนเธเธญ`);

      if (item.unitPrice && !product.allowManualPrice) throw new Error(`${product.name} ไม่อนุญาตให้ใส่ราคาเอง`);
      const unitPrice = item.unitPrice ?? product.salePrice;
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
        throw new Error(`${product.name} เธขเธฑเธเนเธกเนเธกเธตเธฅเนเธญเธ•เธชเธดเธเธเนเธฒเน€เธเธตเธขเธเธเธญ เธเธฃเธธเธ“เธฒเธ•เธฑเนเธเธฅเนเธญเธ•เธขเธญเธ”เธขเธเธกเธฒ`);
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
    const changeAmount = paymentMethod === "CASH" && cashReceived ? cashReceived.sub(totalAmount) : paymentMethod === "CREDIT" ? new Prisma.Decimal(0) : null;

    if (cashReceived && cashReceived.lessThan(totalAmount)) {
      throw new Error("เน€เธเธดเธเธชเธ”เธ—เธตเนเธฃเธฑเธเธกเธฒเธเนเธญเธขเธเธงเนเธฒเธขเธญเธ”เธฃเธงเธก");
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
          throw new Error(`${line.product.name} เธฅเนเธญเธ•เธชเธดเธเธเนเธฒเน€เธเธฅเธตเนเธขเธเนเธเธฅเธ เธเธฃเธธเธ“เธฒเธฅเธญเธเนเธซเธกเน`);
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
        throw new Error(`${line.product.name} เธกเธตเธชเธ•เนเธญเธเนเธกเนเธเธญ`);
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

    return sale.id;
  }, {
    maxWait: 5000,
    timeout: 15000
  });
  } catch (error) {
    // Race condition: another request already committed with the same idempotencyKey
    if (
      idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.sale.findUnique({
        where: { idempotencyKey },
        include: { items: { include: { itemBatches: true } } }
      });
      if (existing) return existing;
    }
    throw error;
  }

  return prisma.sale.findUniqueOrThrow({
    where: { id: saleId },
    include: { items: { include: { itemBatches: true } } }
  });
}

function saleLogContext(body: unknown) {
  const checkout = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return {
    paymentMethod: parsePaymentMethod(checkout.paymentMethod),
    idempotencyKey: typeof checkout.idempotencyKey === "string" && checkout.idempotencyKey.trim() ? checkout.idempotencyKey.trim() : null,
    itemCount: Array.isArray(checkout.items) ? checkout.items.length : 0
  };
}

export async function GET() {
  const session = await getSession();
  const canSeeProfit = session?.role === "OWNER";
  const sales = await prisma.sale.findMany({
    include: {
      items: {
        include: {
          returnItems: true,
          itemBatches: {
            include: { productBatch: true },
            orderBy: { createdAt: "asc" }
          }
        }
      },
      returns: { include: { items: true }, orderBy: { createdAt: "desc" } },
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
      returns: sale.returns.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
        items: entry.items.map((item) => ({
          ...item,
          refundAmount: Number(item.refundAmount),
          createdAt: item.createdAt.toISOString()
        }))
      })),
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
        returnedQty: item.returnItems.reduce((sum, entry) => sum + entry.quantity, 0),
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
  let body: unknown = null;
  try {
    const session = await getSession();
    const canSeeProfit = session?.role === "OWNER";
    body = await request.json();
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

    if (!sale) throw new Error("เธชเธฃเนเธฒเธเน€เธฅเธเธ—เธตเนเนเธเน€เธชเธฃเนเธเนเธกเนเธชเธณเน€เธฃเนเธ");

    const context = saleLogContext(body);
    await recordAuditLog({
      actorRole: session?.role ?? null,
      action: context.idempotencyKey ? "SALE_SYNCED" : "SALE_CREATED",
      entityType: "Sale",
      entityId: sale.id,
      description: sale.receiptNo,
      metadata: {
        paymentMethod: sale.paymentMethod,
        receiptNo: sale.receiptNo,
        totalAmount: Number(sale.totalAmount),
        itemCount: context.itemCount,
        idempotencyKey: context.idempotencyKey
      }
    });

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
    console.error("[api/sales] sale sync failed", {
      ...saleLogContext(body),
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : "เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”เธเธฒเธเธเนเธญเธกเธนเธฅ" }, { status: 400 });
  }
}

