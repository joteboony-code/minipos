"use client";

import { Fragment, useEffect, useState } from "react";
import { baht, thDate } from "@/lib/format";
import { getLocalSaleBundles, type LocalSyncStatus } from "@/lib/local-pos-db";

type SaleItem = {
  id: string;
  productNameSnapshot: string;
  barcodeSnapshot: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number | null;
  lineTotal: number;
  lineProfit: number | null;
  itemBatches?: Array<{
    id: string;
    productBatchId: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    receivedAt: string;
    note?: string | null;
  }>;
};

type Sale = {
  id: string;
  receiptNo: string;
  totalAmount: number;
  totalCost: number | null;
  grossProfit: number | null;
  paymentMethod: "CASH" | "TRANSFER" | "CREDIT";
  cashReceived: number | null;
  changeAmount: number | null;
  creditCustomerName?: string | null;
  creditCustomerPhone?: string | null;
  creditNote?: string | null;
  creditDueAmount?: number | null;
  creditPaidAmount?: number | null;
  creditStatus?: "UNPAID" | "PARTIAL" | "PAID" | null;
  creditPayments?: Array<{ id: string; amount: number; note: string | null; createdAt: string }>;
  itemCount: number;
  createdAt: string;
  items: SaleItem[];
  syncStatus?: LocalSyncStatus;
  isLocal?: boolean;
};

