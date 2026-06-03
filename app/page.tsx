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
    { label: "ยอดขายวันนี้", value: baht(data?.totalSales ?? 0), icon: Banknote, color: "bg-teal-600", textColor: "text-teal-700" },
    { label: "จำนวนบิลวันนี้", value: `${data?.billCount ?? 0} บิล`, icon: ReceiptText, color: "bg-blue-600", textColor: "text-blue-700" },
    { label: "กำไรขั้นต้นวันนี้", value: baht(data?.grossProfit ?? 0), icon: TrendingUp, color: "bg-emerald-600", textColor: "text-emerald-700" },
    { label: "สินค้าใกล้หมด", value: `${data?.lowStockCount ?? 0} รายการ`, icon: AlertTriangle, color: "bg-amber-500", textColor: "text-amber-700" },
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">รายงานวันนี้</h1>
        <p className="mt-1 text-lg text-slate-500">สรุปยอดขายและสถานะร้านแบบรวดเร็ว</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-6">
              <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl text-white ${card.color}`}>
                <Icon size={28} />
              </div>
              <div className="text-base font-bold text-slate-500">{card.label}</div>
              <div className={`mt-2 text-3xl font-black ${card.textColor}`}>{card.value}</div>
            </div>
          );
        })}
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 text-xl font-black">รายการขายล่าสุด</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-5 py-4 text-base font-black">เลขที่ใบเสร็จ</th>
                <th className="px-5 py-4 text-base font-black">เวลา</th>
                <th className="px-5 py-4 text-base font-black">จำนวนสินค้า</th>
                <th className="px-5 py-4 text-right text-base font-black">ยอดรวม</th>
                <th className="px-5 py-4 text-right text-base font-black">กำไร</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentSales ?? []).map((sale) => (
                <tr key={sale.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-4 text-lg font-black">{sale.receiptNo}</td>
                  <td className="px-5 py-4 text-base">{thDate(sale.createdAt)}</td>
                  <td className="px-5 py-4 text-base font-bold">{sale.itemCount} รายการ</td>
                  <td className="px-5 py-4 text-right text-lg font-black">{baht(sale.totalAmount)}</td>
                  <td className="px-5 py-4 text-right text-lg font-black text-emerald-700">{baht(sale.grossProfit)}</td>
                </tr>
              ))}
              {data?.recentSales?.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-center text-lg text-slate-500" colSpan={5}>
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
