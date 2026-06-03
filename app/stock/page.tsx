"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Search, X } from "lucide-react";
import { baht, thDate } from "@/lib/format";
import { getAllLocalProducts, getPendingSyncCount, putLocalProducts, type LocalProduct } from "@/lib/local-pos-db";

type Product = {
  id: string;
  name: string;
  barcode: string;
  costPrice: number | null;
  salePrice: number;
  stockQty: number;
  unit: string;
  isActive: boolean;
};
type Movement = {
  id: string;
  type: string;
  quantityChange: number;
  beforeQty: number;
  afterQty: number;
  note?: string;
  createdAt: string;
  product: Product;
};

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"RECEIVE" | "ADJUST">("RECEIVE");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [receiveProduct, setReceiveProduct] = useState<Product | null>(null);
  const [receiveQty, setReceiveQty] = useState("1");
  const [receiveCost, setReceiveCost] = useState("0");
  const [receiveNote, setReceiveNote] = useState("");
  const [receiveSaving, setReceiveSaving] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const receiveQtyRef = useRef<HTMLInputElement>(null);
  const receiveSavingRef = useRef(false);
  const barcodeLookupRef = useRef("");

  async function syncLocalProductCache(latestMovement?: Movement) {
    const productsRes = await fetch("/api/products");
    const cloudProducts = await productsRes.json();
    if (!productsRes.ok || !Array.isArray(cloudProducts)) return;

    const [pendingCount, localProducts] = await Promise.all([getPendingSyncCount(), getAllLocalProducts()]);
    const localById = new Map(localProducts.map((product) => [product.id, product]));
    const merged = (cloudProducts as LocalProduct[]).map((product) => {
      const local = localById.get(product.id);
      if (pendingCount <= 0 || !local) return product;
      const stockQty = latestMovement?.product.id === product.id ? local.stockQty + latestMovement.quantityChange : local.stockQty;
      return { ...product, stockQty };
    });

    await putLocalProducts(merged);
    setProducts(merged as Product[]);
  }

  async function load() {
    const [productsRes, stockRes] = await Promise.all([fetch("/api/products"), fetch("/api/stock")]);
    setProducts(await productsRes.json());
    setMovements(await stockRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!receiveProduct) return;
    window.setTimeout(() => receiveQtyRef.current?.focus(), 50);
  }, [receiveProduct]);

  useEffect(() => {
    const value = barcode.trim();
    if (!value || receiveProduct) return;
    const timer = window.setTimeout(() => {
      const product = products.find((entry) => entry.barcode === value);
      if (!product || barcodeLookupRef.current === value) return;
      barcodeLookupRef.current = value;
      openReceiveModal(product);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [barcode, products, receiveProduct]);

  const receiveTotal = useMemo(() => {
    const qty = Number(receiveQty);
    const unitCost = Number(receiveCost);
    return Number.isFinite(qty) && Number.isFinite(unitCost) ? qty * unitCost : 0;
  }, [receiveCost, receiveQty]);

  function openReceiveModal(product: Product) {
    if (!product.isActive) {
      setMessage("สินค้าถูกปิดการใช้งาน");
      return;
    }
    setReceiveProduct(product);
    setReceiveQty("1");
    setReceiveCost(String(product.costPrice ?? 0));
    setReceiveNote("");
    setMessage("");
  }

  function closeReceiveModal() {
    setReceiveProduct(null);
    setReceiveSaving(false);
    receiveSavingRef.current = false;
    barcodeInputRef.current?.focus();
  }

  function findBarcodeProduct(event: React.FormEvent) {
    event.preventDefault();
    const value = barcode.trim();
    if (!value) return;
    const product = products.find((entry) => entry.barcode === value);
    if (!product) {
      setMessage("ไม่พบสินค้า");
      return;
    }
    barcodeLookupRef.current = value;
    openReceiveModal(product);
  }

  async function refreshAfterStockChange(successMessage: string, latestMovement?: Movement) {
    setMessage(successMessage);
    await Promise.all([load(), syncLocalProductCache(latestMovement)]);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (manualSaving) return;
    setManualSaving(true);
    try {
      const selectedProduct = products.find((product) => product.id === productId);
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          type,
          quantity: Number(quantity),
          note,
          ...(type === "RECEIVE" ? { unitCost: selectedProduct?.costPrice ?? 0 } : {})
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuantity("1");
      setNote("");
      await refreshAfterStockChange("บันทึกสต๊อกแล้ว", data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกสต๊อกไม่สำเร็จ");
    } finally {
      setManualSaving(false);
    }
  }

  async function saveReceive(event: React.FormEvent) {
    event.preventDefault();
    if (!receiveProduct || receiveSavingRef.current) return;

    const qty = Number(receiveQty);
    const unitCost = Number(receiveCost);
    if (!Number.isInteger(qty) || qty <= 0) return setMessage("จำนวนรับเข้าต้องมากกว่า 0");
    if (!Number.isFinite(unitCost) || unitCost < 0) return setMessage("ราคาทุนต่อหน่วยไม่ถูกต้อง");

    receiveSavingRef.current = true;
    setReceiveSaving(true);
    try {
      const noteText = receiveNote.trim() ? `รับสินค้าเข้า - ${receiveNote.trim()}` : "รับสินค้าเข้า";
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: receiveProduct.id,
          type: "RECEIVE",
          quantity: qty,
          unitCost,
          note: noteText
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReceiveProduct(null);
      setBarcode("");
      barcodeLookupRef.current = "";
      await refreshAfterStockChange(`รับสินค้าเข้าแล้ว ${receiveProduct.name} +${qty}`, data);
      barcodeInputRef.current?.focus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกรับสินค้าไม่สำเร็จ");
    } finally {
      receiveSavingRef.current = false;
      setReceiveSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">สต๊อก</h1>
        <p className="text-slate-500">รับสินค้า ปรับยอด และดูประวัติความเคลื่อนไหว</p>
      </div>
      {message && <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 font-bold text-teal-800">{message}</div>}

      <form onSubmit={findBarcodeProduct} className="card p-4">
        <div className="text-xl font-black">รับสินค้าเข้า</div>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
            <input
              ref={barcodeInputRef}
              className="field pl-12"
              value={barcode}
              onChange={(event) => {
                barcodeLookupRef.current = "";
                setBarcode(event.target.value);
              }}
              placeholder="สแกนบาร์โค้ดสินค้า"
              disabled={receiveSaving}
            />
          </div>
          <button className="btn btn-primary min-w-32" disabled={receiveSaving} type="submit">
            ค้นหา
          </button>
        </div>
      </form>

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
        <button className="btn btn-primary md:col-span-5" disabled={manualSaving} type="submit">
          {manualSaving ? "กำลังบันทึก..." : "บันทึกสต๊อก"}
        </button>
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

      {receiveProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={saveReceive} className="card w-full max-w-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-black text-teal-700">สินค้าที่พบ</div>
                <h2 className="mt-1 text-2xl font-black">{receiveProduct.name}</h2>
                <div className="mt-1 text-sm font-bold text-slate-500">{receiveProduct.barcode}</div>
              </div>
              <button className="btn btn-light touch-icon-button" disabled={receiveSaving} onClick={closeReceiveModal} type="button" title="ยกเลิก">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700 sm:grid-cols-2">
              <div>สต๊อกปัจจุบัน: <span className="font-black text-slate-950">{receiveProduct.stockQty} {receiveProduct.unit}</span></div>
              <div>ราคาทุนเดิม: <span className="font-black text-slate-950">{baht(receiveProduct.costPrice ?? 0)}</span></div>
              <div>ราคาขาย: <span className="font-black text-slate-950">{baht(receiveProduct.salePrice)}</span></div>
              <div>สถานะ: <span className="font-black text-emerald-700">เปิดใช้งาน</span></div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="font-black">จำนวนรับเข้า</span>
                <input ref={receiveQtyRef} className="field" type="number" min="1" step="1" value={receiveQty} onChange={(event) => setReceiveQty(event.target.value)} disabled={receiveSaving} />
              </label>
              <label className="space-y-1">
                <span className="font-black">ราคาทุนต่อหน่วย</span>
                <input className="field" type="number" min="0" step="0.01" value={receiveCost} onChange={(event) => setReceiveCost(event.target.value)} disabled={receiveSaving} />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="font-black">หมายเหตุ</span>
                <input className="field" value={receiveNote} onChange={(event) => setReceiveNote(event.target.value)} placeholder="เช่น เลขที่บิลซื้อ" disabled={receiveSaving} />
              </label>
            </div>

            <div className="mt-4 rounded-lg border-2 border-teal-100 bg-teal-50 p-3">
              <div className="text-sm font-black text-teal-800">ยอดรวม</div>
              <div className="text-3xl font-black text-teal-700">{baht(receiveTotal)}</div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button className="btn btn-primary" disabled={receiveSaving} type="submit">
                {receiveSaving && <LoaderCircle className="animate-spin" size={20} />}
                {receiveSaving ? "กำลังบันทึก..." : "บันทึกรับสินค้า"}
              </button>
              <button className="btn btn-light" disabled={receiveSaving} onClick={closeReceiveModal} type="button">
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
