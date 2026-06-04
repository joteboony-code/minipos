"use client";

export type LocalSyncStatus = "LOCAL_ONLY" | "SYNCING" | "SYNCED" | "FAILED";
export type LocalPaymentMethod = "CASH" | "TRANSFER" | "CREDIT";
export type LocalCreditStatus = "UNPAID" | "PARTIAL" | "PAID";

export type LocalProduct = {
  id: string;
  barcode: string;
  name: string;
  costPrice: number | null;
  salePrice: number;
  stockQty: number;
  unit: string;
  isActive: boolean;
  isQuickSale?: boolean;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  lowStockAlertQty?: number;
};

export type LocalSale = {
  localId: string;
  receiptNo: string;
  totalAmount: number;
  totalCost: number;
  grossProfit: number;
  paymentMethod: LocalPaymentMethod;
  cashReceived: number | null;
  changeAmount: number | null;
  creditCustomerName?: string | null;
  creditCustomerPhone?: string | null;
  creditNote?: string | null;
  creditDueAmount?: number | null;
  creditPaidAmount?: number | null;
  creditStatus?: LocalCreditStatus | null;
  createdAt: string;
  syncStatus: LocalSyncStatus;
  cloudSaleId?: string;
  cloudReceiptNo?: string;
  syncError?: string;
};

export type LocalSaleItem = {
  localId: string;
  localSaleId: string;
  productId: string;
  productNameSnapshot: string;
  barcodeSnapshot: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  lineTotal: number;
  lineProfit: number;
};

export type LocalStockMovement = {
  localId: string;
  productId: string;
  type: "SALE" | "RECEIVE" | "ADJUST";
  quantityChange: number;
  beforeQty: number;
  afterQty: number;
  note?: string;
  createdAt: string;
  syncStatus: LocalSyncStatus;
};

export type SyncQueueItem = {
  id: string;
  type: "SALE";
  payload: unknown;
  status: LocalSyncStatus;
  createdAt: string;
  lastAttemptAt?: string;
  attempts: number;
  error?: string;
};

export type LocalSaleBundle = {
  sale: LocalSale;
  items: LocalSaleItem[];
};

const DB_NAME = "minimart-pos-local";
const DB_VERSION = 1;
const STALE_SYNCING_MS = 60_000;

