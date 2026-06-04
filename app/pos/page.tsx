"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Minus, Plus, Search, Trash2 } from "lucide-react";
import { baht } from "@/lib/format";
import {
  getAllLocalProducts,
  getPendingQueueItems,
  getPendingSyncCount,
  getPendingSyncSummary,
  getSyncMeta,
  markQueueItemSyncing,
  markSaleSyncFailed,
  markSaleSynced,
  putLocalProducts,
  saveLocalSale,
  type LocalPaymentMethod,
  type LocalProduct,
  type LocalSyncStatus
} from "@/lib/local-pos-db";

type Product = LocalProduct;

type CartItem = Product & { quantity: number };
type PromptPayState = { configured: boolean; qrDataUrl?: string; message?: string };
type PosSettings = { enableCreditSales: boolean; requireOpenShiftBeforeSale: boolean };
type SaleSuccess = {
  localId?: string;
  receiptNo: string;
  totalAmount: number;
  paymentMethod: LocalPaymentMethod;
  cashReceived: number | null;
  changeAmount: number | null;
  creditCustomerName?: string | null;
  creditStatus?: "UNPAID" | "PARTIAL" | "PAID" | null;
  syncStatus: LocalSyncStatus;
  cloudReceiptNo?: string;
};

function barcodeSuggestionRank(product: Product, keyword: string) {
  const text = keyword.toLowerCase();
  const barcode = product.barcode.toLowerCase();
  const name = product.name.toLowerCase();
  if (barcode === text) return 0;
  if (barcode.startsWith(text)) return 1;
  if (barcode.includes(text)) return 2;
  if (name.includes(text)) return 3;
  return 4;
}

function sortProductSuggestions(products: Product[], keyword: string) {
  return [...products]
    .sort((a, b) => {
      const rankDiff = barcodeSuggestionRank(a, keyword) - barcodeSuggestionRank(b, keyword);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name, "th");
    })
    .slice(0, 8);
}

const quickCashAmounts = [10, 20, 50, 100, 500, 1000];

