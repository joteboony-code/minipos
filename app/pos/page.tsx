"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

export default function PosPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.salePrice * item.quantity, 0), [cart]);
  const cashAmount = Number(cashReceived || 0);
  const change = Math.max((Number.isFinite(cashAmount) ? cashAmount : 0) - total, 0);

  function addProduct(product: Product) {
    if (!product.isActive) return setMessage("สินค้านี้ถูกปิดใช้งาน");
    const found = cart.find((item) => item.id === product.id);
    if (found && found.quantity + 1 > product.stockQty) {
      return setMessage("สต็อกไม่พอสำหรับสินค้านี้");
    }
    if (!found && product.stockQty < 1) {
      return setMessage("สินค้าหมดสต็อก");
    }
    setCart((items) =>
      found
        ? items.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...items, { ...product, quantity: 1 }]
    );
    setMessage("");
  }

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const keyword = query.trim();
    if (!keyword) return;
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
      setMessage("ไม่พบบาร์โค้ดหรือชื่อสินค้านี้");
    } else {
      addProduct(products[0]);
      setQuery("");
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
    if (cart.length === 0) return setMessage("ไม่มีสินค้าในตะกร้า");
    if (paymentMethod === "CASH" && cashReceived.trim() === "") return setMessage("กรุณาระบุเงินสดที่รับมา");
    if (paymentMethod === "CASH" && !Number.isFinite(cashAmount)) return setMessage("จำนวนเงินสดไม่ถูกต้อง");
    if (paymentMethod === "CASH" && cashAmount < total) return setMessage("เงินสดที่รับมาน้อยกว่ายอดรวม");
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
      setCart([]);
      setCashReceived("");
      setMessage(`บันทึกการขายสำเร็จ ${data.receiptNo}`);
    } catch {
      setMessage("เชื่อมต่อระบบขายไม่สำเร็จ");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_500px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-black">ขายสินค้า</h1>
          <p className="mt-2 text-xl font-bold text-slate-600">สแกนบาร์โค้ดหรือพิมพ์ชื่อสินค้า แล้วกด Enter</p>
        </div>
        <form onSubmit={handleSearch} className="card flex gap-3 p-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={30} />
            <input
              ref={inputRef}
              className="field min-h-20 pl-14 text-2xl"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="สแกนบาร์โค้ด หรือพิมพ์ชื่อสินค้า"
            />
          </div>
          <button className="btn btn-primary min-w-36 text-xl" type="submit">
            เพิ่ม
          </button>
        </form>
        {message && <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-5 py-4 text-xl font-black text-amber-900">{message}</div>}
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 text-2xl font-black">ตะกร้าสินค้า</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-lg">
              <thead className="bg-slate-50 text-left text-slate-700">
                <tr>
                  <th className="px-5 py-4">สินค้า</th>
                  <th className="px-5 py-4 text-right">ราคา</th>
                  <th className="px-5 py-4 text-center">จำนวน</th>
                  <th className="px-5 py-4 text-right">รวม</th>
                  <th className="px-5 py-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-5 py-4">
                      <div className="text-xl font-black">{item.name}</div>
                      <div className="mt-1 text-base font-bold text-slate-500">
                        {item.barcode} | คงเหลือ {item.stockQty}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-bold">{baht(item.salePrice)}</td>
                    <td className="px-5 py-4 text-center text-2xl font-black">{item.quantity}</td>
                    <td className="px-5 py-4 text-right text-xl font-black">{baht(item.salePrice * item.quantity)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-3">
                        <button className="btn btn-light touch-icon-button" onClick={() => updateQty(item.id, -1)} type="button" title="ลดจำนวน">
                          <Minus size={24} />
                        </button>
                        <button className="btn btn-light touch-icon-button" onClick={() => updateQty(item.id, 1)} type="button" title="เพิ่มจำนวน">
                          <Plus size={24} />
                        </button>
                        <button
                          className="btn btn-danger touch-icon-button"
                          onClick={() => setCart((items) => items.filter((entry) => entry.id !== item.id))}
                          type="button"
                          title="ลบสินค้า"
                        >
                          <Trash2 size={24} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td className="px-5 py-14 text-center text-xl font-bold text-slate-500" colSpan={5}>
                      ยังไม่มีสินค้าในตะกร้า
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <aside className="card h-fit p-6">
        <div className="text-2xl font-black">รับชำระเงิน</div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className={`btn min-h-16 text-xl ${paymentMethod === "CASH" ? "btn-primary" : "btn-light"}`} onClick={() => setPaymentMethod("CASH")} type="button">
            เงินสด
          </button>
          <button className={`btn min-h-16 text-xl ${paymentMethod === "TRANSFER" ? "btn-primary" : "btn-light"}`} onClick={() => setPaymentMethod("TRANSFER")} type="button">
            รับโอน
          </button>
        </div>
        <div className="mt-6 rounded-lg bg-slate-100 p-5">
          <div className="text-lg font-black text-slate-600">ยอดรวม</div>
          <div className="mt-1 text-5xl font-black text-teal-700">{baht(total)}</div>
        </div>
        {paymentMethod === "CASH" && (
          <div className="mt-5 space-y-3">
            <label className="text-xl font-black">รับเงินสด</label>
            <input className="field min-h-16 text-2xl" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} type="number" min="0" step="0.01" />
            <div className="rounded-lg bg-emerald-50 p-4 text-2xl font-black text-emerald-800">เงินทอน {baht(change)}</div>
          </div>
        )}
        <button className="btn btn-primary mt-6 w-full py-5 text-2xl" disabled={busy} onClick={completeSale} type="button">
          บันทึกการขาย
        </button>
        <button
          className="btn btn-light mt-4 w-full py-5 text-xl"
          onClick={() => {
            setCart([]);
            setMessage("");
          }}
          type="button"
        >
          ยกเลิกตะกร้า
        </button>
      </aside>
    </section>
  );
}
