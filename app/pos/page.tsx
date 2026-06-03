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
  const [cacheStatus, setCacheStatus] = useState("กำลังโหลดข้อมูลสินค้าในเครื่อง");
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [pendingSyncError, setPendingSyncError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
      setCacheStatus("โหลดข้อมูลสินค้าในเครื่องแล้ว");
    }

    if (!navigator.onLine) {
      setOnline(false);
      setCacheStatus(hasCache ? "ใช้ข้อมูลในเครื่อง" : "ยังไม่มีข้อมูลสินค้าในเครื่อง กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อโหลดข้อมูลครั้งแรก");
      return;
    }

    try {
      setCacheStatus("กำลังอัปเดตข้อมูลจาก Cloud");
      const res = await fetch("/api/products");
      const cloudProducts = await res.json();
      if (!res.ok || !Array.isArray(cloudProducts)) throw new Error("โหลดสินค้าไม่สำเร็จ");
      const pendingCount = await getPendingSyncCount();
      const localById = new Map(cachedProducts.map((product) => [product.id, product]));
      const merged = (cloudProducts as Product[]).map((product) => {
        const local = localById.get(product.id);
        return pendingCount > 0 && local ? { ...product, stockQty: local.stockQty } : product;
      });
      await putLocalProducts(merged);
      setProducts(merged);
      setCacheStatus("โหลดข้อมูลสินค้าในเครื่องแล้ว");
    } catch {
      setCacheStatus(hasCache ? "ใช้ข้อมูลในเครื่อง" : "ยังไม่มีข้อมูลสินค้าในเครื่อง กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อโหลดข้อมูลครั้งแรก");
    }
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    loadProductCache().catch(() => setCacheStatus("ใช้ข้อมูลในเครื่อง"));
    refreshSyncStatus();
    const onOnline = () => {
      setOnline(true);
      loadProductCache().catch(() => undefined);
      syncPendingSales();
    };
    const onOffline = () => {
      setOnline(false);
      setCacheStatus("ใช้ข้อมูลในเครื่อง");
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
        if (!controller.signal.aborted) setPromptPay({ configured: false, message: "โหลด QR พร้อมเพย์ไม่สำเร็จ" });
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
    if (!product.isActive) return setMessage("สินค้าถูกปิดการขาย");
    const found = cart.find((item) => item.id === product.id);
    if (found && found.quantity + 1 > product.stockQty) {
      return setMessage("สต็อกไม่พอสำหรับสินค้านี้");
    }
    if (!found && product.stockQty < 1) {
      return setMessage("สต๊อกหมด");
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
          if (!res.ok) throw new Error(data.error ?? "ซิงก์ Cloud ไม่สำเร็จ");
          await markSaleSynced(item.id, data.id, data.receiptNo);
          setSuccessSale((current) => current && item.id === current.localId ? { ...current, syncStatus: "SYNCED", cloudReceiptNo: data.receiptNo } : current);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "ซิงก์ Cloud ไม่สำเร็จ";
          await markSaleSyncFailed(item.id, errorMessage);
          setMessage(`ซิงก์ Cloud ไม่สำเร็จ: ${errorMessage}`);
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
    if (!product.isActive) return { label: "สินค้าถูกปิดการขาย", className: "bg-red-50 text-red-700" };
    if (product.stockQty <= 0) return { label: "สต๊อกหมด", className: "bg-red-50 text-red-700" };
    return { label: `คงเหลือ ${product.stockQty} ${product.unit}`, className: "bg-emerald-50 text-emerald-700" };
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
      setMessage("ไม่พบสินค้า");
    } else if (!productToAdd) {
      setPreviewProducts(sortedProducts);
      setPreviewSearchedQuery(keyword);
      setMessage(isBarcode ? "เลือกสินค้าใกล้เคียงก่อนเพิ่ม" : "เลือกสินค้าที่ต้องการก่อนเพิ่ม");
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
        if (next > item.stockQty) setMessage("สต็อกไม่พอสำหรับสินค้านี้");
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
      setMessage(`สต๊อกคงเหลือไม่พอ (มี ${item.stockQty} ${item.unit})`);
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
    if (cart.length === 0) return setMessage("ไม่มีสินค้าในตะกร้า");
    if (paymentMethod === "CASH" && cashReceived.trim() === "") return setMessage("กรุณาระบุเงินสดที่รับมา");
    if (paymentMethod === "CASH" && !Number.isFinite(cashAmount)) return setMessage("จำนวนเงินสดไม่ถูกต้อง");
    if (paymentMethod === "CASH" && cashAmount < total) return setMessage("เงินรับน้อยกว่ายอดรวม");
    if (paymentMethod === "CREDIT" && creditCustomerName.trim() === "") return setMessage("กรุณาใส่ชื่อลูกค้าเงินเชื่อ");
    saleSubmittingRef.current = true;
    setBusy(true);
    try {
      const localProducts = await getAllLocalProducts();
      const localProductMap = new Map(localProducts.map((product) => [product.id, product]));
      const localCart = cart.map((item) => ({ ...(localProductMap.get(item.id) ?? item), quantity: item.quantity }));
      for (const item of localCart) {
        if (item.stockQty < item.quantity) throw new Error(`${item.name} มีสต็อกในเครื่องไม่พอ`);
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
      setMessage(`บันทึกในเครื่องแล้ว ${localSaved.sale.receiptNo}`);
      refreshSyncStatus();
      if (navigator.onLine) window.setTimeout(() => syncPendingSales(), 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกในเครื่องไม่สำเร็จ");
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
    return `min-h-16 rounded-xl border-2 px-3 py-2 text-xl font-black transition active:scale-95 ${
      selected ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white text-slate-900 hover:border-teal-500 hover:bg-teal-50"
    }`;
  }

  function renderPaymentPanel() {
    return (
      <div className="card p-4">
        <div className="text-2xl font-black">รับชำระเงิน</div>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <button className={`btn min-h-16 px-2 text-lg ${paymentMethod === "CASH" ? "btn-primary ring-4 ring-teal-200" : "btn-light"}`} disabled={busy} onClick={() => setPaymentMethod("CASH")} type="button">
            เงินสด
          </button>
          <button className={`btn min-h-16 px-2 text-lg ${paymentMethod === "TRANSFER" ? "btn-primary ring-4 ring-teal-200" : "btn-light"}`} disabled={busy} onClick={() => setPaymentMethod("TRANSFER")} type="button">
            รับโอน
          </button>
          <button className={`btn min-h-16 px-2 text-lg ${paymentMethod === "CREDIT" ? "btn-primary ring-4 ring-teal-200" : "btn-light"}`} disabled={busy} onClick={() => setPaymentMethod("CREDIT")} type="button">
            เงินเชื่อ
          </button>
        </div>
        <div className="mt-3 rounded-xl bg-teal-50 border border-teal-100 p-4">
          <div className="text-base font-black text-teal-700">ยอดรวมทั้งสิ้น</div>
          <div className="text-5xl font-black text-teal-700 mt-1">{baht(total)}</div>
        </div>
        {paymentMethod === "CASH" && (
          <div className="mt-3 space-y-3">
            <label className="text-xl font-black">รับเงินมา</label>
            <input
              className="field text-2xl"
              value={cashReceived}
              onChange={(event) => setCashReceived(event.target.value)}
              onKeyDown={handleCashKeyDown}
              disabled={busy}
              type="number"
              min="0"
              step="0.01"
            />
            <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-base font-black text-slate-700">รับเงินด่วน</div>
              <div className="grid grid-cols-4 gap-2">
                <button className={quickCashButtonClass(total)} disabled={busy || total <= 0} onClick={() => setQuickCashAmount(total)} type="button">
                  พอดี
                </button>
                {quickCashAmounts.map((amount) => (
                  <button key={amount} className={quickCashButtonClass(amount)} disabled={busy} onClick={() => setQuickCashAmount(amount)} type="button">
                    {amount}
                  </button>
                ))}
              </div>
            </div>
            {isCashTooLow && (
              <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-xl font-black text-red-700">
                เงินรับน้อยกว่ายอดรวม
              </div>
            )}
            <div className="rounded-xl border-4 border-emerald-400 bg-emerald-50 p-4">
              <div className="text-lg font-black text-emerald-800">เงินทอน</div>
              <div className="text-5xl font-black text-emerald-700">{baht(change)}</div>
            </div>
          </div>
        )}
        {paymentMethod === "TRANSFER" && (
          <div className="mt-3 rounded-xl border-2 border-blue-100 bg-blue-50 p-4 text-center">
            <div className="text-xl font-black text-blue-900">QR พร้อมเพย์</div>
            <div className="mt-1 text-lg font-black text-blue-700">ยอดโอน {baht(total)}</div>
            {promptPay?.configured && promptPay.qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="mx-auto mt-3 max-h-52 rounded-xl bg-white p-2 shadow" src={promptPay.qrDataUrl} alt="QR พร้อมเพย์" />
            ) : (
              <div className="mt-3 rounded-xl bg-white p-3 text-lg font-bold text-slate-600">{promptPay?.message ?? "ยังไม่ได้ตั้งค่าเลขพร้อมเพย์"}</div>
            )}
          </div>
        )}
        {paymentMethod === "CREDIT" && (
          <div className="mt-3 space-y-3 rounded-xl border-2 border-amber-100 bg-amber-50 p-4">
            <div className="text-xl font-black text-amber-900">ขายเงินเชื่อ</div>
            <label className="block space-y-2">
              <span className="text-lg font-black">ชื่อลูกค้า</span>
              <input className="field" value={creditCustomerName} onChange={(event) => setCreditCustomerName(event.target.value)} disabled={busy} />
            </label>
            <label className="block space-y-2">
              <span className="text-lg font-black">เบอร์โทร (ไม่บังคับ)</span>
              <input className="field" value={creditCustomerPhone} onChange={(event) => setCreditCustomerPhone(event.target.value)} disabled={busy} />
            </label>
            <label className="block space-y-2">
              <span className="text-lg font-black">หมายเหตุ (ไม่บังคับ)</span>
              <input className="field" value={creditNote} onChange={(event) => setCreditNote(event.target.value)} disabled={busy} />
            </label>
            {creditNameMissing && (
              <div className="rounded-xl border-2 border-amber-300 bg-white p-3 text-xl font-black text-amber-800">
                กรุณาใส่ชื่อลูกค้าเงินเชื่อ
              </div>
            )}
          </div>
        )}
        <button className="btn btn-primary mt-4 w-full py-4 text-2xl" disabled={!canCompleteSale} onClick={completeSale} type="button">
          {busy ? "กำลังบันทึก..." : "บันทึกการขาย"}
        </button>
        <button
          className="btn btn-light mt-2 w-full py-3 text-xl"
          onClick={() => {
            setCart([]);
            setQtyDraft({});
            setMessage("");
          }}
          disabled={busy}
          type="button"
        >
          ยกเลิกตะกร้า
        </button>
      </div>
    );
  }

  function renderProductPreview() {
    if (!trimmedQuery) return null;

    if (previewLoading) {
      return <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-lg font-bold text-slate-500">กำลังค้นหาสินค้า...</div>;
    }

    if (showNoPreviewResult) {
      return (
        <div className="mt-3 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-xl font-black text-amber-800">
          {isNumericSearch ? "ไม่พบสินค้าใกล้เคียง" : "ไม่พบสินค้า"}
        </div>
      );
    }

    if (previewProducts.length === 0) return null;

    if (previewExactProduct) {
      const product = previewExactProduct;
      const status = productStatus(product);
      return (
        <button
          className="mt-3 w-full rounded-xl border-2 border-teal-300 bg-teal-50 px-4 py-3 text-left transition hover:border-teal-500 active:scale-99"
          onClick={() => addPreviewProduct(product)}
          disabled={busy}
          type="button"
        >
          <div className="text-base font-black text-teal-700">พบสินค้า — กด Enter หรือกดที่นี่เพื่อเพิ่ม</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-xl font-black text-slate-950">{product.name}</span>
            <span className="text-base font-bold text-slate-500">{product.barcode}</span>
            <span className="text-xl font-black text-teal-700">ราคา {baht(product.salePrice)}</span>
            <span className={`rounded-lg px-3 py-1 text-base font-black ${status.className}`}>{status.label}</span>
          </div>
        </button>
      );
    }

    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-base font-black text-slate-600">
          {isNumericSearch ? "สินค้าใกล้เคียง" : "สินค้าที่พบ"}
        </div>
        <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
          {previewProducts.slice(0, 8).map((product) => {
            const status = productStatus(product);
            return (
              <button
                key={product.id}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-left hover:bg-teal-50 active:bg-teal-100"
                onClick={() => addPreviewProduct(product)}
                disabled={busy}
                type="button"
              >
                <div className="min-w-0">
                  <div className="truncate text-lg font-black text-slate-950">{product.name}</div>
                  <div className="text-sm font-bold text-slate-500">{product.barcode}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-teal-700">{baht(product.salePrice)}</div>
                  <div className={`mt-1 rounded-lg px-2 py-1 text-sm font-black ${status.className}`}>{status.label}</div>
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
          <h1 className="text-3xl font-black">ขายสินค้า</h1>
          <p className="mt-1 text-lg font-bold text-slate-600">สแกนบาร์โค้ดหรือพิมพ์ชื่อสินค้า แล้วกด Enter</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-base font-black">
            <span className={`rounded-md px-2 py-1 ${online ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{online ? "ออนไลน์" : "ออฟไลน์"}</span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">รอซิงก์ {pendingSyncCount} รายการ</span>
            {pendingSyncError && <span className="rounded-md bg-red-50 px-2 py-1 text-red-700">ซิงก์ล่าสุด: {pendingSyncError}</span>}
            <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">{cacheStatus}</span>
            {lastSyncAt && <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">ซิงก์ล่าสุด: {new Date(lastSyncAt).toLocaleString("th-TH")}</span>}
            <button className="rounded-md bg-teal-600 px-3 py-1 text-white disabled:opacity-50" disabled={!online || syncBusy} onClick={syncPendingSales} type="button">
              {syncBusy ? "กำลังซิงก์ Cloud" : "ซิงก์ข้อมูลตอนนี้"}
            </button>
          </div>
        </div>
        <form onSubmit={handleSearch} className="card p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={28} />
              <input
                ref={inputRef}
                className="field pl-14 text-2xl"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="สแกนบาร์โค้ด หรือพิมพ์ชื่อสินค้า"
                disabled={busy}
              />
            </div>
            <button className="btn btn-primary min-w-36 text-2xl" disabled={busy} type="submit">
              เพิ่ม
            </button>
          </div>
          {renderProductPreview()}
        </form>
        <div className="xl:hidden">{renderPaymentPanel()}</div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="text-2xl font-black">ตะกร้าสินค้า</div>
            <div className="rounded-xl bg-slate-100 px-4 py-2 text-base font-black text-slate-700">{cart.length} รายการ</div>
          </div>
          <div className="max-h-[36vh] min-h-28 overflow-y-auto xl:max-h-[42vh]">
            {cart.length === 0 ? (
              <div className="px-4 py-8 text-center text-lg font-bold text-slate-500">ยังไม่มีสินค้าในตะกร้า</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_100px_auto_auto]">
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-base font-black">{item.name}</div>
                      <div className="mt-0.5 truncate text-sm font-bold text-slate-500">คงเหลือ {item.stockQty} {item.unit}</div>
                    </div>
                    <div className="hidden text-right text-sm font-bold text-slate-600 sm:block">
                      {baht(item.salePrice)} x {item.quantity}
                    </div>
                    <div className="text-right text-lg font-black text-teal-700">{baht(item.salePrice * item.quantity)}</div>
                    <div className="col-span-2 flex justify-end gap-2 sm:col-span-1">
                        <button className="btn btn-light touch-icon-button" disabled={busy} onClick={() => updateQty(item.id, -1)} type="button" title="ลดจำนวน">
                          <Minus size={22} />
                        </button>
                        <input
                          className="h-[3.25rem] w-16 rounded-xl bg-slate-100 text-center text-lg font-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          disabled={busy}
                          value={qtyDraft[item.id] !== undefined ? qtyDraft[item.id] : String(item.quantity)}
                          onChange={(e) => setQtyDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          onBlur={() => commitQty(item)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
                          title={`จำนวน (สูงสุด ${item.stockQty})`}
                        />
                        <button className="btn btn-light touch-icon-button" disabled={busy} onClick={() => updateQty(item.id, 1)} type="button" title="เพิ่มจำนวน">
                          <Plus size={22} />
                        </button>
                        <button
                          className="btn btn-danger touch-icon-button"
                          disabled={busy}
                          onClick={() => {
                            setQtyDraft((prev) => { const next = { ...prev }; delete next[item.id]; return next; });
                            setCart((items) => items.filter((entry) => entry.id !== item.id));
                          }}
                          type="button"
                          title="ลบสินค้า"
                        >
                          <Trash2 size={22} />
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 text-2xl font-black">ปุ่มขายด่วน</div>
          {quickSaleProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {quickSaleProducts.map((product) => {
                const isOut = product.stockQty <= 0;
                return (
                  <button
                    key={product.id}
                    className={`min-h-36 overflow-hidden rounded-xl border-2 text-left font-black transition active:scale-95 ${
                      isOut
                        ? "border-slate-200 bg-slate-100 text-slate-400 opacity-60"
                        : "border-teal-200 bg-white text-slate-950 hover:border-teal-500 hover:bg-teal-50 shadow-sm"
                    }`}
                    disabled={isOut || busy}
                    onClick={() => addProduct(product)}
                    type="button"
                  >
                    <div className="flex min-h-36 flex-col justify-between gap-2 p-3">
                      <div className="line-clamp-2 text-xl leading-tight">{product.name}</div>
                      <div className="text-2xl font-black text-teal-700">{baht(product.salePrice)}</div>
                      <div className={`rounded-lg px-2 py-1.5 text-sm font-black ${isOut ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-800"}`}>
                        {isOut ? "หมดแล้ว" : `คงเหลือ ${product.stockQty} ${product.unit}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-lg font-bold text-slate-500">ยังไม่มีสินค้าปุ่มขายด่วน</div>
          )}
        </div>
        {message && <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-xl font-black text-amber-900">{message}</div>}
      </div>
      <aside className="hidden xl:sticky xl:top-3 xl:block xl:self-start">
        {renderPaymentPanel()}
      </aside>
      {busy && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4">
          <div className="card w-full max-w-sm p-6 text-center shadow-2xl">
            <LoaderCircle className="mx-auto animate-spin text-teal-700" size={56} strokeWidth={2.6} />
            <div className="mt-4 text-2xl font-black text-slate-950">กำลังบันทึกในเครื่อง...</div>
            <div className="mt-2 font-bold text-slate-600">กรุณารอสักครู่ ห้ามปิดหน้านี้</div>
          </div>
        </div>
      )}
      {successSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="card w-full max-w-lg p-7">
            <div className="mb-5 text-4xl font-black text-teal-700">บันทึกการขายสำเร็จ ✓</div>
            <div className="space-y-3 text-xl font-bold">
              <div className="flex justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-slate-600">เลขที่บิล</span>
                <span className="font-black text-slate-950">{successSale.receiptNo}</span>
              </div>
              <div className="flex justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-slate-600">ยอดรวม</span>
                <span className="font-black text-teal-700">{baht(successSale.totalAmount)}</span>
              </div>
              <div className="flex justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-slate-600">ชำระด้วย</span>
                <span className="font-black">{successSale.paymentMethod === "CREDIT" ? "เงินเชื่อ" : successSale.paymentMethod === "TRANSFER" ? "รับโอน" : "เงินสด"}</span>
              </div>
              {successSale.paymentMethod === "CASH" && (
                <>
                  <div className="flex justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
                    <span className="text-slate-600">รับเงินมา</span>
                    <span className="font-black">{baht(successSale.cashReceived ?? 0)}</span>
                  </div>
                  <div className="rounded-2xl border-4 border-emerald-400 bg-emerald-50 p-5 text-center">
                    <div className="text-xl text-emerald-700">เงินทอน</div>
                    <div className="text-6xl font-black text-emerald-700">{baht(successSale.changeAmount ?? 0)}</div>
                  </div>
                </>
              )}
              {successSale.paymentMethod === "CREDIT" && (
                <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-4">
                  <div className="flex justify-between gap-4"><span>ลูกค้า</span><span className="text-right font-black text-amber-900">{successSale.creditCustomerName}</span></div>
                  <div className="mt-2 flex justify-between gap-4"><span>สถานะ</span><span className="font-black text-amber-800">ค้างชำระ</span></div>
                </div>
              )}
            </div>
            <button className="btn btn-primary mt-6 w-full py-4 text-2xl" onClick={() => setSuccessSale(null)} type="button">
              ปิด
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