const stores = ["products", "categories", "localSales", "localSaleItems", "localStockMovements", "syncQueue", "syncMeta"] as const;

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openLocalPosDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("products")) db.createObjectStore("products", { keyPath: "id" });
      if (!db.objectStoreNames.contains("categories")) db.createObjectStore("categories", { keyPath: "id" });
      if (!db.objectStoreNames.contains("localSales")) db.createObjectStore("localSales", { keyPath: "localId" });
      if (!db.objectStoreNames.contains("localSaleItems")) {
        const store = db.createObjectStore("localSaleItems", { keyPath: "localId" });
        store.createIndex("localSaleId", "localSaleId", { unique: false });
      }
      if (!db.objectStoreNames.contains("localStockMovements")) {
        const store = db.createObjectStore("localStockMovements", { keyPath: "localId" });
        store.createIndex("productId", "productId", { unique: false });
      }
      if (!db.objectStoreNames.contains("syncQueue")) db.createObjectStore("syncQueue", { keyPath: "id" });
      if (!db.objectStoreNames.contains("syncMeta")) db.createObjectStore("syncMeta", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function readonlyStore(storeName: (typeof stores)[number]) {
  const db = await openLocalPosDb();
  return db.transaction(storeName, "readonly").objectStore(storeName);
}

export async function getAllLocalProducts() {
  const store = await readonlyStore("products");
  return requestToPromise<LocalProduct[]>(store.getAll());
}

export async function putLocalProducts(products: LocalProduct[]) {
  const db = await openLocalPosDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");
    for (const product of products) store.put(product);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSyncCount() {
  const store = await readonlyStore("syncQueue");
  const rows = await requestToPromise<SyncQueueItem[]>(store.getAll());
  return rows.filter((item) => item.status !== "SYNCED").length;
}

export async function getPendingSyncSummary() {
  const store = await readonlyStore("syncQueue");
  const rows = await requestToPromise<SyncQueueItem[]>(store.getAll());
  const pending = rows
    .filter((item) => item.status !== "SYNCED")
    .sort((a, b) => (b.lastAttemptAt ?? b.createdAt).localeCompare(a.lastAttemptAt ?? a.createdAt));
  const latestFailed = pending.find((item) => item.error);
  return {
    count: pending.length,
    latestError: latestFailed?.error ?? "",
    latestStatus: pending[0]?.status ?? ""
  };
}

export async function getSyncMeta(key: string) {
  const store = await readonlyStore("syncMeta");
  const result = await requestToPromise<{ key: string; value: string } | undefined>(store.get(key));
  return result?.value ?? "";
}

export async function setSyncMeta(key: string, value: string) {
  const db = await openLocalPosDb();
  await requestToPromise(db.transaction("syncMeta", "readwrite").objectStore("syncMeta").put({ key, value }));
}

function localReceiptNo() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toTimeString().slice(0, 8).replaceAll(":", "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LOCAL-${date}-${time}-${suffix}`;
}

export async function saveLocalSale(input: {
  cart: Array<LocalProduct & { quantity: number }>;
  paymentMethod: LocalPaymentMethod;
  cashReceived: number | null;
  changeAmount: number | null;
  creditCustomerName?: string | null;
  creditCustomerPhone?: string | null;
  creditNote?: string | null;
}): Promise<{ sale: LocalSale; items: LocalSaleItem[] }> {
  const db = await openLocalPosDb();
  const now = new Date().toISOString();
  const localId = crypto.randomUUID();
  const receiptNo = localReceiptNo();
  const cartByProduct = new Map<string, (LocalProduct & { quantity: number })>();
  for (const item of input.cart) {
    const existing = cartByProduct.get(item.id);
    cartByProduct.set(item.id, existing ? { ...existing, quantity: existing.quantity + item.quantity } : { ...item });
  }
  const cartLines = Array.from(cartByProduct.values());
  let sale: LocalSale | null = null;
  let items: LocalSaleItem[] = [];

  const queueItem: SyncQueueItem = {
    id: localId,
    type: "SALE",
    payload: {
      idempotencyKey: localId,
      paymentMethod: input.paymentMethod,
      cashReceived: input.cashReceived,
      creditCustomerName: input.paymentMethod === "CREDIT" ? input.creditCustomerName : null,
      creditCustomerPhone: input.paymentMethod === "CREDIT" ? input.creditCustomerPhone : null,
      creditNote: input.paymentMethod === "CREDIT" ? input.creditNote : null,
      items: cartLines.map((item) => ({ productId: item.id, quantity: item.quantity }))
    },
    status: "LOCAL_ONLY",
    createdAt: now,
    attempts: 0
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["products", "localSales", "localSaleItems", "localStockMovements", "syncQueue"], "readwrite");
    const productStore = tx.objectStore("products");
    const storedProducts = new Map<string, LocalProduct>();
    let remainingReads = cartLines.length;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      try {
        tx.abort();
      } catch {
        // Transaction may already be closing.
      }
      reject(error);
    };

    const writeSale = () => {
      items = cartLines.map((line) => {
        const product = storedProducts.get(line.id) ?? line;
        const unitPrice = Number(product.salePrice);
        const costPrice = Number(product.costPrice ?? 0);
        const lineTotal = unitPrice * line.quantity;
        const lineProfit = lineTotal - costPrice * line.quantity;
        return {
          localId: crypto.randomUUID(),
          localSaleId: localId,
          productId: product.id,
          productNameSnapshot: product.name,
          barcodeSnapshot: product.barcode,
          quantity: line.quantity,
          unitPrice,
          costPrice,
          lineTotal,
          lineProfit
        };
      });
      const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
      const totalCost = items.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
      sale = {
        localId,
        receiptNo,
        totalAmount,
        totalCost,
        grossProfit: totalAmount - totalCost,
        paymentMethod: input.paymentMethod,
        cashReceived: input.cashReceived,
        changeAmount: input.changeAmount,
        creditCustomerName: input.paymentMethod === "CREDIT" ? input.creditCustomerName ?? null : null,
        creditCustomerPhone: input.paymentMethod === "CREDIT" ? input.creditCustomerPhone ?? null : null,
        creditNote: input.paymentMethod === "CREDIT" ? input.creditNote ?? null : null,
        creditDueAmount: input.paymentMethod === "CREDIT" ? totalAmount : 0,
        creditPaidAmount: 0,
        creditStatus: input.paymentMethod === "CREDIT" ? "UNPAID" : null,
        createdAt: now,
        syncStatus: "LOCAL_ONLY"
      };

      tx.objectStore("localSales").put(sale);
      for (const item of items) tx.objectStore("localSaleItems").put(item);
      for (const line of cartLines) {
        const product = storedProducts.get(line.id);
        if (!product) {
          fail(new Error("ไม่พบสินค้าในเครื่อง"));
          return;
        }
        const afterQty = product.stockQty - line.quantity;
        tx.objectStore("localStockMovements").put({
          localId: crypto.randomUUID(),
          productId: product.id,
          type: "SALE",
          quantityChange: -line.quantity,
          beforeQty: product.stockQty,
          afterQty,
          note: receiptNo,
          createdAt: now,
          syncStatus: "LOCAL_ONLY"
        } satisfies LocalStockMovement);
        productStore.put({ ...product, stockQty: afterQty });
      }
      tx.objectStore("syncQueue").put(queueItem);
    };

    for (const line of cartLines) {
      const request = productStore.get(line.id);
      request.onsuccess = () => {
        if (settled) return;
        const product = request.result as LocalProduct | undefined;
        if (!product) return fail(new Error("ไม่พบสินค้าในเครื่อง"));
        if (!product.isActive) return fail(new Error("สินค้าถูกปิดการขาย"));
        if (product.stockQty < line.quantity) return fail(new Error(`${product.name} มีสต็อกในเครื่องไม่พอ`));
        storedProducts.set(product.id, product);
        remainingReads -= 1;
        if (remainingReads === 0) writeSale();
      };
      request.onerror = () => fail(request.error ?? new Error("อ่านข้อมูลสินค้าในเครื่องไม่สำเร็จ"));
    }
    tx.oncomplete = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    tx.onerror = () => fail(tx.error ?? new Error("บันทึกในเครื่องไม่สำเร็จ"));
    tx.onabort = () => {
      if (!settled) {
        settled = true;
        reject(tx.error ?? new Error("บันทึกในเครื่องไม่สำเร็จ"));
      }
    };
  });

  if (!sale) throw new Error("บันทึกในเครื่องไม่สำเร็จ");
  return { sale: sale as LocalSale, items };
}

