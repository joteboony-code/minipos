export type ProductInput = {
  barcode: string;
  name: string;
  categoryId: string | null;
  costPrice: number;
  salePrice: number;
  stockQty: number;
  unit: string;
  lowStockAlertQty: number;
  isActive: boolean;
  isQuickSale: boolean;
};

type ProductForJson = Record<string, unknown> & {
  costPrice: number | string | { toString(): string };
  salePrice: number | string | { toString(): string };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringField(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

export function serializeProduct(product: ProductForJson, options: { includeCost?: boolean } = { includeCost: true }) {
  return {
    ...product,
    costPrice: options.includeCost ? Number(product.costPrice) : null,
    salePrice: Number(product.salePrice)
  };
}

export function parseProductInput(input: unknown): ProductInput {
  const body = asRecord(input);
  const barcode = stringField(body, "barcode");
  const name = stringField(body, "name");
  const rawCategoryId = stringField(body, "categoryId");
  const categoryId = rawCategoryId ? rawCategoryId : null;
  const costPrice = Number(body.costPrice);
  const salePrice = Number(body.salePrice);
  const stockQty = Number(body.stockQty ?? 0);
  const unit = stringField(body, "unit") || "ชิ้น";
  const lowStockAlertQty = Number(body.lowStockAlertQty ?? 5);

  if (!barcode) throw new Error("กรุณาระบุบาร์โค้ด");
  if (!name) throw new Error("กรุณาระบุชื่อสินค้า");
  if (!Number.isFinite(costPrice) || costPrice < 0) throw new Error("ราคาทุนไม่ถูกต้อง");
  if (!Number.isFinite(salePrice) || salePrice < 0) throw new Error("ราคาขายไม่ถูกต้อง");
  if (!Number.isInteger(stockQty) || stockQty < 0) throw new Error("จำนวนสต็อกไม่ถูกต้อง");
  if (!Number.isInteger(lowStockAlertQty) || lowStockAlertQty < 0) throw new Error("จำนวนแจ้งเตือนใกล้หมดไม่ถูกต้อง");

  return {
    barcode,
    name,
    categoryId,
    costPrice,
    salePrice,
    stockQty,
    unit,
    lowStockAlertQty,
    isActive: Boolean(body.isActive ?? true),
    isQuickSale: Boolean(body.isQuickSale ?? false)
  };
}
