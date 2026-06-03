"use client";

export type LocalSyncStatus = "LOCAL_ONLY" | "SYNCING" | "SYNCED" | "FAILED";

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
  lowStockAlertQty?: number;
};

export type LocalSale = {
  localId: string;
  receiptNo: string;
  totalAmount: number;
  totalCost: number;
  grossProfit: number;
  paymentMethod: "CASH" | "TRANSFER";
  cashReceived: number | null;
  changeAmount: number | null;
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
  paymentMethod: "CASH" | "TRANSFER";
  cashReceived: number | null;
  changeAmount: number | null;
}) {
  const db = await openLocalPosDb();
  const now = new Date().toISOString();
  const localId = crypto.randomUUID();
  const receiptNo = localReceiptNo();
  const items: LocalSaleItem[] = input.cart.map((item) => {
    const unitPrice = Number(item.salePrice);
    const costPrice = Number(item.costPrice ?? 0);
    const lineTotal = unitPrice * item.quantity;
    const lineProfit = lineTotal - costPrice * item.quantity;
    return {
      localId: crypto.randomUUID(),
      localSaleId: localId,
      productId: item.id,
      productNameSnapshot: item.name,
      barcodeSnapshot: item.barcode,
      quantity: item.quantity,
      unitPrice,
      costPrice,
      lineTotal,
      lineProfit
    };
  });
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalCost = items.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
  const sale: LocalSale = {
    localId,
    receiptNo,
    totalAmount,
    totalCost,
    grossProfit: totalAmount - totalCost,
    paymentMethod: input.paymentMethod,
    cashReceived: input.cashReceived,
    changeAmount: input.changeAmount,
    createdAt: now,
    syncStatus: "LOCAL_ONLY"
  };
  const movements: LocalStockMovement[] = input.cart.map((item) => ({
    localId: crypto.randomUUID(),
    productId: item.id,
    type: "SALE",
    quantityChange: -item.quantity,
    beforeQty: item.stockQty,
    afterQty: item.stockQty - item.quantity,
    note: receiptNo,
    createdAt: now,
    syncStatus: "LOCAL_ONLY"
  }));
  if (movements.some((movement) => movement.afterQty < 0)) throw new Error("สต็อกในเครื่องไม่พอ");

  const queueItem: SyncQueueItem = {
    id: localId,
    type: "SALE",
    payload: {
      idempotencyKey: localId,
      paymentMethod: input.paymentMethod,
      cashReceived: input.cashReceived,
      items: input.cart.map((item) => ({ productId: item.id, quantity: item.quantity }))
    },
    status: "LOCAL_ONLY",
    createdAt: now,
    attempts: 0
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["products", "localSales", "localSaleItems", "localStockMovements", "syncQueue"], "readwrite");
    const productStore = tx.objectStore("products");
    tx.objectStore("localSales").put(sale);
    for (const item of items) tx.objectStore("localSaleItems").put(item);
    for (const movement of movements) {
      tx.objectStore("localStockMovements").put(movement);
      const product = input.cart.find((entry) => entry.id === movement.productId);
      if (product) productStore.put({ ...product, stockQty: movement.afterQty });
    }
    tx.objectStore("syncQueue").put(queueItem);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return { sale, items };
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
  return rows.filter((item) => item.status !== "SYNCED");
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