export async function getLocalSaleBundles() {
  const db = await openLocalPosDb();
  const sales = await requestToPromise<LocalSale[]>(db.transaction("localSales", "readonly").objectStore("localSales").getAll());
  const items = await requestToPromise<LocalSaleItem[]>(db.transaction("localSaleItems", "readonly").objectStore("localSaleItems").getAll());
  return sales
    .map((sale) => ({ sale, items: items.filter((item) => item.localSaleId === sale.localId) }))
    .sort((a, b) => b.sale.createdAt.localeCompare(a.sale.createdAt));
}

export async function getPendingQueueItems() {
  const store = await readonlyStore("syncQueue");
  const rows = await requestToPromise<SyncQueueItem[]>(store.getAll());
  const now = Date.now();
  return rows.filter((item) => {
    if (item.status === "LOCAL_ONLY" || item.status === "FAILED") return true;
    if (item.status !== "SYNCING") return false;
    const lastAttemptAt = item.lastAttemptAt ? Date.parse(item.lastAttemptAt) : 0;
    return !Number.isFinite(lastAttemptAt) || now - lastAttemptAt > STALE_SYNCING_MS;
  });
}

export async function markQueueItemSyncing(item: SyncQueueItem) {
  const db = await openLocalPosDb();
  await requestToPromise(db.transaction("syncQueue", "readwrite").objectStore("syncQueue").put({ ...item, status: "SYNCING", lastAttemptAt: new Date().toISOString(), attempts: item.attempts + 1 }));
}

export async function markSaleSynced(localId: string, cloudSaleId?: string, cloudReceiptNo?: string) {
  const db = await openLocalPosDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["localSales", "syncQueue", "syncMeta"], "readwrite");
    const sales = tx.objectStore("localSales");
    const queue = tx.objectStore("syncQueue");
    const saleRequest = sales.get(localId);
    saleRequest.onsuccess = () => {
      const sale = saleRequest.result as LocalSale | undefined;
      if (sale) sales.put({ ...sale, syncStatus: "SYNCED", cloudSaleId, cloudReceiptNo, syncError: "" });
    };
    const queueRequest = queue.get(localId);
    queueRequest.onsuccess = () => {
      const item = queueRequest.result as SyncQueueItem | undefined;
      if (item) queue.put({ ...item, status: "SYNCED", error: "" });
    };
    tx.objectStore("syncMeta").put({ key: "lastSyncAt", value: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function markSaleSyncFailed(localId: string, error: string) {
  const db = await openLocalPosDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["localSales", "syncQueue"], "readwrite");
    const sales = tx.objectStore("localSales");
    const queue = tx.objectStore("syncQueue");
    const saleRequest = sales.get(localId);
    saleRequest.onsuccess = () => {
      const sale = saleRequest.result as LocalSale | undefined;
      if (sale) sales.put({ ...sale, syncStatus: "FAILED", syncError: error });
    };
    const queueRequest = queue.get(localId);
    queueRequest.onsuccess = () => {
      const item = queueRequest.result as SyncQueueItem | undefined;
      if (item) queue.put({ ...item, status: "FAILED", error });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function exportLocalPosData() {
  const db = await openLocalPosDb();
  const result: Record<string, unknown> = {};
  for (const storeName of stores) {
    result[storeName] = await requestToPromise(db.transaction(storeName, "readonly").objectStore(storeName).getAll());
  }
  return { exportedAt: new Date().toISOString(), ...result };
}
