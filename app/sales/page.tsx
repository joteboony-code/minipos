"use client";

import { Fragment, useEffect, useState } from "react";
import { baht, thDate } from "@/lib/format";

type SaleItem = {
  id: string;
  productNameSnapshot: string;
  barcodeSnapshot: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  lineProfit: number | null;
};

type Sale = {
  id: string;
  receiptNo: string;
  totalAmount: number;
  totalCost: number | null;
  grossProfit: number | null;
  paymentMethod: "CASH" | "TRANSFER";
  cashReceived: number | null;
  changeAmount: number | null;
  itemCount: number;
  createdAt: string;
  items: SaleItem[];
};

function csvValue(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function paymentLabel(paymentMethod: Sale["paymentMethod"]) {
  return paymentMethod === "CASH" ? "เงินสด" : "รับโอน";
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [role, setRole] = useState<"OWNER" | "STAFF" | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((res) => res.ok ? res.json() : null).then((data) => setRole(data?.role ?? null));
    fetch("/api/sales").then((res) => res.json()).then(setSales);
  }, []);

  function exportCsv() {
    const headers = ["เลขที่บิล", "วันที่/เวลา", "ยอดรวม", "ต้นทุนรวม", "กำไรขั้นต้น", "วิธีชำระเงิน", "รับเงิน", "เงินทอน", "จำนวนสินค้า"];
    const rows = sales.map((sale) => [
      sale.receiptNo,
      thDate(sale.createdAt),
      sale.totalAmount.toFixed(2),
      (sale.totalCost ?? 0).toFixed(2),
      (sale.grossProfit ?? 0).toFixed(2),
      paymentLabel(sale.paymentMethod),
      sale.cashReceived === null ? "" : sale.cashReceived.toFixed(2),
      sale.changeAmount === null ? "" : sale.changeAmount.toFixed(2),
      sale.itemCount
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sales-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printReceipt(saleId: string) {
    setOpenId(saleId);
    window.setTimeout(() => window.print(), 50);
  }

  return (
    <section className="space-y-5">
      <div className="screen-only flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black">ประวัติการขาย</h1>
          <p className="text-slate-500">ดูรายการขาย รายละเอียดใบเสร็จ และส่งออกรายงาน</p>
        </div>
        {role === "OWNER" && <button className="btn btn-primary" onClick={exportCsv} type="button">ส่งออก CSV</button>}
      </div>
      <div className="card screen-only overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-4 py-3">เลขที่ใบเสร็จ</th><th className="px-4 py-3">วันเวลา</th><th className="px-4 py-3">ชำระเงิน</th><th className="px-4 py-3 text-center">จำนวนสินค้า</th><th className="px-4 py-3 text-right">ยอดรวม</th>{role === "OWNER" && <th className="px-4 py-3 text-right">กำไร</th>}<th className="px-4 py-3 text-right">รายละเอียด</th></tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <Fragment key={sale.id}>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-3 font-black">{sale.receiptNo}</td>
                  <td className="px-4 py-3">{thDate(sale.createdAt)}</td>
                  <td className="px-4 py-3">{paymentLabel(sale.paymentMethod)}</td>
                  <td className="px-4 py-3 text-center">{sale.itemCount}</td>
                  <td className="px-4 py-3 text-right font-bold">{baht(sale.totalAmount)}</td>
                  {role === "OWNER" && <td className="px-4 py-3 text-right text-emerald-700">{baht(sale.grossProfit ?? 0)}</td>}
                  <td className="px-4 py-3 text-right"><button className="btn btn-light" onClick={() => setOpenId(openId === sale.id ? null : sale.id)} type="button">ดูบิล</button></td>
                </tr>
                {openId === sale.id && (
                  <tr className="bg-slate-50">
                    <td className="px-4 py-4" colSpan={role === "OWNER" ? 7 : 6}>
                      <ReceiptDetail sale={sale} onPrint={() => printReceipt(sale.id)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {sales.map((sale) => (
        <div key={`print-${sale.id}`} className={openId === sale.id ? "receipt-print" : "hidden"}>
          <ReceiptDetail sale={sale} printOnly />
        </div>
      ))}
    </section>
  );
}

function ReceiptDetail({ sale, onPrint, printOnly = false }: { sale: Sale; onPrint?: () => void; printOnly?: boolean }) {
  return (
    <div className={`mx-auto max-w-md rounded-lg bg-white p-5 text-slate-950 ${printOnly ? "" : "border border-slate-200"}`}>
      <div className="text-center">
        <div className="text-2xl font-black">MiniMart POS</div>
        <div className="mt-1 text-sm">ใบเสร็จรับเงิน</div>
      </div>
      <div className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between gap-3"><span>เลขที่บิล</span><span className="font-bold">{sale.receiptNo}</span></div>
        <div className="flex justify-between gap-3"><span>วันที่/เวลา</span><span>{thDate(sale.createdAt)}</span></div>
      </div>
      <div className="mt-4 border-y border-dashed border-slate-300 py-2">
        {sale.items.map((item) => (
          <div key={item.id} className="py-2">
            <div className="font-bold">{item.productNameSnapshot}</div>
            <div className="grid grid-cols-[50px_1fr_1fr] gap-2 text-sm">
              <div>{item.quantity}x</div>
              <div className="text-right">{baht(item.unitPrice)}</div>
              <div className="text-right font-bold">{baht(item.lineTotal)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between text-lg font-black"><span>ยอดรวมทั้งหมด</span><span>{baht(sale.totalAmount)}</span></div>
        <div className="flex justify-between"><span>วิธีชำระเงิน</span><span>{paymentLabel(sale.paymentMethod)}</span></div>
        {sale.paymentMethod === "CASH" && (
          <>
            <div className="flex justify-between"><span>รับเงิน</span><span>{baht(sale.cashReceived ?? 0)}</span></div>
            <div className="flex justify-between font-black"><span>เงินทอน</span><span>{baht(sale.changeAmount ?? 0)}</span></div>
          </>
        )}
      </div>
      {!printOnly && (
        <button className="btn btn-primary mt-5 w-full screen-only" onClick={onPrint} type="button">พิมพ์ใบเสร็จ</button>
      )}
    </div>
  );
}
