"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { baht } from "@/lib/format";

type Product = {
  id: string;
  barcode: string;
  name: string;
  salePrice: number;
  costPrice: number;
  stockQty: number;
  unit: string;
  isActive: boolean;
};

type CartItem = Product & { quantity: number };
type PromptPayState = { configured: boolean; qrDataUrl?: string; message?: string };
type SaleSuccess = {
  receiptNo: string;
  totalAmount: number;
  paymentMethod: "CASH" | "TRANSFER";
  cashReceived: number | null;
  changeAmount: number | null;
};

export default function PosPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const saleSubmittingRef = useRef(false);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quickSaleProducts, setQuickSaleProducts] = useState<Product[]>([]);
  const [previewProducts, setPreviewProducts] = useState<Product[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSearchedQuery, setPreviewSearchedQuery] = useState("");
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [promptPay, setPromptPay] = useState<PromptPayState | null>(null);
  const [successSale, setSuccessSale] = useState<SaleSuccess | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const loadQuickSaleProducts = useCallback(() => {
    fetch("/api/products?quickSale=true")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setQuickSaleProducts(data);
      })
      .catch(() => setMessage("โหลดปุ่มขายด่วนไม่สำเร็จ"));
  }, []);

  useEffect(() => {
    loadQuickSaleProducts();
  }, [loadQuickSaleProducts]);

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.salePrice * item.quantity, 0), [cart]);
  const cashAmount = Number(cashReceived || 0);
  const validCashAmount = Number.isFinite(cashAmount) ? cashAmount : 0;
  const isCashTooLow = paymentMethod === "CASH" && cashReceived.trim() !== "" && validCashAmount < total;
  const canCompleteSale = cart.length > 0 && !busy && (paymentMethod === "TRANSFER" || (cashReceived.trim() !== "" && Number.isFinite(cashAmount) && cashAmount >= total));
  const change = Math.max(validCashAmount - total, 0);
  const trimmedQuery = query.trim();
  const previewExactProduct = previewProducts.find((product) => product.barcode === trimmedQuery) ?? previewProducts[0];
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
      const isBarcode = /^\d+$/.test(keyword);
      setPreviewLoading(true);
      fetch(`/api/products?${isBarcode ? "barcode" : "search"}=${encodeURIComponent(keyword)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setPreviewProducts((data as Product[]).slice(0, 5));
          } else {
            setPreviewProducts([]);
          }
          setPreviewSearchedQuery(keyword);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setPreviewProducts([]);
            setPreviewSearchedQuery(keyword);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setPreviewLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

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
    if (previewExactProduct && previewSearchedQuery === keyword) {
      addPreviewProduct(previewExactProduct);
      return;
    }
    const isBarcode = /^\d+$/.test(keyword);
    const res = await fetch(`/api/products?${isBarcode ? "barcode" : "search"}=${encodeURIComponent(keyword)}`);
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) {
      setMessage(data.error ?? "ค้นหาสินค้าไม่สำเร็จ");
      inputRef.current?.focus();
      return;
    }
    const products = data as Product[];
    if (products.length === 0) {
      setMessage("ไม่พบสินค้า");
    } else {
      addProduct(products[0]);
      setQuery("");
      setPreviewProducts([]);
      setPreviewSearchedQuery("");
    }
    inputRef.current?.focus();
  }

  function updateQty(id: string, delta: number) {
    setCart((items) =>
      items
        .map((item) => {
          if (item.id !== id) return item;
          const next = item.quantity + delta;
          if (next > item.stockQty) setMessage("สต็อกไม่พอสำหรับสินค้านี้");
          return { ...item, quantity: Math.min(Math.max(next, 1), item.stockQty) };
        })
    );
  }

  async function completeSale() {
    if (saleSubmittingRef.current) return;
    if (cart.length === 0) return setMessage("ไม่มีสินค้าในตะกร้า");
    if (paymentMethod === "CASH" && cashReceived.trim() === "") return setMessage("กรุณาระบุเงินสดที่รับมา");
    if (paymentMethod === "CASH" && !Number.isFinite(cashAmount)) return setMessage("จำนวนเงินสดไม่ถูกต้อง");
    if (paymentMethod === "CASH" && cashAmount < total) return setMessage("เงินรับน้อยกว่ายอดรวม");
    saleSubmittingRef.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          cashReceived: paymentMethod === "CASH" ? cashReceived : undefined,
          items: cart.map((item) => ({ productId: item.id, quantity: item.quantity }))
        })
      });
      const data = await res.json();
      if (!res.ok) return setMessage(data.error ?? "เกิดข้อผิดพลาดฐานข้อมูล");
      setSuccessSale({
        receiptNo: data.receiptNo,
        totalAmount: data.totalAmount,
        paymentMethod: data.paymentMethod,
        cashReceived: data.cashReceived,
        changeAmount: data.changeAmount
      });
      setCart([]);
      setCashReceived("");
      setMessage(`บันทึกการขายสำเร็จ ${data.receiptNo}`);
      loadQuickSaleProducts();
    } catch {
      setMessage("เชื่อมต่อระบบขายไม่สำเร็จ");
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

  function renderPaymentPanel() {
    return (
      <div className="card p-3">
        <div className="text-xl font-black">รับชำระเงิน</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className={`btn min-h-12 text-lg ${paymentMethod === "CASH" ? "btn-primary ring-4 ring-teal-200" : "btn-light"}`} onClick={() => setPaymentMethod("CASH")} type="button">
            เงินสด
          </button>
          <button className={`btn min-h-12 text-lg ${paymentMethod === "TRANSFER" ? "btn-primary ring-4 ring-teal-200" : "btn-light"}`} onClick={() => setPaymentMethod("TRANSFER")} type="button">
            รับโอน
          </button>
        </div>
        <div className="mt-2 rounded-lg bg-slate-100 p-3">
          <div className="text-sm font-black text-slate-600">ยอดรวม</div>
          <div className="text-3xl font-black text-teal-700">{baht(total)}</div>
        </div>
        {paymentMethod === "CASH" && (
          <div className="mt-2 space-y-1.5">
            <label className="font-black">รับเงิน</label>
            <input
              className="field min-h-12 text-xl"
              value={cashReceived}
              onChange={(event) => setCashReceived(event.target.value)}
              onKeyDown={handleCashKeyDown}
              type="number"
              min="0"
              step="0.01"
            />
            {isCashTooLow && <div className="rounded-lg border-2 border-red-200 bg-red-50 p-2 font-black text-red-700">เงินรับน้อยกว่ายอดรวม</div>}
            <div className="rounded-lg border-4 border-emerald-300 bg-emerald-50 p-3">
              <div className="font-black text-emerald-800">เงินทอน</div>
              <div className="text-3xl font-black text-emerald-700">{baht(change)}</div>
            </div>
          </div>
        )}
        {paymentMethod === "TRANSFER" && (
          <div className="mt-2 rounded-lg border-2 border-blue-100 bg-blue-50 p-3 text-center">
            <div className="text-lg font-black text-blue-900">QR พร้อมเพย์</div>
            <div className="font-black text-blue-700">ยอดโอน {baht(total)}</div>
            {promptPay?.configured && promptPay.qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="mx-auto mt-2 max-h-44 rounded-lg bg-white p-2" src={promptPay.qrDataUrl} alt="QR พร้อมเพย์" />
            ) : (
              <div className="mt-2 rounded-lg bg-white p-2 font-bold text-slate-600">{promptPay?.message ?? "ยังไม่ได้ตั้งค่าเลขพร้อมเพย์"}</div>
            )}
          </div>
        )}
        <button className="btn btn-primary mt-3 w-full py-3 text-xl" disabled={!canCompleteSale} onClick={completeSale} type="button">
          {busy ? "กำลังบันทึก..." : "บันทึกการขาย"}
        </button>
        <button
          className="btn btn-light mt-2 w-full py-2 text-base"
          onClick={() => {
            setCart([]);
            setMessage("");
          }}
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
      return <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-500">กำลังค้นหาสินค้า...</div>;
    }

    if (showNoPreviewResult) {
      return <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-black text-amber-800">ไม่พบสินค้า</div>;
    }

    if (previewProducts.length === 0) return null;

    const isExactBarcode = previewProducts.length === 1 && previewProducts[0].barcode === trimmedQuery;
    if (isExactBarcode) {
      const product = previewProducts[0];
      const status = productStatus(product);
      return (
        <button
          className="mt-2 w-full rounded-lg border-2 border-teal-200 bg-teal-50 px-3 py-2 text-left transition hover:border-teal-500"
          onClick={() => addPreviewProduct(product)}
          type="button"
        >
          <div className="text-sm font-black text-teal-800">สินค้าที่พบ</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-lg font-black text-slate-950">{product.name}</span>
            <span className="text-sm font-bold text-slate-500">{product.barcode}</span>
            <span className="text-lg font-black text-teal-700">ราคา {baht(product.salePrice)}</span>
            <span className={`rounded-md px-2 py-1 text-sm font-black ${status.className}`}>{status.label}</span>
          </div>
        </button>
      );
    }

    return (
      <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-sm font-black text-slate-600">สินค้าที่พบ</div>
        <div className="divide-y divide-slate-100">
          {previewProducts.map((product) => {
            const status = productStatus(product);
            return (
              <button
                key={product.id}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 py-2 text-left hover:bg-teal-50"
                onClick={() => addPreviewProduct(product)}
                type="button"
              >
                <div className="min-w-0">
                  <div className="truncate font-black text-slate-950">{product.name}</div>
                  <div className="text-xs font-bold text-slate-500">{product.barcode}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-teal-700">ราคา {baht(product.salePrice)}</div>
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
          <h1 className="text-2xl font-black">ขายสินค้า</h1>
          <p className="mt-1 font-bold text-slate-600">สแกนบาร์โค้ดหรือพิมพ์ชื่อสินค้า แล้วกด Enter</p>
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
                placeholder="สแกนบาร์โค้ด หรือพิมพ์ชื่อสินค้า"
              />
            </div>
            <button className="btn btn-primary min-h-14 min-w-32 text-xl" type="submit">
              เพิ่ม
            </button>
          </div>
          {renderProductPreview()}
        </form>
        <div className="xl:hidden">{renderPaymentPanel()}</div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <div className="text-xl font-black">ตะกร้าสินค้า</div>
            <div className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">{cart.length} รายการ</div>
          </div>
          <div className="max-h-[36vh] min-h-28 overflow-y-auto xl:max-h-[42vh]">
            {cart.length === 0 ? (
              <div className="px-4 py-6 text-center font-bold text-slate-500">ยังไม่มีสินค้าในตะกร้า</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black">{item.name}</div>
                      <div className="mt-0.5 text-xs font-bold text-slate-500">{item.barcode} | คงเหลือ {item.stockQty}</div>
                      <div className="mt-0.5 text-xs font-bold text-slate-700">{baht(item.salePrice)} x {item.quantity}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-base font-black text-teal-700">{baht(item.salePrice * item.quantity)}</div>
                      <div className="flex gap-1">
                        <button className="btn btn-light touch-icon-button" onClick={() => updateQty(item.id, -1)} type="button" title="ลดจำนวน">
                          <Minus size={16} />
                        </button>
                        <div className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-slate-100 px-2 text-sm font-black">{item.quantity}</div>
                        <button className="btn btn-light touch-icon-button" onClick={() => updateQty(item.id, 1)} type="button" title="เพิ่มจำนวน">
                          <Plus size={16} />
                        </button>
                        <button
                          className="btn btn-danger touch-icon-button"
                          onClick={() => setCart((items) => items.filter((entry) => entry.id !== item.id))}
                          type="button"
                          title="ลบสินค้า"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-3 py-2 text-xl font-black">ปุ่มขายด่วน</div>
          {quickSaleProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5 p-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {quickSaleProducts.map((product) => {
                const isOut = product.stockQty <= 0;
                return (
                  <button
                    key={product.id}
                    className={`min-h-28 overflow-hidden rounded-lg border-2 text-left font-black transition ${
                      isOut
                        ? "border-slate-200 bg-slate-100 text-slate-400 opacity-60"
                        : "border-teal-200 bg-white text-slate-950 hover:border-teal-500 hover:bg-teal-50"
                    }`}
                    disabled={isOut}
                    onClick={() => addProduct(product)}
                    type="button"
                  >
                    <div className="flex min-h-28 flex-col justify-between gap-1.5 p-2.5">
                      <div className="line-clamp-2 text-lg leading-tight">{product.name}</div>
                      <div className="text-xl text-teal-700">{baht(product.salePrice)}</div>
                      <div className={`rounded-md px-2 py-1 text-xs ${isOut ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-800"}`}>
                        {isOut ? "หมด" : `คงเหลือ ${product.stockQty} ${product.unit}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-6 text-center font-bold text-slate-500">ยังไม่มีสินค้าปุ่มขายด่วน</div>
          )}
        </div>
        {message && <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2 font-black text-amber-900">{message}</div>}
      </div>
      <aside className="hidden xl:sticky xl:top-3 xl:block xl:self-start">
        {renderPaymentPanel()}
      </aside>
      {successSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="card w-full max-w-lg p-6">
            <div className="text-3xl font-black text-teal-700">บันทึกการขายสำเร็จ</div>
            <div className="mt-5 space-y-3 text-xl font-bold">
              <div className="flex justify-between gap-4"><span>เลขที่บิล</span><span className="text-right">{successSale.receiptNo}</span></div>
              <div className="flex justify-between gap-4"><span>ยอดรวม</span><span>{baht(successSale.totalAmount)}</span></div>
              {successSale.paymentMethod === "CASH" && (
                <>
                  <div className="flex justify-between gap-4"><span>รับเงิน</span><span>{baht(successSale.cashReceived ?? 0)}</span></div>
                  <div className="rounded-lg bg-emerald-50 p-4 text-center">
                    <div className="text-lg text-emerald-800">เงินทอน</div>
                    <div className="text-4xl font-black text-emerald-700">{baht(successSale.changeAmount ?? 0)}</div>
                  </div>
                </>
              )}
            </div>
            <button className="btn btn-primary mt-6 w-full" onClick={() => setSuccessSale(null)} type="button">ปิด</button>
          </div>
        </div>
      )}
    </section>
  );
}
