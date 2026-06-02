"use client";

import { Fragment, useEffect, useState } from "react";
import { baht, thDate } from "@/lib/format";

type SaleItem = { id: string; productNameSnapshot: string; barcodeSnapshot: string; quantity: number; unitPrice: number; lineTotal: number; lineProfit: number };
type Sale = { id: string; receiptNo: string; totalAmount: number; grossProfit: number; paymentMethod: string; itemCount: number; createdAt: string; items: SaleItem[] };

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sales").then((res) => res.json()).then(setSales);
  }, []);

  return (
    <section className="space-y-5">
      <div><h1 className="text-2xl font-black">ประวัติการขาย</h1><p className="text-slate-500">ดูรายการขายและรายละเอียดสินค้าในแต่ละบิล</p></div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-4 py-3">เลขที่ใบเสร็จ</th><th className="px-4 py-3">วันเวลา</th><th className="px-4 py-3">ชำระเงิน</th><th className="px-4 py-3 text-center">จำนวนสินค้า</th><th className="px-4 py-3 text-right">ยอดรวม</th><th className="px-4 py-3 text-right">กำไร</th><th className="px-4 py-3 text-right">รายละเอียด</th></tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <Fragment key={sale.id}>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-3 font-black">{sale.receiptNo}</td>
                  <td className="px-4 py-3">{thDate(sale.createdAt)}</td>
                  <td className="px-4 py-3">{sale.paymentMethod === "CASH" ? "เงินสด" : "โอนเงิน"}</td>
                  <td className="px-4 py-3 text-center">{sale.itemCount}</td>
                  <td className="px-4 py-3 text-right font-bold">{baht(sale.totalAmount)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{baht(sale.grossProfit)}</td>
                  <td className="px-4 py-3 text-right"><button className="btn btn-light" onClick={() => setOpenId(openId === sale.id ? null : sale.id)} type="button">ดูบิล</button></td>
                </tr>
                {openId === sale.id && (
                  <tr className="bg-slate-50">
                    <td className="px-4 py-4" colSpan={7}>
                      <div className="space-y-2">
                        {sale.items.map((item) => (
                          <div key={item.id} className="grid gap-2 rounded-lg bg-white p-3 md:grid-cols-[1fr_100px_130px_130px]">
                            <div><div className="font-bold">{item.productNameSnapshot}</div><div className="text-xs text-slate-500">{item.barcodeSnapshot}</div></div>
                            <div>จำนวน {item.quantity}</div>
                            <div>{baht(item.unitPrice)}</div>
                            <div className="font-black">{baht(item.lineTotal)}</div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
