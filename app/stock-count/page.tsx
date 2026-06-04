"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  barcode: string;
  stockQty: number;
  unit: string;
  costPrice: number | null;
};

export default function StockCountPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [countedQty, setCountedQty] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setMessage("โหลดสินค้าไม่สำเร็จ"));
  }, []);

  const matches = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return products.slice(0, 20);
    return products
      .filter((product) => product.name.toLowerCase().includes(text) || product.barcode.includes(text))
      .slice(0, 20);
  }, [products, query]);
  const selected = products.find((product) => product.id === selectedId) ?? null;
  const parsedCount = Number(countedQty);
  const difference = selected && Number.isInteger(parsedCount) ? parsedCount - selected.stockQty : 0;

  async function saveCount(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/stock-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selected.id, countedQty: parsedCount, reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "บันทึกนับสต๊อกไม่สำเร็จ");
      setProducts((items) => items.map((item) => item.id === selected.id ? { ...item, stockQty: parsedCount } : item));
      setMessage(`บันทึกนับสต๊อกแล้ว: ${selected.name} (${difference >= 0 ? "+" : ""}${difference})`);
      setCountedQty("");
      setReason("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกนับสต๊อกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">นับสต๊อก</h1>
        <p className="text-slate-500">ตรวจนับสินค้าจริงและปรับยอดในระบบ</p>
      </div>
      {message && <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 font-black text-teal-800">{message}</div>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="card p-4">
          <label className="block space-y-2">
            <span className="font-black">ค้นหาสินค้า / บาร์โค้ด</span>
            <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="พิมพ์ชื่อหรือบาร์โค้ด" />
          </label>
          <div className="mt-4 max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
            {matches.map((product) => (
              <button
                key={product.id}
                className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3 text-left hover:bg-teal-50 ${selectedId === product.id ? "bg-teal-50" : ""}`}
                onClick={() => {
                  setSelectedId(product.id);
                  setCountedQty(String(product.stockQty));
                }}
                type="button"
              >
                <div>
                  <div className="font-black">{product.name}</div>
                  <div className="text-sm font-bold text-slate-500">{product.barcode}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black">{product.stockQty}</div>
                  <div className="text-xs font-bold text-slate-500">{product.unit}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={saveCount} className="card p-4">
          <h2 className="text-xl font-black">บันทึกปรับสต๊อก</h2>
          {selected ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="font-black">{selected.name}</div>
                <div className="text-sm font-bold text-slate-500">{selected.barcode}</div>
                <div className="mt-2 flex justify-between font-bold"><span>สต๊อกในระบบ</span><span>{selected.stockQty} {selected.unit}</span></div>
              </div>
              <label className="block space-y-1">
                <span className="font-black">จำนวนที่นับได้จริง</span>
                <input className="field" type="number" min="0" step="1" value={countedQty} onChange={(event) => setCountedQty(event.target.value)} required />
              </label>
              <div className={`rounded-lg p-3 font-black ${difference === 0 ? "bg-slate-100 text-slate-700" : difference > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                ส่วนต่าง: {difference >= 0 ? "+" : ""}{difference} {selected.unit}
              </div>
              <label className="block space-y-1">
                <span className="font-black">เหตุผล</span>
                <input className="field" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="เช่น ตรวจนับประจำวัน" />
              </label>
              <button className="btn btn-primary w-full" disabled={saving} type="submit">{saving ? "กำลังบันทึก..." : "บันทึกปรับสต๊อก"}</button>
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-center font-bold text-slate-500">เลือกสินค้าก่อน</div>
          )}
        </form>
      </div>
    </section>
  );
}
