"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Banknote, ReceiptText, TrendingUp } from "lucide-react";
import { baht, thDate } from "@/lib/format";

type Dashboard = {
  totalSales: number;
  billCount: number;
  grossProfit: number;
  lowStockCount: number;
  recentSales: { id: string; receiptNo: string; totalAmount: number; grossProfit: number; itemCount: number; createdAt: string }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then(setData);
  }, []);

  const cards = [
    { label: "ยอดขายวันนี้", value: baht(data?.totalSales ?? 0), icon: Banknote, color: "bg-teal-600" },
    { label: "จำนวนบิลวันนี้", value: `${data?.billCount ?? 0} บิล`, icon: ReceiptText, color: "bg-blue-600" },
    { label: "กำไรขั้นต้นวันนี้", value: baht(data?.grossProfit ?? 0), icon: TrendingUp, color: "bg-emerald-600" },
    { label: "สินค้าใกล้หมด", value: `${data?.lowStockCount ?? 0} รายการ`, icon: AlertTriangle, color: "bg-amber-500" }
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h1 className="text-3xl font-black text-slate-950">รายงานวันนี้</h1>
        <p className="mt-1 font-bold text-slate-500">สรุปยอดขายและสถานะร้านแบบรวดเร็ว</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-4">
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg text-white ${card.color}`}>
                <Icon size={22} />
              </div>
              <div className="text-sm font-bold text-slate-500">{card.label}</div>
              <div className="mt-1 text-2xl font-black">{card.value}</div>
            </div>
          );
        })}
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 text-lg font-black">รายการขายล่าสุด</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">เลขที่ใบเสร็จ</th>
                <th className="px-4 py-3">เวลา</th>
                <th className="px-4 py-3">จำนวนสินค้า</th>
                <th className="px-4 py-3 text-right">ยอดรวม</th>
                <th className="px-4 py-3 text-right">กำไร</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentSales ?? []).map((sale) => (
                <tr key={sale.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-bold">{sale.receiptNo}</td>
                  <td className="px-4 py-3">{thDate(sale.createdAt)}</td>
                  <td className="px-4 py-3">{sale.itemCount}</td>
                  <td className="px-4 py-3 text-right font-bold">{baht(sale.totalAmount)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{baht(sale.grossProfit)}</td>
                </tr>
              ))}
              {data?.recentSales?.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                    ยังไม่มีรายการขาย
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
