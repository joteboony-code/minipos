"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, PackageX } from "lucide-react";

type StockProduct = {
  id: string;
  name: string;
  barcode: string;
  stockQty: number;
  lowStockAlertQty: number;
  unit: string;
};

type LowStockData = {
  lowStock: StockProduct[];
  outOfStock: StockProduct[];
};

function ProductList({ products, emptyText, tone }: { products: StockProduct[]; emptyText: string; tone: "amber" | "red" }) {
  if (products.length === 0) {
    return <div className="p-6 text-center font-bold text-slate-500">{emptyText}</div>;
  }
  return (
    <div className="divide-y divide-slate-100">
      {products.map((product) => (
        <div key={product.id} className="flex items-center justify-between gap-4 p-4">
          <div>
            <div className="font-black">{product.name}</div>
            <div className="text-sm font-bold text-slate-500">{product.barcode}</div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-black ${tone === "red" ? "text-red-700" : "text-amber-700"}`}>{product.stockQty} {product.unit}</div>
            <div className="text-xs font-bold text-slate-500">แจ้งเตือน ≤ {product.lowStockAlertQty}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LowStockPage() {
  const [data, setData] = useState<LowStockData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/stock/low")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "โหลดข้อมูลไม่สำเร็จ");
        return body;
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black">สินค้าใกล้หมด / หมด</h1>
          <p className="text-slate-500">รายการสินค้าที่ต้องสั่งซื้อเพิ่ม</p>
        </div>
        <Link className="btn btn-primary" href="/stock">รับสินค้าเข้า</Link>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 font-black text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-500 text-white">
              <AlertTriangle size={22} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-500">สินค้าใกล้หมด</div>
              <div className="text-2xl font-black">{data?.lowStock.length ?? "-"} รายการ</div>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-600 text-white">
              <PackageX size={22} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-500">สินค้าหมด</div>
              <div className="text-2xl font-black">{data?.outOfStock.length ?? "-"} รายการ</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-xl font-black text-amber-700">สินค้าใกล้หมด</div>
        <ProductList products={data?.lowStock ?? []} emptyText="ไม่มีสินค้าใกล้หมด" tone="amber" />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-xl font-black text-red-700">สินค้าหมด</div>
        <ProductList products={data?.outOfStock ?? []} emptyText="ไม่มีสินค้าหมด" tone="red" />
      </div>
    </section>
  );
}