function csvValue(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function paymentLabel(paymentMethod: Sale["paymentMethod"]) {
  if (paymentMethod === "CREDIT") return "เงินเชื่อ";
  return paymentMethod === "CASH" ? "เงินสด" : "รับโอน";
}

function creditStatusLabel(status?: Sale["creditStatus"]) {
  if (status === "PAID") return "ชำระแล้ว";
  if (status === "PARTIAL") return "ชำระบางส่วน";
  return "ค้างชำระ";
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [role, setRole] = useState<"OWNER" | "STAFF" | null>(null);
  const [printSize, setPrintSize] = useState<"58" | "80" | "a4">("80");

  useEffect(() => {
    fetch("/api/auth/me").then((res) => res.ok ? res.json() : null).then((data) => setRole(data?.role ?? null));
    Promise.all([
      fetch("/api/sales").then((res) => res.json()),
      getLocalSaleBundles()
    ]).then(([cloudSales, localBundles]) => {
      const localSales: Sale[] = localBundles
        .filter((bundle) => bundle.sale.syncStatus !== "SYNCED")
        .map((bundle) => ({
          id: bundle.sale.localId,
          receiptNo: bundle.sale.receiptNo,
          totalAmount: bundle.sale.totalAmount,
          totalCost: bundle.sale.totalCost,
          grossProfit: bundle.sale.grossProfit,
          paymentMethod: bundle.sale.paymentMethod,
          cashReceived: bundle.sale.cashReceived,
          changeAmount: bundle.sale.changeAmount,
          creditCustomerName: bundle.sale.creditCustomerName,
          creditCustomerPhone: bundle.sale.creditCustomerPhone,
          creditNote: bundle.sale.creditNote,
          creditDueAmount: bundle.sale.creditDueAmount,
          creditPaidAmount: bundle.sale.creditPaidAmount,
          creditStatus: bundle.sale.creditStatus,
          creditPayments: [],
          itemCount: bundle.items.reduce((sum, item) => sum + item.quantity, 0),
          createdAt: bundle.sale.createdAt,
          syncStatus: bundle.sale.syncStatus,
          isLocal: true,
          items: bundle.items.map((item) => ({
            id: item.localId,
            productNameSnapshot: item.productNameSnapshot,
            barcodeSnapshot: item.barcodeSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costPrice: null,
            lineTotal: item.lineTotal,
            lineProfit: item.lineProfit,
            itemBatches: []
          }))
        }));
      const allSales = [...localSales, ...(Array.isArray(cloudSales) ? cloudSales : [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSales(allSales);
    });
  }, []);

  function exportCsv() {
    const headers = ["เลขที่บิล", "วันที่/เวลา", "ยอดรวม", "ต้นทุนรวม", "กำไรขั้นต้น", "วิธีชำระเงิน", "ลูกค้าเงินเชื่อ", "สถานะเงินเชื่อ", "ยอดเงินเชื่อ", "ชำระแล้ว", "คงเหลือ", "รับเงิน", "เงินทอน", "จำนวนสินค้า"];
    const rows = sales.map((sale) => [
      sale.receiptNo,
      thDate(sale.createdAt),
      sale.totalAmount.toFixed(2),
      (sale.totalCost ?? 0).toFixed(2),
      (sale.grossProfit ?? 0).toFixed(2),
      paymentLabel(sale.paymentMethod),
      sale.creditCustomerName ?? "",
      sale.paymentMethod === "CREDIT" ? creditStatusLabel(sale.creditStatus) : "",
      sale.paymentMethod === "CREDIT" ? (sale.creditDueAmount ?? sale.totalAmount).toFixed(2) : "",
      sale.paymentMethod === "CREDIT" ? (sale.creditPaidAmount ?? 0).toFixed(2) : "",
      sale.paymentMethod === "CREDIT" ? Math.max((sale.creditDueAmount ?? sale.totalAmount) - (sale.creditPaidAmount ?? 0), 0).toFixed(2) : "",
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
                  <td className="px-4 py-3 font-black">
                    <div>{sale.receiptNo}</div>
                    {sale.isLocal && <div className="mt-1 text-xs text-amber-700">{sale.syncStatus === "FAILED" ? "ซิงก์ไม่สำเร็จ" : "รอซิงก์"}</div>}
                  </td>
                  <td className="px-4 py-3">{thDate(sale.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div>{paymentLabel(sale.paymentMethod)}</div>
                    {sale.paymentMethod === "CREDIT" && <div className="mt-1 text-xs font-black text-amber-700">{sale.creditCustomerName} | {creditStatusLabel(sale.creditStatus)}</div>}
                  </td>
                  <td className="px-4 py-3 text-center">{sale.itemCount}</td>
                  <td className="px-4 py-3 text-right font-bold">{baht(sale.totalAmount)}</td>
                  {role === "OWNER" && <td className="px-4 py-3 text-right text-emerald-700">{baht(sale.grossProfit ?? 0)}</td>}
                  <td className="px-4 py-3 text-right"><button className="btn btn-light" onClick={() => setOpenId(openId === sale.id ? null : sale.id)} type="button">ดูบิล</button></td>
                </tr>
                {openId === sale.id && (
                  <tr className="bg-slate-50">
                    <td className="px-4 py-4" colSpan={role === "OWNER" ? 7 : 6}>
                      <ReceiptDetail sale={sale} onPrint={() => printReceipt(sale.id)} role={role} printSize={printSize} onPrintSizeChange={setPrintSize} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {sales.map((sale) => (
        <div key={`print-${sale.id}`} className={openId === sale.id ? `receipt-print size-${printSize}` : "hidden"}>
          <ReceiptDetail sale={sale} printOnly role={role} />
        </div>
      ))}
    </section>
  );
}

function ReceiptDetail({ sale, onPrint, printOnly = false, role, printSize, onPrintSizeChange }: {
  sale: Sale;
  onPrint?: () => void;
  printOnly?: boolean;
  role: "OWNER" | "STAFF" | null;
  printSize?: "58" | "80" | "a4";
  onPrintSizeChange?: (size: "58" | "80" | "a4") => void;
}) {
  const syncLabel = sale.syncStatus === "FAILED" ? "ซิงก์ไม่สำเร็จ" : sale.syncStatus === "LOCAL_ONLY" || sale.syncStatus === "SYNCING" ? "รอซิงก์" : "ซิงก์แล้ว";
  return (
    <div className={`mx-auto max-w-md rounded-lg bg-white p-5 text-slate-950 ${printOnly ? "" : "border border-slate-200"}`}>
      <div className="text-center">
        <div className="text-2xl font-black">MiniMart POS</div>
        <div className="mt-1 text-sm">ใบเสร็จรับเงิน</div>
      </div>
      <div className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between gap-3"><span>เลขที่บิล</span><span className="font-bold">{sale.receiptNo}</span></div>
        <div className="flex justify-between gap-3"><span>วันที่/เวลา</span><span>{thDate(sale.createdAt)}</span></div>
        {sale.isLocal && <div className="flex justify-between gap-3"><span>สถานะซิงก์</span><span className="font-bold">{syncLabel}</span></div>}
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
            {role === "OWNER" && !printOnly && (
              <div className="mt-1 rounded bg-slate-50 p-2 text-xs text-slate-600">
                <div className="font-black">ต้นทุน FIFO: {baht(item.costPrice ?? 0)} / หน่วย | กำไร: {baht(item.lineProfit ?? 0)}</div>
                {(item.itemBatches ?? []).map((batch) => (
                  <div key={batch.id} className="mt-1 flex justify-between gap-2">
                    <span>ล็อต {thDate(batch.receivedAt)} x {batch.quantity}</span>
                    <span>{baht(batch.unitCost)} = {baht(batch.totalCost)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between text-lg font-black"><span>ยอดรวมทั้งหมด</span><span>{baht(sale.totalAmount)}</span></div>
        <div className="flex justify-between"><span>วิธีชำระเงิน</span><span>{paymentLabel(sale.paymentMethod)}</span></div>
        {sale.paymentMethod === "CREDIT" && (
          <>
            <div className="flex justify-between"><span>ลูกค้า</span><span className="text-right">{sale.creditCustomerName ?? "-"}</span></div>
            {sale.creditCustomerPhone && <div className="flex justify-between"><span>เบอร์โทร</span><span>{sale.creditCustomerPhone}</span></div>}
            <div className="flex justify-between font-black"><span>สถานะค้างชำระ</span><span>{creditStatusLabel(sale.creditStatus)}</span></div>
            <div className="flex justify-between"><span>ยอดค้าง</span><span>{baht(sale.creditDueAmount ?? sale.totalAmount)}</span></div>
            <div className="flex justify-between"><span>ชำระแล้ว</span><span>{baht(sale.creditPaidAmount ?? 0)}</span></div>
            <div className="flex justify-between"><span>ยอดคงเหลือ</span><span>{baht(Math.max((sale.creditDueAmount ?? sale.totalAmount) - (sale.creditPaidAmount ?? 0), 0))}</span></div>
            {(sale.creditPayments ?? []).length > 0 && (
              <div className="mt-2 border-t border-dashed border-slate-300 pt-2">
                <div className="font-black">ประวัติชำระ</div>
                {(sale.creditPayments ?? []).map((payment) => (
                  <div key={payment.id} className="mt-1 flex justify-between gap-3">
                    <span>{thDate(payment.createdAt)} {payment.note ? `- ${payment.note}` : ""}</span>
                    <span className="font-bold">{baht(payment.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {sale.paymentMethod === "CASH" && (
          <>
            <div className="flex justify-between"><span>รับเงิน</span><span>{baht(sale.cashReceived ?? 0)}</span></div>
            <div className="flex justify-between font-black"><span>เงินทอน</span><span>{baht(sale.changeAmount ?? 0)}</span></div>
          </>
        )}
      </div>
      {!printOnly && (
        <div className="mt-5 screen-only space-y-2">
          {onPrintSizeChange && (
            <div>
              <div className="mb-1 text-sm font-black text-slate-600">ขนาดใบเสร็จ</div>
              <div className="grid grid-cols-3 gap-2">
                {(["58", "80", "a4"] as const).map((size) => (
                  <button key={size} type="button" className={`btn min-h-10 py-1 text-sm ${printSize === size ? "btn-primary" : "btn-light"}`} onClick={() => onPrintSizeChange(size)}>
                    {size === "a4" ? "A4" : `${size}mm`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="btn btn-primary w-full" onClick={onPrint} type="button">พิมพ์ใบเสร็จ</button>
        </div>
      )}
    </div>
  );
}
