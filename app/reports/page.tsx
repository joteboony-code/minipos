"use client";

import { useEffect, useMemo, useState } from "react";
import { baht, thDate } from "@/lib/format";

type ProductRank = { name: string; barcode: string; quantity: number; totalAmount: number; grossProfit?: number };
type RecentSale = { id: string; receiptNo: string; totalAmount: number; paymentMethod: "CASH" | "TRANSFER" | "CREDIT"; createdAt: string };
type StockProduct = { id: string; name: string; barcode: string; stockQty: number; lowStockAlertQty?: number };
type Summary = {
  totalAmount: number;
  billCount: number;
  grossProfit: number;
  cashTotal: number;
  transferTotal: number;
  creditTotal: number;
  creditPaidTotal: number;
  creditOutstandingTotal: number;
  creditOpenBillCount: number;
  topProducts: ProductRank[];
  recentSales: RecentSale[];
};
type ReportData = {
  today: Summary;
  month: Summary;
  monthText: string;
  lowStock: StockProduct[];
  outOfStock: StockProduct[];
};

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function paymentLabel(method: RecentSale["paymentMethod"]) {
  if (method === "CREDIT") return "เงินเชื่อ";
  return method === "CASH" ? "เงินสด" : "รับโอน";
}

function MetricCard({ label, value, tone = "slate" }: { label: string; value: string | number; tone?: "slate" | "green" | "teal" }) {
  const toneClass = tone === "green" ? "text-emerald-700" : tone === "teal" ? "text-teal-700" : "text-slate-950";
  return (
    <div className="card p-5">
      <div className="text-base font-black text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

function ProductTable({ products }: { products: ProductRank[] }) {
  if (products.length === 0) return <div className="p-4 text-center font-bold text-slate-500">ยังไม่มีข้อมูล</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr><th className="px-4 py-3">สินค้า</th><th className="px-4 py-3">บาร์โค้ด</th><th className="px-4 py-3 text-right">จำนวนขาย</th><th className="px-4 py-3 text-right">ยอดขาย</th></tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={`${product.barcode}-${product.name}`} className="border-t border-slate-100">
              <td className="px-4 py-3 font-black">{product.name}</td>
              <td className="px-4 py-3">{product.barcode}</td>
              <td className="px-4 py-3 text-right font-bold">{product.quantity}</td>
              <td className="px-4 py-3 text-right font-bold">{baht(product.totalAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    fetch(`/api/reports?month=${month}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "ไม่สามารถโหลดรายงานได้");
        return body;
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "ไม่สามารถโหลดรายงานได้"));
  }, [month]);

  const today = data?.today;
  const monthly = data?.month;
  const selectedMonthLabel = useMemo(() => month, [month]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black">รายงาน</h1>
          <p className="mt-2 text-lg font-bold text-slate-500">ยอดขาย กำไรขั้นต้น วิธีชำระเงิน และสินค้าขายดี</p>
        </div>
        <label className="block">
          <span className="mb-2 block font-black">รายงานรายเดือน</span>
          <input className="field max-w-xs" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 font-black text-red-700">{error}</div>}

      <div>
        <h2 className="mb-3 text-2xl font-black">รายงานวันนี้</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="ยอดขายวันนี้" value={baht(today?.totalAmount ?? 0)} tone="teal" />
          <MetricCard label="จำนวนบิลวันนี้" value={today?.billCount ?? 0} />
          <MetricCard label="กำไรขั้นต้นวันนี้" value={baht(today?.grossProfit ?? 0)} tone="green" />
          <MetricCard label="เงินสด" value={baht(today?.cashTotal ?? 0)} />
          <MetricCard label="รับโอน" value={baht(today?.transferTotal ?? 0)} />
          <MetricCard label="เงินเชื่อ" value={baht(today?.creditTotal ?? 0)} />
          <MetricCard label="เงินเชื่อค้างชำระ" value={baht(today?.creditOutstandingTotal ?? 0)} />
          <MetricCard label="ชำระเงินเชื่อแล้ว" value={baht(today?.creditPaidTotal ?? 0)} />
          <MetricCard label="บิลเงินเชื่อค้าง" value={today?.creditOpenBillCount ?? 0} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 p-4 text-xl font-black">สินค้าขายดีวันนี้</div>
          <ProductTable products={today?.topProducts ?? []} />
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 p-4 text-xl font-black">รายการขายล่าสุดวันนี้</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr><th className="px-4 py-3">เลขที่บิล</th><th className="px-4 py-3">เวลา</th><th className="px-4 py-3">ชำระเงิน</th><th className="px-4 py-3 text-right">ยอดรวม</th></tr>
              </thead>
              <tbody>
                {(today?.recentSales ?? []).map((sale) => (
                  <tr key={sale.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-black">{sale.receiptNo}</td>
                    <td className="px-4 py-3">{thDate(sale.createdAt)}</td>
                    <td className="px-4 py-3">{paymentLabel(sale.paymentMethod)}</td>
                    <td className="px-4 py-3 text-right font-bold">{baht(sale.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-2xl font-black">รายงานรายเดือน {selectedMonthLabel}</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="ยอดขายรายเดือน" value={baht(monthly?.totalAmount ?? 0)} tone="teal" />
          <MetricCard label="จำนวนบิล" value={monthly?.billCount ?? 0} />
          <MetricCard label="กำไรขั้นต้น" value={baht(monthly?.grossProfit ?? 0)} tone="green" />
          <MetricCard label="เงินสด" value={baht(monthly?.cashTotal ?? 0)} />
          <MetricCard label="รับโอน" value={baht(monthly?.transferTotal ?? 0)} />
          <MetricCard label="เงินเชื่อ" value={baht(monthly?.creditTotal ?? 0)} />
          <MetricCard label="เงินเชื่อค้างชำระ" value={baht(monthly?.creditOutstandingTotal ?? 0)} />
          <MetricCard label="ชำระเงินเชื่อแล้ว" value={baht(monthly?.creditPaidTotal ?? 0)} />
          <MetricCard label="บิลเงินเชื่อค้าง" value={monthly?.creditOpenBillCount ?? 0} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 p-4 text-xl font-black">สินค้าขายดีรายเดือน</div>
          <ProductTable products={monthly?.topProducts ?? []} />
        </div>
        <div className="grid gap-6">
          <StockList title="สินค้าใกล้หมด" products={data?.lowStock ?? []} />
          <StockList title="สินค้าหมด" products={data?.outOfStock ?? []} />
        </div>
      </div>
    </section>
  );
}

function StockList({ title, products }: { title: string; products: StockProduct[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 p-4 text-xl font-black">{title}</div>
      {products.length === 0 ? (
        <div className="p-4 text-center font-bold text-slate-500">ยังไม่มีข้อมูล</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {products.map((product) => (
            <div key={product.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <div className="font-black">{product.name}</div>
                <div className="text-sm font-bold text-slate-500">{product.barcode}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-red-700">{product.stockQty}</div>
                {product.lowStockAlertQty !== undefined && <div className="text-xs font-bold text-slate-500">แจ้งเตือน {product.lowStockAlertQty}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
