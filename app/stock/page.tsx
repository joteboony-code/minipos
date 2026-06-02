"use client";

import { useEffect, useState } from "react";
import { thDate } from "@/lib/format";

type Product = { id: string; name: string; barcode: string; stockQty: number };
type Movement = { id: string; type: string; quantityChange: number; beforeQty: number; afterQty: number; note?: string; createdAt: string; product: Product };

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"RECEIVE" | "ADJUST">("RECEIVE");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const [productsRes, stockRes] = await Promise.all([fetch("/api/products"), fetch("/api/stock")]);
    setProducts(await productsRes.json());
    setMovements(await stockRes.json());
  }

  useEffect(() => { load(); }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, type, quantity: Number(quantity), note })
    });
    const data = await res.json();
    setMessage(res.ok ? "บันทึกสต็อกแล้ว" : data.error);
    if (res.ok) {
      setQuantity("1");
      setNote("");
      await load();
    }
  }

  return (
    <section className="space-y-5">
      <div><h1 className="text-2xl font-black">สต๊อก</h1><p className="text-slate-500">รับสินค้า ปรับยอด และดูประวัติความเคลื่อนไหว</p></div>
      {message && <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 font-bold text-teal-800">{message}</div>}
      <form onSubmit={save} className="card grid gap-3 p-4 md:grid-cols-5">
        <select className="field md:col-span-2" value={productId} onChange={(e) => setProductId(e.target.value)} required>
          <option value="">เลือกสินค้า</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.stockQty})</option>)}
        </select>
        <select className="field" value={type} onChange={(e) => setType(e.target.value as "RECEIVE" | "ADJUST")}>
          <option value="RECEIVE">รับสินค้าเข้า</option>
          <option value="ADJUST">ปรับยอด</option>
        </select>
        <input className="field" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={type === "ADJUST" ? "เพิ่ม/ลด เช่น -2" : "จำนวนรับเข้า"} />
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ" />
        <button className="btn btn-primary md:col-span-5" type="submit">บันทึกสต็อก</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[840px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-4 py-3">เวลา</th><th className="px-4 py-3">สินค้า</th><th className="px-4 py-3">ประเภท</th><th className="px-4 py-3 text-right">เปลี่ยนแปลง</th><th className="px-4 py-3 text-right">ก่อน</th><th className="px-4 py-3 text-right">หลัง</th><th className="px-4 py-3">หมายเหตุ</th></tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{thDate(movement.createdAt)}</td>
                <td className="px-4 py-3 font-bold">{movement.product.name}</td>
                <td className="px-4 py-3">{movement.type}</td>
                <td className="px-4 py-3 text-right font-black">{movement.quantityChange}</td>
                <td className="px-4 py-3 text-right">{movement.beforeQty}</td>
                <td className="px-4 py-3 text-right">{movement.afterQty}</td>
                <td className="px-4 py-3">{movement.note ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
