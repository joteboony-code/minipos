"use client";

import { useEffect, useMemo, useState } from "react";
import { baht, thDate } from "@/lib/format";

type ProductRank = { name: string; barcode: string; quantity: number; totalAmount: number; grossProfit?: number };
type RecentSale = { id: string; receiptNo: string; totalAmount: number; paymentMethod: "CASH" | "TRANSFER" | "CREDIT"; createdAt: string };
type StockProduct = { id: string; name: string; barcode: string; stockQty: number; lowStockAlertQty?: number };
type Summary = {
  totalAmount: number;
  netSales: number;
  returnsTotal: number;
  returnsCount: number;
  voidedSalesTotal: number;
  voidedBillCount: number;
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
  if (method === "CREDIT") return "เน€เธเธดเธเน€เธเธทเนเธญ";
  return method === "CASH" ? "เน€เธเธดเธเธชเธ”" : "เธฃเธฑเธเนเธญเธ";
}

function MetricCard({ label, value, tone = "slate" }: { label: string; value: string | number; tone?: "slate" | "green" | "teal" | "amber" | "red" }) {
  const toneClass = tone === "green" ? "text-emerald-700" : tone === "teal" ? "text-teal-700" : tone === "amber" ? "text-amber-700" : tone === "red" ? "text-red-700" : "text-slate-950";
  return (
    <div className="card p-5">
      <div className="text-base font-black text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

function ProductTable({ products }: { products: ProductRank[] }) {
  if (products.length === 0) return <div className="p-4 text-center font-bold text-slate-500">เธขเธฑเธเนเธกเนเธกเธตเธเนเธญเธกเธนเธฅ</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr><th className="px-4 py-3">เธชเธดเธเธเนเธฒ</th><th className="px-4 py-3">เธเธฒเธฃเนเนเธเนเธ”</th><th className="px-4 py-3 text-right">เธเธณเธเธงเธเธเธฒเธข</th><th className="px-4 py-3 text-right">เธขเธญเธ”เธเธฒเธข</th></tr>
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
        if (!res.ok) throw new Error(body.error ?? "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เนเธซเธฅเธ”เธฃเธฒเธขเธเธฒเธเนเธ”เน");
        return body;
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เนเธซเธฅเธ”เธฃเธฒเธขเธเธฒเธเนเธ”เน"));
  }, [month]);

  const today = data?.today;
  const monthly = data?.month;
  const selectedMonthLabel = useMemo(() => month, [month]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black">เธฃเธฒเธขเธเธฒเธ</h1>
          <p className="mt-2 text-lg font-bold text-slate-500">เธขเธญเธ”เธเธฒเธข เธเธณเนเธฃเธเธฑเนเธเธ•เนเธ เธงเธดเธเธตเธเธณเธฃเธฐเน€เธเธดเธ เนเธฅเธฐเธชเธดเธเธเนเธฒเธเธฒเธขเธ”เธต</p>
        </div>
        <label className="block">
          <span className="mb-2 block font-black">เธฃเธฒเธขเธเธฒเธเธฃเธฒเธขเน€เธ”เธทเธญเธ</span>
          <input className="field max-w-xs" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 font-black text-red-700">{error}</div>}

      <div>
        <h2 className="mb-3 text-2xl font-black">เธฃเธฒเธขเธเธฒเธเธงเธฑเธเธเธตเน</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="เธขเธญเธ”เธเธฒเธขเธงเธฑเธเธเธตเน" value={baht(today?.totalAmount ?? 0)} tone="teal" />
          <MetricCard label="ยอดขายสุทธิวันนี้" value={baht(today?.netSales ?? 0)} tone="green" />
          <MetricCard label="ยอดคืนสินค้าวันนี้" value={baht(today?.returnsTotal ?? 0)} tone="amber" />
          <MetricCard label="บิลยกเลิกวันนี้" value={`${today?.voidedBillCount ?? 0} บิล`} tone="red" />
          <MetricCard label="เธเธณเธเธงเธเธเธดเธฅเธงเธฑเธเธเธตเน" value={today?.billCount ?? 0} />
          <MetricCard label="เธเธณเนเธฃเธเธฑเนเธเธ•เนเธเธงเธฑเธเธเธตเน" value={baht(today?.grossProfit ?? 0)} tone="green" />
          <MetricCard label="เน€เธเธดเธเธชเธ”" value={baht(today?.cashTotal ?? 0)} />
          <MetricCard label="เธฃเธฑเธเนเธญเธ" value={baht(today?.transferTotal ?? 0)} />
          <MetricCard label="เน€เธเธดเธเน€เธเธทเนเธญ" value={baht(today?.creditTotal ?? 0)} />
          <MetricCard label="เน€เธเธดเธเน€เธเธทเนเธญเธเนเธฒเธเธเธณเธฃเธฐ" value={baht(today?.creditOutstandingTotal ?? 0)} />
          <MetricCard label="เธเธณเธฃเธฐเน€เธเธดเธเน€เธเธทเนเธญเนเธฅเนเธง" value={baht(today?.creditPaidTotal ?? 0)} />
          <MetricCard label="เธเธดเธฅเน€เธเธดเธเน€เธเธทเนเธญเธเนเธฒเธ" value={today?.creditOpenBillCount ?? 0} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 p-4 text-xl font-black">เธชเธดเธเธเนเธฒเธเธฒเธขเธ”เธตเธงเธฑเธเธเธตเน</div>
          <ProductTable products={today?.topProducts ?? []} />
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 p-4 text-xl font-black">เธฃเธฒเธขเธเธฒเธฃเธเธฒเธขเธฅเนเธฒเธชเธธเธ”เธงเธฑเธเธเธตเน</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr><th className="px-4 py-3">เน€เธฅเธเธ—เธตเนเธเธดเธฅ</th><th className="px-4 py-3">เน€เธงเธฅเธฒ</th><th className="px-4 py-3">เธเธณเธฃเธฐเน€เธเธดเธ</th><th className="px-4 py-3 text-right">เธขเธญเธ”เธฃเธงเธก</th></tr>
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
        <h2 className="mb-3 text-2xl font-black">เธฃเธฒเธขเธเธฒเธเธฃเธฒเธขเน€เธ”เธทเธญเธ {selectedMonthLabel}</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="เธขเธญเธ”เธเธฒเธขเธฃเธฒเธขเน€เธ”เธทเธญเธ" value={baht(monthly?.totalAmount ?? 0)} tone="teal" />
          <MetricCard label="ยอดขายสุทธิรายเดือน" value={baht(monthly?.netSales ?? 0)} tone="green" />
          <MetricCard label="ยอดคืนสินค้ารายเดือน" value={baht(monthly?.returnsTotal ?? 0)} tone="amber" />
          <MetricCard label="บิลยกเลิกรายเดือน" value={`${monthly?.voidedBillCount ?? 0} บิล`} tone="red" />
          <MetricCard label="เธเธณเธเธงเธเธเธดเธฅ" value={monthly?.billCount ?? 0} />
          <MetricCard label="เธเธณเนเธฃเธเธฑเนเธเธ•เนเธ" value={baht(monthly?.grossProfit ?? 0)} tone="green" />
          <MetricCard label="เน€เธเธดเธเธชเธ”" value={baht(monthly?.cashTotal ?? 0)} />
          <MetricCard label="เธฃเธฑเธเนเธญเธ" value={baht(monthly?.transferTotal ?? 0)} />
          <MetricCard label="เน€เธเธดเธเน€เธเธทเนเธญ" value={baht(monthly?.creditTotal ?? 0)} />
          <MetricCard label="เน€เธเธดเธเน€เธเธทเนเธญเธเนเธฒเธเธเธณเธฃเธฐ" value={baht(monthly?.creditOutstandingTotal ?? 0)} />
          <MetricCard label="เธเธณเธฃเธฐเน€เธเธดเธเน€เธเธทเนเธญเนเธฅเนเธง" value={baht(monthly?.creditPaidTotal ?? 0)} />
          <MetricCard label="เธเธดเธฅเน€เธเธดเธเน€เธเธทเนเธญเธเนเธฒเธ" value={monthly?.creditOpenBillCount ?? 0} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 p-4 text-xl font-black">เธชเธดเธเธเนเธฒเธเธฒเธขเธ”เธตเธฃเธฒเธขเน€เธ”เธทเธญเธ</div>
          <ProductTable products={monthly?.topProducts ?? []} />
        </div>
        <div className="grid gap-6">
          <StockList title="เธชเธดเธเธเนเธฒเนเธเธฅเนเธซเธกเธ”" products={data?.lowStock ?? []} />
          <StockList title="เธชเธดเธเธเนเธฒเธซเธกเธ”" products={data?.outOfStock ?? []} />
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
        <div className="p-4 text-center font-bold text-slate-500">เธขเธฑเธเนเธกเนเธกเธตเธเนเธญเธกเธนเธฅ</div>
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
                {product.lowStockAlertQty !== undefined && <div className="text-xs font-bold text-slate-500">เนเธเนเธเน€เธ•เธทเธญเธ {product.lowStockAlertQty}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