export default function PosPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const saleSubmittingRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quickSaleProducts, setQuickSaleProducts] = useState<Product[]>([]);
  const [quickSaleCategoryId, setQuickSaleCategoryId] = useState("all");
  const [previewProducts, setPreviewProducts] = useState<Product[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSearchedQuery, setPreviewSearchedQuery] = useState("");
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<LocalPaymentMethod>("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [creditCustomerName, setCreditCustomerName] = useState("");
  const [creditCustomerPhone, setCreditCustomerPhone] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [promptPay, setPromptPay] = useState<PromptPayState | null>(null);
  const [successSale, setSuccessSale] = useState<SaleSuccess | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [cacheStatus, setCacheStatus] = useState("เธเธณเธฅเธฑเธเนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธชเธดเธเธเนเธฒเนเธเน€เธเธฃเธทเนเธญเธ");
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [pendingSyncError, setPendingSyncError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<PosSettings>({ enableCreditSales: true, requireOpenShiftBeforeSale: false });

  useEffect(() => {
    inputRef.current?.focus();
    fetch("/api/settings")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) setSettings({
          enableCreditSales: data.enableCreditSales !== false,
          requireOpenShiftBeforeSale: Boolean(data.requireOpenShiftBeforeSale)
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!settings.enableCreditSales && paymentMethod === "CREDIT") setPaymentMethod("CASH");
  }, [paymentMethod, settings.enableCreditSales]);

  const refreshSyncStatus = useCallback(() => {
    getPendingSyncSummary()
      .then((summary) => {
        setPendingSyncCount(summary.count);
        setPendingSyncError(summary.latestError);
      })
      .catch(() => {
        getPendingSyncCount().then(setPendingSyncCount).catch(() => undefined);
      });
    getSyncMeta("lastSyncAt").then(setLastSyncAt).catch(() => undefined);
  }, []);

  useEffect(() => {
    setQuickSaleProducts(products.filter((product) => product.isActive && product.isQuickSale));
  }, [products]);

  const loadProductCache = useCallback(async () => {
    const cachedProducts = await getAllLocalProducts();
    const hasCache = cachedProducts.length > 0;
    if (hasCache) {
      setProducts(cachedProducts);
      setCacheStatus("เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธชเธดเธเธเนเธฒเนเธเน€เธเธฃเธทเนเธญเธเนเธฅเนเธง");
    }

    if (!navigator.onLine) {
      setOnline(false);
      setCacheStatus(hasCache ? "เนเธเนเธเนเธญเธกเธนเธฅเนเธเน€เธเธฃเธทเนเธญเธ" : "เธขเธฑเธเนเธกเนเธกเธตเธเนเธญเธกเธนเธฅเธชเธดเธเธเนเธฒเนเธเน€เธเธฃเธทเนเธญเธ เธเธฃเธธเธ“เธฒเน€เธเธทเนเธญเธกเธ•เนเธญเธญเธดเธเน€เธ—เธญเธฃเนเน€เธเนเธ•เน€เธเธทเนเธญเนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธเธฃเธฑเนเธเนเธฃเธ");
      return;
    }

    try {
      setCacheStatus("เธเธณเธฅเธฑเธเธญเธฑเธเน€เธ”เธ•เธเนเธญเธกเธนเธฅเธเธฒเธ Cloud");
      const res = await fetch("/api/products");
      const cloudProducts = await res.json();
      if (!res.ok || !Array.isArray(cloudProducts)) throw new Error("เนเธซเธฅเธ”เธชเธดเธเธเนเธฒเนเธกเนเธชเธณเน€เธฃเนเธ");
      const pendingCount = await getPendingSyncCount();
      const localById = new Map(cachedProducts.map((product) => [product.id, product]));
      const merged = (cloudProducts as Product[]).map((product) => {
        const local = localById.get(product.id);
        return pendingCount > 0 && local ? { ...product, stockQty: local.stockQty } : product;
      });
      await putLocalProducts(merged);
      setProducts(merged);
      setCacheStatus("เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธชเธดเธเธเนเธฒเนเธเน€เธเธฃเธทเนเธญเธเนเธฅเนเธง");
    } catch {
      setCacheStatus(hasCache ? "เนเธเนเธเนเธญเธกเธนเธฅเนเธเน€เธเธฃเธทเนเธญเธ" : "เธขเธฑเธเนเธกเนเธกเธตเธเนเธญเธกเธนเธฅเธชเธดเธเธเนเธฒเนเธเน€เธเธฃเธทเนเธญเธ เธเธฃเธธเธ“เธฒเน€เธเธทเนเธญเธกเธ•เนเธญเธญเธดเธเน€เธ—เธญเธฃเนเน€เธเนเธ•เน€เธเธทเนเธญเนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธเธฃเธฑเนเธเนเธฃเธ");
    }
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    loadProductCache().catch(() => setCacheStatus("เนเธเนเธเนเธญเธกเธนเธฅเนเธเน€เธเธฃเธทเนเธญเธ"));
    refreshSyncStatus();
    const onOnline = () => {
      setOnline(true);
      loadProductCache().catch(() => undefined);
      syncPendingSales();
    };
    const onOffline = () => {
      setOnline(false);
      setCacheStatus("เนเธเนเธเนเธญเธกเธนเธฅเนเธเน€เธเธฃเธทเนเธญเธ");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadProductCache, refreshSyncStatus]);

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.salePrice * item.quantity, 0), [cart]);
  const cashAmount = Number(cashReceived || 0);
  const validCashAmount = Number.isFinite(cashAmount) ? cashAmount : 0;
  const isCashTooLow = paymentMethod === "CASH" && cashReceived.trim() !== "" && validCashAmount < total;
  const creditNameMissing = paymentMethod === "CREDIT" && creditCustomerName.trim() === "";
  const canCompleteSale = cart.length > 0 && !busy && (
    paymentMethod === "TRANSFER" ||
    (paymentMethod === "CREDIT" && creditCustomerName.trim() !== "") ||
    (paymentMethod === "CASH" && cashReceived.trim() !== "" && Number.isFinite(cashAmount) && cashAmount >= total)
  );
  const change = Math.max(validCashAmount - total, 0);
  const trimmedQuery = query.trim();
  const previewExactProduct = previewProducts.find((product) => product.barcode === trimmedQuery);
  const enterProduct = previewExactProduct ?? (previewProducts.length === 1 ? previewProducts[0] : null);
  const isNumericSearch = /^\d+$/.test(trimmedQuery);
  const showNoPreviewResult = trimmedQuery !== "" && !previewLoading && previewSearchedQuery === trimmedQuery && previewProducts.length === 0;
  const quickSaleCategories = useMemo(() => {
    const byId = new Map<string, string>();
    for (const product of quickSaleProducts) {
      if (product.categoryId && product.category?.name) byId.set(product.categoryId, product.category.name);
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [quickSaleProducts]);
  const filteredQuickSaleProducts = useMemo(
    () => quickSaleCategoryId === "all" ? quickSaleProducts : quickSaleProducts.filter((product) => product.categoryId === quickSaleCategoryId),
    [quickSaleCategoryId, quickSaleProducts]
  );

  useEffect(() => {
    if (paymentMethod !== "TRANSFER" || total <= 0) {
      setPromptPay(null);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/promptpay?amount=${encodeURIComponent(total.toFixed(2))}`, { signal: controller.signal })
      .then((res) => res.json())
      .then(setPromptPay)
      .catch(() => {
        if (!controller.signal.aborted) setPromptPay({ configured: false, message: "เนเธซเธฅเธ” QR เธเธฃเนเธญเธกเน€เธเธขเนเนเธกเนเธชเธณเน€เธฃเนเธ" });
      });

    return () => controller.abort();
  }, [paymentMethod, total]);

  useEffect(() => {
    const keyword = query.trim();
    if (!keyword) {
      setPreviewProducts([]);
      setPreviewSearchedQuery("");
      setPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const text = keyword.toLowerCase();
      const matches = products.filter((product) => product.barcode.includes(keyword) || product.name.toLowerCase().includes(text));
      setPreviewProducts(sortProductSuggestions(matches, keyword));
      setPreviewSearchedQuery(keyword);
      setPreviewLoading(false);
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [products, query]);

  function addProduct(product: Product) {
    if (!product.isActive) return setMessage("เธชเธดเธเธเนเธฒเธ–เธนเธเธเธดเธ”เธเธฒเธฃเธเธฒเธข");
    const found = cart.find((item) => item.id === product.id);
    if (found && found.quantity + 1 > product.stockQty) {
      return setMessage("เธชเธ•เนเธญเธเนเธกเนเธเธญเธชเธณเธซเธฃเธฑเธเธชเธดเธเธเนเธฒเธเธตเน");
    }
    if (!found && product.stockQty < 1) {
      return setMessage("เธชเธ•เนเธญเธเธซเธกเธ”");
    }
    setCart((items) =>
      found
        ? items.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...items, { ...product, quantity: 1 }]
    );
    setMessage("");
  }

  async function syncPendingSales() {
    if (!navigator.onLine || syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setSyncBusy(true);
    try {
      const queueItems = await getPendingQueueItems();
      for (const item of queueItems) {
        try {
          await markQueueItemSyncing(item);
          const res = await fetch("/api/sales", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload)
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "เธเธดเธเธเน Cloud เนเธกเนเธชเธณเน€เธฃเนเธ");
          await markSaleSynced(item.id, data.id, data.receiptNo);
          setSuccessSale((current) => current && item.id === current.localId ? { ...current, syncStatus: "SYNCED", cloudReceiptNo: data.receiptNo } : current);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "เธเธดเธเธเน Cloud เนเธกเนเธชเธณเน€เธฃเนเธ";
          await markSaleSyncFailed(item.id, errorMessage);
          setMessage(`เธเธดเธเธเน Cloud เนเธกเนเธชเธณเน€เธฃเนเธ: ${errorMessage}`);
          setSuccessSale((current) => current && item.id === current.localId ? { ...current, syncStatus: "FAILED" } : current);
        }
      }
    } finally {
      syncInFlightRef.current = false;
      setSyncBusy(false);
      refreshSyncStatus();
    }
  }

  function addPreviewProduct(product: Product) {
    addProduct(product);
    if (product.isActive && product.stockQty > 0) {
      setQuery("");
      setPreviewProducts([]);
      setPreviewSearchedQuery("");
    }
    inputRef.current?.focus();
  }

  function productStatus(product: Product) {
    if (!product.isActive) return { label: "เธชเธดเธเธเนเธฒเธ–เธนเธเธเธดเธ”เธเธฒเธฃเธเธฒเธข", className: "bg-red-50 text-red-700" };
    if (product.stockQty <= 0) return { label: "เธชเธ•เนเธญเธเธซเธกเธ”", className: "bg-red-50 text-red-700" };
    return { label: `เธเธเน€เธซเธฅเธทเธญ ${product.stockQty} ${product.unit}`, className: "bg-emerald-50 text-emerald-700" };
  }

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const keyword = query.trim();
    if (!keyword) return;
    if (enterProduct && previewSearchedQuery === keyword) {
      addPreviewProduct(enterProduct);
      return;
    }
    const isBarcode = /^\d+$/.test(keyword);
    const text = keyword.toLowerCase();
    const localMatches = products.filter((product) => (isBarcode ? product.barcode === keyword || product.barcode.includes(keyword) : product.name.toLowerCase().includes(text) || product.barcode.includes(keyword)));
    const sortedProducts = sortProductSuggestions(localMatches, keyword);
    const exactProduct = sortedProducts.find((product) => product.barcode === keyword);
    const productToAdd = exactProduct ?? (sortedProducts.length === 1 ? sortedProducts[0] : null);
    if (sortedProducts.length === 0) {
      setMessage("เนเธกเนเธเธเธชเธดเธเธเนเธฒ");
    } else if (!productToAdd) {
      setPreviewProducts(sortedProducts);
      setPreviewSearchedQuery(keyword);
      setMessage(isBarcode ? "เน€เธฅเธทเธญเธเธชเธดเธเธเนเธฒเนเธเธฅเนเน€เธเธตเธขเธเธเนเธญเธเน€เธเธดเนเธก" : "เน€เธฅเธทเธญเธเธชเธดเธเธเนเธฒเธ—เธตเนเธ•เนเธญเธเธเธฒเธฃเธเนเธญเธเน€เธเธดเนเธก");
    } else {
      addProduct(productToAdd);
      setQuery("");
      setPreviewProducts([]);
      setPreviewSearchedQuery("");
    }
    inputRef.current?.focus();
  }

  function updateQty(id: string, delta: number) {
    setQtyDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setCart((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const next = item.quantity + delta;
        if (next > item.stockQty) setMessage("เธชเธ•เนเธญเธเนเธกเนเธเธญเธชเธณเธซเธฃเธฑเธเธชเธดเธเธเนเธฒเธเธตเน");
        return { ...item, quantity: Math.min(Math.max(next, 1), item.stockQty) };
      })
    );
  }

  function commitQty(item: CartItem) {
    const raw = qtyDraft[item.id];
    if (raw === undefined) return;
    const parsed = parseInt(raw, 10);
    if (!Number.isInteger(parsed) || isNaN(parsed) || parsed < 1) {
      setQtyDraft((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return;
    }
    if (parsed > item.stockQty) {
      setMessage(`เธชเธ•เนเธญเธเธเธเน€เธซเธฅเธทเธญเนเธกเนเธเธญ (เธกเธต ${item.stockQty} ${item.unit})`);
    }
    const clamped = Math.min(parsed, item.stockQty);
    setCart((items) => items.map((i) => (i.id === item.id ? { ...i, quantity: clamped } : i)));
    setQtyDraft((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  }

  async function completeSale() {
    if (saleSubmittingRef.current) return;
    if (cart.length === 0) return setMessage("เนเธกเนเธกเธตเธชเธดเธเธเนเธฒเนเธเธ•เธฐเธเธฃเนเธฒ");
    if (paymentMethod === "CASH" && cashReceived.trim() === "") return setMessage("เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธเน€เธเธดเธเธชเธ”เธ—เธตเนเธฃเธฑเธเธกเธฒ");
    if (paymentMethod === "CASH" && !Number.isFinite(cashAmount)) return setMessage("เธเธณเธเธงเธเน€เธเธดเธเธชเธ”เนเธกเนเธ–เธนเธเธ•เนเธญเธ");
    if (paymentMethod === "CASH" && cashAmount < total) return setMessage("เน€เธเธดเธเธฃเธฑเธเธเนเธญเธขเธเธงเนเธฒเธขเธญเธ”เธฃเธงเธก");
    if (paymentMethod === "CREDIT" && creditCustomerName.trim() === "") return setMessage("เธเธฃเธธเธ“เธฒเนเธชเนเธเธทเนเธญเธฅเธนเธเธเนเธฒเน€เธเธดเธเน€เธเธทเนเธญ");
    saleSubmittingRef.current = true;
    setBusy(true);
    try {
      const localProducts = await getAllLocalProducts();
      const localProductMap = new Map(localProducts.map((product) => [product.id, product]));
      const localCart = cart.map((item) => ({ ...(localProductMap.get(item.id) ?? item), quantity: item.quantity }));
      for (const item of localCart) {
        if (item.stockQty < item.quantity) throw new Error(`${item.name} เธกเธตเธชเธ•เนเธญเธเนเธเน€เธเธฃเธทเนเธญเธเนเธกเนเธเธญ`);
      }
      const localSaved = await saveLocalSale({
        cart: localCart,
        paymentMethod,
        cashReceived: paymentMethod === "CASH" ? cashAmount : null,
        changeAmount: paymentMethod === "CASH" ? cashAmount - total : paymentMethod === "CREDIT" ? 0 : null,
        creditCustomerName: paymentMethod === "CREDIT" ? creditCustomerName.trim() : null,
        creditCustomerPhone: paymentMethod === "CREDIT" ? creditCustomerPhone.trim() || null : null,
        creditNote: paymentMethod === "CREDIT" ? creditNote.trim() || null : null
      });
      const updatedProducts = await getAllLocalProducts();
      setProducts(updatedProducts);
      setSuccessSale({
        receiptNo: localSaved.sale.receiptNo,
        localId: localSaved.sale.localId,
        totalAmount: localSaved.sale.totalAmount,
        paymentMethod: localSaved.sale.paymentMethod,
        cashReceived: localSaved.sale.cashReceived,
        changeAmount: localSaved.sale.changeAmount,
        creditCustomerName: localSaved.sale.creditCustomerName,
        creditStatus: localSaved.sale.creditStatus,
        syncStatus: "LOCAL_ONLY"
      });
      setCart([]);
      setQtyDraft({});
      setCashReceived("");
      setCreditCustomerName("");
      setCreditCustomerPhone("");
      setCreditNote("");
      setMessage(`เธเธฑเธเธ—เธถเธเนเธเน€เธเธฃเธทเนเธญเธเนเธฅเนเธง ${localSaved.sale.receiptNo}`);
      refreshSyncStatus();
      if (navigator.onLine) window.setTimeout(() => syncPendingSales(), 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เธเธฑเธเธ—เธถเธเนเธเน€เธเธฃเธทเนเธญเธเนเธกเนเธชเธณเน€เธฃเนเธ");
    } finally {
      saleSubmittingRef.current = false;
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function handleCashKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    completeSale();
  }

  function setQuickCashAmount(amount: number) {
    setCashReceived(amount.toFixed(2).replace(/\.00$/, ""));
  }

  function quickCashButtonClass(amount: number) {
    const selected = cashReceived.trim() !== "" && Number(cashReceived) === amount;
    return `min-h-10 rounded-lg border px-2 py-1 text-sm font-black transition ${
      selected ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white text-slate-900 hover:border-teal-500 hover:bg-teal-50"
    }`;
  }

  function renderPaymentPanel() {
    return (
      <div className="card p-3">
        <div className="text-xl font-black">เธฃเธฑเธเธเธณเธฃเธฐเน€เธเธดเธ</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button className={`btn min-h-12 px-2 text-base ${paymentMethod === "CASH" ? "btn-primary ring-4 ring-teal-200" : "btn-light"}`} disabled={busy} onClick={() => setPaymentMethod("CASH")} type="button">
            เน€เธเธดเธเธชเธ”
          </button>
          <button className={`btn min-h-12 px-2 text-base ${paymentMethod === "TRANSFER" ? "btn-primary ring-4 ring-teal-200" : "btn-light"}`} disabled={busy} onClick={() => setPaymentMethod("TRANSFER")} type="button">
            เธฃเธฑเธเนเธญเธ
          </button>
          {settings.enableCreditSales && (
            <button className={`btn min-h-12 px-2 text-base ${paymentMethod === "CREDIT" ? "btn-primary ring-4 ring-teal-200" : "btn-light"}`} disabled={busy} onClick={() => setPaymentMethod("CREDIT")} type="button">
              เน€เธเธดเธเน€เธเธทเนเธญ
            </button>
          )}
        </div>
        <div className="mt-2 rounded-lg bg-slate-100 p-3">
          <div className="text-sm font-black text-slate-600">เธขเธญเธ”เธฃเธงเธก</div>
          <div className="text-3xl font-black text-teal-700">{baht(total)}</div>
        </div>
        {paymentMethod === "CASH" && (
          <div className="mt-2 space-y-1.5">
            <label className="font-black">เธฃเธฑเธเน€เธเธดเธ</label>
            <input
              className="field min-h-12 text-xl"
              value={cashReceived}
              onChange={(event) => setCashReceived(event.target.value)}
              onKeyDown={handleCashKeyDown}
              disabled={busy}
              type="number"
              min="0"
              step="0.01"
            />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="mb-1.5 text-sm font-black text-slate-700">เธฃเธฑเธเน€เธเธดเธเธ”เนเธงเธ</div>
              <div className="grid grid-cols-4 gap-1.5">
                <button className={quickCashButtonClass(total)} disabled={busy || total <= 0} onClick={() => setQuickCashAmount(total)} type="button">
                  เธเธญเธ”เธต
                </button>
                {quickCashAmounts.map((amount) => (
                  <button key={amount} className={quickCashButtonClass(amount)} disabled={busy} onClick={() => setQuickCashAmount(amount)} type="button">
                    {amount}
                  </button>
                ))}
              </div>
            </div>
            {isCashTooLow && <div className="rounded-lg border-2 border-red-200 bg-red-50 p-2 font-black text-red-700">เน€เธเธดเธเธฃเธฑเธเธเนเธญเธขเธเธงเนเธฒเธขเธญเธ”เธฃเธงเธก</div>}
            <div className="rounded-lg border-4 border-emerald-300 bg-emerald-50 p-3">
              <div className="font-black text-emerald-800">เน€เธเธดเธเธ—เธญเธ</div>
              <div className="text-3xl font-black text-emerald-700">{baht(change)}</div>
            </div>
          </div>
        )}
        {paymentMethod === "TRANSFER" && (
          <div className="mt-2 rounded-lg border-2 border-blue-100 bg-blue-50 p-3 text-center">
            <div className="text-lg font-black text-blue-900">QR เธเธฃเนเธญเธกเน€เธเธขเน</div>
            <div className="font-black text-blue-700">เธขเธญเธ”เนเธญเธ {baht(total)}</div>
            {promptPay?.configured && promptPay.qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="mx-auto mt-2 max-h-44 rounded-lg bg-white p-2" src={promptPay.qrDataUrl} alt="QR เธเธฃเนเธญเธกเน€เธเธขเน" />
            ) : (
              <div className="mt-2 rounded-lg bg-white p-2 font-bold text-slate-600">{promptPay?.message ?? "เธขเธฑเธเนเธกเนเนเธ”เนเธ•เธฑเนเธเธเนเธฒเน€เธฅเธเธเธฃเนเธญเธกเน€เธเธขเน"}</div>
            )}
          </div>
        )}
        {paymentMethod === "CREDIT" && (
          <div className="mt-2 space-y-2 rounded-lg border-2 border-amber-100 bg-amber-50 p-3">
            <div className="text-lg font-black text-amber-900">เน€เธเธดเธเน€เธเธทเนเธญ</div>
            <label className="block space-y-1">
              <span className="font-black">เธเธทเนเธญเธฅเธนเธเธเนเธฒ</span>
              <input className="field min-h-11 text-base" value={creditCustomerName} onChange={(event) => setCreditCustomerName(event.target.value)} disabled={busy} />
            </label>
            <label className="block space-y-1">
              <span className="font-black">เน€เธเธญเธฃเนเนเธ—เธฃ (เนเธกเนเธเธฑเธเธเธฑเธ)</span>
              <input className="field min-h-11 text-base" value={creditCustomerPhone} onChange={(event) => setCreditCustomerPhone(event.target.value)} disabled={busy} />
            </label>
            <label className="block space-y-1">
              <span className="font-black">เธซเธกเธฒเธขเน€เธซเธ•เธธ (เนเธกเนเธเธฑเธเธเธฑเธ)</span>
              <input className="field min-h-11 text-base" value={creditNote} onChange={(event) => setCreditNote(event.target.value)} disabled={busy} />
            </label>
            {creditNameMissing && <div className="rounded-lg border-2 border-amber-300 bg-white p-2 font-black text-amber-800">เธเธฃเธธเธ“เธฒเนเธชเนเธเธทเนเธญเธฅเธนเธเธเนเธฒเน€เธเธดเธเน€เธเธทเนเธญ</div>}
          </div>
        )}
        <button className="btn btn-primary mt-3 w-full py-3 text-xl" disabled={!canCompleteSale} onClick={completeSale} type="button">
          {busy ? "เธเธณเธฅเธฑเธเธเธฑเธเธ—เธถเธ..." : "เธเธฑเธเธ—เธถเธเธเธฒเธฃเธเธฒเธข"}
        </button>
        <button
          className="btn btn-light mt-2 w-full py-2 text-base"
          onClick={() => {
            setCart([]);
            setQtyDraft({});
            setMessage("");
          }}
          disabled={busy}
          type="button"
        >
          เธขเธเน€เธฅเธดเธเธ•เธฐเธเธฃเนเธฒ
        </button>
      </div>
    );
  }

  function renderProductPreview() {
    if (!trimmedQuery) return null;

    if (previewLoading) {
      return <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-500">เธเธณเธฅเธฑเธเธเนเธเธซเธฒเธชเธดเธเธเนเธฒ...</div>;
    }

    if (showNoPreviewResult) {
      return <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-black text-amber-800">{isNumericSearch ? "เนเธกเนเธเธเธชเธดเธเธเนเธฒเนเธเธฅเนเน€เธเธตเธขเธ" : "เนเธกเนเธเธเธชเธดเธเธเนเธฒ"}</div>;
    }

    if (previewProducts.length === 0) return null;

    if (previewExactProduct) {
      const product = previewExactProduct;
      const status = productStatus(product);
      return (
        <button
          className="mt-2 w-full rounded-lg border-2 border-teal-200 bg-teal-50 px-3 py-2 text-left transition hover:border-teal-500"
          onClick={() => addPreviewProduct(product)}
          disabled={busy}
          type="button"
        >
          <div className="text-sm font-black text-teal-800">เธชเธดเธเธเนเธฒเธ—เธตเนเธเธ</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-lg font-black text-slate-950">{product.name}</span>
            <span className="text-sm font-bold text-slate-500">{product.barcode}</span>
            <span className="text-lg font-black text-teal-700">เธฃเธฒเธเธฒ {baht(product.salePrice)}</span>
            <span className={`rounded-md px-2 py-1 text-sm font-black ${status.className}`}>{status.label}</span>
          </div>
        </button>
      );
    }

    return (
      <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-sm font-black text-slate-600">{isNumericSearch ? "เธชเธดเธเธเนเธฒเนเธเธฅเนเน€เธเธตเธขเธ" : "เธชเธดเธเธเนเธฒเธ—เธตเนเธเธ"}</div>
        <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {previewProducts.slice(0, 8).map((product) => {
            const status = productStatus(product);
            return (
              <button
                key={product.id}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 py-2 text-left hover:bg-teal-50"
                onClick={() => addPreviewProduct(product)}
                disabled={busy}
                type="button"
              >
                <div className="min-w-0">
                  <div className="truncate font-black text-slate-950">{product.name}</div>
                  <div className="text-xs font-bold text-slate-500">{product.barcode}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-teal-700">เธฃเธฒเธเธฒ {baht(product.salePrice)}</div>
                  <div className={`mt-1 rounded-md px-2 py-0.5 text-xs font-black ${status.className}`}>{status.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_500px]">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-black">เธเธฒเธขเธชเธดเธเธเนเธฒ</h1>
          <p className="mt-1 font-bold text-slate-600">เธชเนเธเธเธเธฒเธฃเนเนเธเนเธ”เธซเธฃเธทเธญเธเธดเธกเธเนเธเธทเนเธญเธชเธดเธเธเนเธฒ เนเธฅเนเธงเธเธ” Enter</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-black">
            <span className={`rounded-md px-2 py-1 ${online ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{online ? "เธญเธญเธเนเธฅเธเน" : "เธญเธญเธเนเธฅเธเน"}</span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">เธฃเธญเธเธดเธเธเน {pendingSyncCount} เธฃเธฒเธขเธเธฒเธฃ</span>
            {pendingSyncError && <span className="rounded-md bg-red-50 px-2 py-1 text-red-700">เธเธดเธเธเนเธฅเนเธฒเธชเธธเธ”: {pendingSyncError}</span>}
            <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">{cacheStatus}</span>
            {lastSyncAt && <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">เธเธดเธเธเนเธฅเนเธฒเธชเธธเธ”: {new Date(lastSyncAt).toLocaleString("th-TH")}</span>}
            <button className="rounded-md bg-teal-600 px-3 py-1 text-white disabled:opacity-50" disabled={!online || syncBusy} onClick={syncPendingSales} type="button">
              {syncBusy ? "เธเธณเธฅเธฑเธเธเธดเธเธเน Cloud" : "เธเธดเธเธเนเธเนเธญเธกเธนเธฅเธ•เธญเธเธเธตเน"}
            </button>
          </div>
        </div>
        <form onSubmit={handleSearch} className="card p-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={26} />
              <input
                ref={inputRef}
                className="field min-h-14 pl-12 text-xl"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="เธชเนเธเธเธเธฒเธฃเนเนเธเนเธ” เธซเธฃเธทเธญเธเธดเธกเธเนเธเธทเนเธญเธชเธดเธเธเนเธฒ"
                disabled={busy}
              />
            </div>
            <button className="btn btn-primary min-h-14 min-w-32 text-xl" disabled={busy} type="submit">
              เน€เธเธดเนเธก
            </button>
          </div>
          {renderProductPreview()}
        </form>
        <div className="xl:hidden">{renderPaymentPanel()}</div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <div className="text-xl font-black">เธ•เธฐเธเธฃเนเธฒเธชเธดเธเธเนเธฒ</div>
            <div className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">{cart.length} เธฃเธฒเธขเธเธฒเธฃ</div>
          </div>
          <div className="max-h-[36vh] min-h-28 overflow-y-auto xl:max-h-[42vh]">
            {cart.length === 0 ? (
              <div className="px-4 py-6 text-center font-bold text-slate-500">เธขเธฑเธเนเธกเนเธกเธตเธชเธดเธเธเนเธฒเนเธเธ•เธฐเธเธฃเนเธฒ</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-1 sm:grid-cols-[minmax(0,1fr)_90px_auto_auto]">
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-sm font-black sm:text-base">{item.name}</div>
                      <div className="mt-0.5 truncate text-xs font-bold text-slate-500">{item.barcode} | เธเธเน€เธซเธฅเธทเธญ {item.stockQty}</div>
                    </div>
                    <div className="hidden text-right text-xs font-bold text-slate-700 sm:block">
                      {baht(item.salePrice)} x {item.quantity}
                    </div>
                    <div className="text-right text-base font-black text-teal-700">{baht(item.salePrice * item.quantity)}</div>
                    <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
                        <button className="btn btn-light touch-icon-button" disabled={busy} onClick={() => updateQty(item.id, -1)} type="button" title="เธฅเธ”เธเธณเธเธงเธ">
                          <Minus size={16} />
                        </button>
                        <input
                          className="h-8 w-14 rounded-lg bg-slate-100 text-center text-sm font-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          disabled={busy}
                          value={qtyDraft[item.id] !== undefined ? qtyDraft[item.id] : String(item.quantity)}
                          onChange={(e) => setQtyDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          onBlur={() => commitQty(item)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
                          title={`เธเธณเธเธงเธ (เธชเธนเธเธชเธธเธ” ${item.stockQty})`}
                        />
                        <button className="btn btn-light touch-icon-button" disabled={busy} onClick={() => updateQty(item.id, 1)} type="button" title="เน€เธเธดเนเธกเธเธณเธเธงเธ">
                          <Plus size={16} />
                        </button>
                        <button
                          className="btn btn-danger touch-icon-button"
                          disabled={busy}
                          onClick={() => {
                            setQtyDraft((prev) => { const next = { ...prev }; delete next[item.id]; return next; });
                            setCart((items) => items.filter((entry) => entry.id !== item.id));
                          }}
                          type="button"
                          title="เธฅเธเธชเธดเธเธเนเธฒ"
                        >
                          <Trash2 size={16} />
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-3 py-2 text-xl font-black">เธเธธเนเธกเธเธฒเธขเธ”เนเธงเธ</div>
          {quickSaleCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-3 py-2">
              <button className={`rounded-lg px-3 py-2 text-sm font-black ${quickSaleCategoryId === "all" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setQuickSaleCategoryId("all")} disabled={busy} type="button">ทั้งหมด</button>
              {quickSaleCategories.map((category) => (
                <button key={category.id} className={`rounded-lg px-3 py-2 text-sm font-black ${quickSaleCategoryId === category.id ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setQuickSaleCategoryId(category.id)} disabled={busy} type="button">{category.name}</button>
              ))}
            </div>
          )}
          {filteredQuickSaleProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5 p-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {filteredQuickSaleProducts.map((product) => {
                const isOut = product.stockQty <= 0;
                return (
                  <button
                    key={product.id}
                    className={`min-h-28 overflow-hidden rounded-lg border-2 text-left font-black transition ${
                      isOut
                        ? "border-slate-200 bg-slate-100 text-slate-400 opacity-60"
                        : "border-teal-200 bg-white text-slate-950 hover:border-teal-500 hover:bg-teal-50"
                    }`}
                    disabled={isOut || busy}
                    onClick={() => addProduct(product)}
                    type="button"
                  >
                    <div className="flex min-h-28 flex-col justify-between gap-1.5 p-2.5">
                      <div className="line-clamp-2 text-lg leading-tight">{product.name}</div>
                      <div className="text-xl text-teal-700">{baht(product.salePrice)}</div>
                      <div className={`rounded-md px-2 py-1 text-xs ${isOut ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-800"}`}>
                        {isOut ? "เธซเธกเธ”" : `เธเธเน€เธซเธฅเธทเธญ ${product.stockQty} ${product.unit}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-6 text-center font-bold text-slate-500">เธขเธฑเธเนเธกเนเธกเธตเธชเธดเธเธเนเธฒเธเธธเนเธกเธเธฒเธขเธ”เนเธงเธ</div>
          )}
        </div>
        {message && <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2 font-black text-amber-900">{message}</div>}
      </div>
      <aside className="hidden xl:sticky xl:top-3 xl:block xl:self-start">
        {renderPaymentPanel()}
      </aside>
      {busy && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4">
          <div className="card w-full max-w-sm p-6 text-center shadow-2xl">
            <LoaderCircle className="mx-auto animate-spin text-teal-700" size={56} strokeWidth={2.6} />
            <div className="mt-4 text-2xl font-black text-slate-950">เธเธณเธฅเธฑเธเธเธฑเธเธ—เธถเธเนเธเน€เธเธฃเธทเนเธญเธ...</div>
            <div className="mt-2 font-bold text-slate-600">เธเธฃเธธเธ“เธฒเธฃเธญเธชเธฑเธเธเธฃเธนเน เธซเนเธฒเธกเธเธดเธ”เธซเธเนเธฒเธเธตเน</div>
          </div>
        </div>
      )}
      {successSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="card w-full max-w-lg p-6">
            <div className="text-3xl font-black text-teal-700">เธเธฑเธเธ—เธถเธเธเธฒเธฃเธเธฒเธขเธชเธณเน€เธฃเนเธ</div>
            <div className="mt-5 space-y-3 text-xl font-bold">
              <div className="flex justify-between gap-4"><span>เน€เธฅเธเธ—เธตเนเธเธดเธฅ</span><span className="text-right">{successSale.receiptNo}</span></div>
              {successSale.cloudReceiptNo && <div className="flex justify-between gap-4"><span>เน€เธฅเธเธ—เธตเน Cloud</span><span className="text-right">{successSale.cloudReceiptNo}</span></div>}
              <div className="flex justify-between gap-4"><span>เธขเธญเธ”เธฃเธงเธก</span><span>{baht(successSale.totalAmount)}</span></div>
              <div className="flex justify-between gap-4"><span>เธงเธดเธเธตเธเธณเธฃเธฐเน€เธเธดเธ</span><span>{successSale.paymentMethod === "CREDIT" ? "เน€เธเธดเธเน€เธเธทเนเธญ" : successSale.paymentMethod === "TRANSFER" ? "เธฃเธฑเธเนเธญเธ" : "เน€เธเธดเธเธชเธ”"}</span></div>
              <div className="flex justify-between gap-4"><span>เธชเธ–เธฒเธเธฐเธเธดเธเธเน</span><span>{successSale.syncStatus === "SYNCED" ? "เธเธดเธเธเนเนเธฅเนเธง" : successSale.syncStatus === "FAILED" ? "เธเธดเธเธเนเนเธกเนเธชเธณเน€เธฃเนเธ" : "เธฃเธญเธเธดเธเธเน Cloud"}</span></div>
              {successSale.paymentMethod === "CASH" && (
                <>
                  <div className="flex justify-between gap-4"><span>เธฃเธฑเธเน€เธเธดเธ</span><span>{baht(successSale.cashReceived ?? 0)}</span></div>
                  <div className="rounded-lg bg-emerald-50 p-4 text-center">
                    <div className="text-lg text-emerald-800">เน€เธเธดเธเธ—เธญเธ</div>
                    <div className="text-4xl font-black text-emerald-700">{baht(successSale.changeAmount ?? 0)}</div>
                  </div>
                </>
              )}
              {successSale.paymentMethod === "CREDIT" && (
                <div className="rounded-lg bg-amber-50 p-4">
                  <div className="flex justify-between gap-4"><span>เธฅเธนเธเธเนเธฒ</span><span className="text-right">{successSale.creditCustomerName}</span></div>
                  <div className="mt-2 flex justify-between gap-4"><span>เธชเธ–เธฒเธเธฐ</span><span className="font-black text-amber-800">เธเนเธฒเธเธเธณเธฃเธฐ</span></div>
                </div>
              )}
            </div>
            <button className="btn btn-primary mt-6 w-full" onClick={() => setSuccessSale(null)} type="button">เธเธดเธ”</button>
          </div>
        </div>
      )}
    </section>
  );
}

