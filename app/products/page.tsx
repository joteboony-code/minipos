"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Save, Search } from "lucide-react";
import { baht } from "@/lib/format";

type Category = { id: string; name: string };
type Product = {
  id: string;
  barcode: string;
  name: string;
  categoryId: string | null;
  category?: Category | null;
  costPrice: number;
  salePrice: number;
  stockQty: number;
  unit: string;
  lowStockAlertQty: number;
  isActive: boolean;
  isQuickSale: boolean;
  allowManualPrice: boolean;
};

const empty = {
  barcode: "",
  name: "",
  categoryId: "",
  costPrice: "0",
  salePrice: "0",
  stockQty: "0",
  unit: "ชิ้น",
  lowStockAlertQty: "5",
  isActive: true,
  isQuickSale: false,
  allowManualPrice: false
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryId) params.set("categoryId", categoryId);
    const [productsRes, categoriesRes] = await Promise.all([fetch(`/api/products?${params}`), fetch("/api/categories")]);
    setProducts(await productsRes.json());
    setCategories(await categoriesRes.json());
  }, [categoryId, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      ...form,
      costPrice: Number(form.costPrice),
      salePrice: Number(form.salePrice),
      stockQty: Number(form.stockQty),
      lowStockAlertQty: Number(form.lowStockAlertQty)
    };
    const res = await fetch(editingId ? `/api/products/${editingId}` : "/api/products", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json();
      return setMessage(data.error ?? "บันทึกสินค้าไม่สำเร็จ ตรวจสอบบาร์โค้ดซ้ำหรือข้อมูลไม่ถูกต้อง");
    }
    setForm(empty);
    setEditingId(null);
    setMessage("บันทึกสินค้าแล้ว");
    await load();
  }

  function edit(product: Product) {
    setEditingId(product.id);
    setForm({
      barcode: product.barcode,
      name: product.name,
      categoryId: product.categoryId ?? "",
      costPrice: String(product.costPrice),
      salePrice: String(product.salePrice),
      stockQty: String(product.stockQty),
      unit: product.unit,
      lowStockAlertQty: String(product.lowStockAlertQty),
      isActive: product.isActive,
      isQuickSale: product.isQuickSale,
      allowManualPrice: product.allowManualPrice
    });
  }

  async function disable(product: Product) {
    await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false })
    });
    await load();
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">สินค้า</h1>
        <p className="text-slate-500">เพิ่ม แก้ไข ค้นหา และปิดใช้งานสินค้า</p>
      </div>
      {message && <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 font-bold text-teal-800">{message}</div>}
      <form onSubmit={save} className="card grid gap-3 p-4 md:grid-cols-4">
        <FieldGroup label="บาร์โค้ด">
          <input className="field" placeholder="เช่น 8850001000011" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} required />
        </FieldGroup>
        <FieldGroup label="ชื่อสินค้า">
          <input className="field" placeholder="เช่น น้ำเปล่า 600ml" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </FieldGroup>
        <FieldGroup label="หมวดหมู่">
          <select className="field" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">ไม่ระบุหมวดหมู่</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </FieldGroup>
        <FieldGroup label="หน่วย เช่น ชิ้น/ขวด/ซอง/แพ็ค">
          <input className="field" placeholder="เช่น ขวด" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </FieldGroup>
        <FieldGroup label="ราคาทุน" helper="ใช้คำนวณกำไร">
          <input className="field" type="number" step="0.01" placeholder="เช่น 5.00" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
        </FieldGroup>
        <FieldGroup label="ราคาขาย" helper="ราคาที่คิดเงินลูกค้า">
          <input className="field" type="number" step="0.01" placeholder="เช่น 10.00" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
        </FieldGroup>
        <FieldGroup label="สต๊อกคงเหลือ" helper="จำนวนสินค้าที่มีตอนนี้">
          <input className="field" type="number" placeholder="เช่น 24" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} />
        </FieldGroup>
        <FieldGroup label="แจ้งเตือนเมื่อเหลือน้อยกว่า" helper="ถ้าสต๊อกเหลือน้อยกว่าค่านี้ จะถือว่าใกล้หมด">
          <input className="field" type="number" placeholder="เช่น 5" value={form.lowStockAlertQty} onChange={(e) => setForm({ ...form, lowStockAlertQty: e.target.value })} />
        </FieldGroup>
        <CheckboxField label="เปิดใช้งาน">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
        </CheckboxField>
        <CheckboxField label="ปุ่มขายด่วน" helper="แสดงสินค้านี้ในหน้า POS ให้กดขายเร็ว">
          <input type="checkbox" checked={form.isQuickSale} onChange={(e) => setForm({ ...form, isQuickSale: e.target.checked })} />
        </CheckboxField>
        <CheckboxField label="ใส่ราคาเองตอนขาย" helper="ใช้กับสินค้าเช่น ขนม 5 บาท/10 บาท หรือของจิปาถะ">
          <input type="checkbox" checked={form.allowManualPrice} onChange={(e) => setForm({ ...form, allowManualPrice: e.target.checked })} />
        </CheckboxField>
        <button className="btn btn-primary md:col-span-2" type="submit"><Save size={18} />{editingId ? "บันทึกสินค้า" : "เพิ่มสินค้า"}</button>
      </form>
      <div className="card flex flex-col gap-3 p-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input className="field pl-10" placeholder="ค้นหาชื่อหรือบาร์โค้ด" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="field md:w-64" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">ทุกหมวดหมู่</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <button className="btn btn-dark" onClick={load} type="button">ค้นหา</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">สินค้า</th><th className="px-4 py-3">หมวดหมู่</th><th className="px-4 py-3 text-right">ทุน</th><th className="px-4 py-3 text-right">ขาย</th><th className="px-4 py-3 text-center">สต็อก</th><th className="px-4 py-3">ขายด่วน</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className={`border-t border-slate-100 ${product.stockQty <= product.lowStockAlertQty ? "bg-amber-50" : ""}`}>
                <td className="px-4 py-3">
                  <div className="font-bold">{product.name}</div>
                  <div className="text-xs text-slate-500">{product.barcode}</div>
                  {product.allowManualPrice && <div className="mt-1 inline-flex rounded-md bg-teal-50 px-2 py-0.5 text-xs font-black text-teal-700">ใส่ราคาเอง</div>}
                </td>
                <td className="px-4 py-3">{product.category?.name ?? "-"}</td>
                <td className="px-4 py-3 text-right">{baht(product.costPrice)}</td>
                <td className="px-4 py-3 text-right font-bold">{baht(product.salePrice)}</td>
                <td className="px-4 py-3 text-center font-black">{product.stockQty} {product.unit}</td>
                <td className="px-4 py-3">{product.isQuickSale ? "ใช้" : "-"}</td>
                <td className="px-4 py-3">{product.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</td>
                <td className="px-4 py-3 text-right">
                  <button className="btn btn-light mr-2" onClick={() => edit(product)} type="button">แก้ไข</button>
                  <button className="btn btn-danger" disabled={!product.isActive} onClick={() => disable(product)} type="button">ปิดใช้</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FieldGroup({ label, helper, children }: { label: string; helper?: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="block text-base font-black text-slate-800">{label}</span>
      {children}
      {helper && <span className="block text-sm font-bold text-slate-500">{helper}</span>}
    </label>
  );
}

function CheckboxField({ label, helper, children }: { label: string; helper?: string; children: ReactNode }) {
  return (
    <label className="flex min-h-16 items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <span className="mt-1">{children}</span>
      <span>
        <span className="block text-base font-black text-slate-800">{label}</span>
        {helper && <span className="block text-sm font-bold text-slate-500">{helper}</span>}
      </span>
    </label>
  );
}
