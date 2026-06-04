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
  returnedQty?: number;
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
  returns?: Array<{ id: string; reason: string | null; createdAt: string; items: Array<{ saleItemId: string; quantity: number; refundAmount: number }> }>;
  status?: "COMPLETED" | "VOIDED" | "RETURNED_PARTIAL";
  voidedAt?: string | null;
  voidReason?: string | null;
  itemCount: number;
  createdAt: string;
  items: SaleItem[];
  syncStatus?: LocalSyncStatus;
  isLocal?: boolean;
};
type ReceiptSettings = { storeName: string; receiptFooter: string; defaultReceiptSize: "58" | "80" | "a4" };

function csvValue(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function paymentLabel(paymentMethod: Sale["paymentMethod"]) {
  if (paymentMethod === "CREDIT") return "เน€เธเธดเธเน€เธเธทเนเธญ";
  return paymentMethod === "CASH" ? "เน€เธเธดเธเธชเธ”" : "เธฃเธฑเธเนเธญเธ";
}

function creditStatusLabel(status?: Sale["creditStatus"]) {
  if (status === "PAID") return "เธเธณเธฃเธฐเนเธฅเนเธง";
  if (status === "PARTIAL") return "เธเธณเธฃเธฐเธเธฒเธเธชเนเธงเธ";
  return "เธเนเธฒเธเธเธณเธฃเธฐ";
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [role, setRole] = useState<"OWNER" | "STAFF" | null>(null);
  const [printSize, setPrintSize] = useState<"58" | "80" | "a4">("80");
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>({ storeName: "MiniMart POS", receiptFooter: "", defaultReceiptSize: "80" });
  const [actionMessage, setActionMessage] = useState("");
  const [voidSale, setVoidSale] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [actionBusy, setActionBusy] = useState(false);

  async function loadSales() {
    const [cloudSales, localBundles] = await Promise.all([
      fetch("/api/sales").then((res) => res.json()),
      getLocalSaleBundles()
    ]);
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
        returns: [],
        status: "COMPLETED",
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
          returnedQty: 0,
          itemBatches: []
        }))
      }));
    const allSales = [...localSales, ...(Array.isArray(cloudSales) ? cloudSales : [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setSales(allSales);
  }

  useEffect(() => {
    fetch("/api/auth/me").then((res) => res.ok ? res.json() : null).then((data) => setRole(data?.role ?? null));
    fetch("/api/settings").then((res) => res.ok ? res.json() : null).then((data) => {
      if (!data) return;
      const defaultReceiptSize = data.defaultReceiptSize === "58" || data.defaultReceiptSize === "80" || data.defaultReceiptSize === "a4" ? data.defaultReceiptSize : "80";
      setReceiptSettings({
        storeName: data.storeName || "MiniMart POS",
        receiptFooter: data.receiptFooter || "",
        defaultReceiptSize
      });
      setPrintSize(defaultReceiptSize);
    }).catch(() => undefined);
    loadSales().catch(() => undefined);
  }, []);

  function exportCsv() {
    const headers = ["เน€เธฅเธเธ—เธตเนเธเธดเธฅ", "เธงเธฑเธเธ—เธตเน/เน€เธงเธฅเธฒ", "เธขเธญเธ”เธฃเธงเธก", "เธ•เนเธเธ—เธธเธเธฃเธงเธก", "เธเธณเนเธฃเธเธฑเนเธเธ•เนเธ", "เธงเธดเธเธตเธเธณเธฃเธฐเน€เธเธดเธ", "เธฅเธนเธเธเนเธฒเน€เธเธดเธเน€เธเธทเนเธญ", "เธชเธ–เธฒเธเธฐเน€เธเธดเธเน€เธเธทเนเธญ", "เธขเธญเธ”เน€เธเธดเธเน€เธเธทเนเธญ", "เธเธณเธฃเธฐเนเธฅเนเธง", "เธเธเน€เธซเธฅเธทเธญ", "เธฃเธฑเธเน€เธเธดเธ", "เน€เธเธดเธเธ—เธญเธ", "เธเธณเธเธงเธเธชเธดเธเธเนเธฒ"];
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

  async function submitVoid() {
    if (!voidSale || actionBusy) return;
    setActionBusy(true);
    setActionMessage("");
    try {
      const res = await fetch(`/api/sales/${voidSale.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เธขเธเน€เธฅเธดเธเธเธดเธฅเนเธกเนเธชเธณเน€เธฃเนเธ");
      setVoidSale(null);
      setVoidReason("");
      setActionMessage("เธขเธเน€เธฅเธดเธเธเธดเธฅเนเธฅเนเธง เนเธฅเธฐเธเธทเธเธชเธ•เนเธญเธเธชเธดเธเธเนเธฒเนเธฅเนเธง");
      await loadSales();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "เธขเธเน€เธฅเธดเธเธเธดเธฅเนเธกเนเธชเธณเน€เธฃเนเธ");
    } finally {
      setActionBusy(false);
    }
  }

  async function submitReturn() {
    if (!returnSale || actionBusy) return;
    const items = returnSale.items
      .map((item) => ({ saleItemId: item.id, quantity: Number(returnQty[item.id] || 0) }))
      .filter((item) => Number.isInteger(item.quantity) && item.quantity > 0);
    if (items.length === 0) return setActionMessage("เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธเธเธณเธเธงเธเธเธทเธเธชเธดเธเธเนเธฒ");
    setActionBusy(true);
    setActionMessage("");
    try {
      const res = await fetch(`/api/sales/${returnSale.id}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, reason: returnReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เธเธทเธเธชเธดเธเธเนเธฒเนเธกเนเธชเธณเน€เธฃเนเธ");
      setReturnSale(null);
      setReturnReason("");
      setReturnQty({});
      setActionMessage(`เธเธทเธเธชเธดเธเธเนเธฒเนเธฅเนเธง เธขเธญเธ”เธเธทเธ ${baht(data.totalRefund ?? 0)}`);
      await loadSales();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "เธเธทเธเธชเธดเธเธเนเธฒเนเธกเนเธชเธณเน€เธฃเนเธ");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="screen-only flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black">เธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเธเธฒเธข</h1>
          <p className="text-slate-500">เธ”เธนเธฃเธฒเธขเธเธฒเธฃเธเธฒเธข เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เนเธเน€เธชเธฃเนเธ เนเธฅเธฐเธชเนเธเธญเธญเธเธฃเธฒเธขเธเธฒเธ</p>
        </div>
        {role === "OWNER" && <button className="btn btn-primary" onClick={exportCsv} type="button">เธชเนเธเธญเธญเธ CSV</button>}
      </div>
      {actionMessage && <div className="screen-only rounded-lg border border-amber-200 bg-amber-50 p-3 font-black text-amber-900">{actionMessage}</div>}
      <div className="card screen-only overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-4 py-3">เน€เธฅเธเธ—เธตเนเนเธเน€เธชเธฃเนเธ</th><th className="px-4 py-3">เธงเธฑเธเน€เธงเธฅเธฒ</th><th className="px-4 py-3">เธเธณเธฃเธฐเน€เธเธดเธ</th><th className="px-4 py-3 text-center">เธเธณเธเธงเธเธชเธดเธเธเนเธฒ</th><th className="px-4 py-3 text-right">เธขเธญเธ”เธฃเธงเธก</th>{role === "OWNER" && <th className="px-4 py-3 text-right">เธเธณเนเธฃ</th>}<th className="px-4 py-3 text-right">เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”</th></tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <Fragment key={sale.id}>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-3 font-black">
                    <div>{sale.receiptNo}</div>
                    {sale.isLocal && <div className="mt-1 text-xs text-amber-700">{sale.syncStatus === "FAILED" ? "เธเธดเธเธเนเนเธกเนเธชเธณเน€เธฃเนเธ" : "เธฃเธญเธเธดเธเธเน"}</div>}
                  </td>
                  <td className="px-4 py-3">{thDate(sale.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div>{paymentLabel(sale.paymentMethod)}</div>
                    {sale.paymentMethod === "CREDIT" && <div className="mt-1 text-xs font-black text-amber-700">{sale.creditCustomerName} | {creditStatusLabel(sale.creditStatus)}</div>}
                  </td>
                  <td className="px-4 py-3 text-center">{sale.itemCount}</td>
                  <td className="px-4 py-3 text-right font-bold">{baht(sale.totalAmount)}</td>
                  {role === "OWNER" && <td className="px-4 py-3 text-right text-emerald-700">{baht(sale.grossProfit ?? 0)}</td>}
                  <td className="px-4 py-3 text-right"><button className="btn btn-light" onClick={() => setOpenId(openId === sale.id ? null : sale.id)} type="button">เธ”เธนเธเธดเธฅ</button></td>
                </tr>
                {openId === sale.id && (
                  <tr className="bg-slate-50">
                    <td className="px-4 py-4" colSpan={role === "OWNER" ? 7 : 6}>
                      <ReceiptDetail sale={sale} onPrint={() => printReceipt(sale.id)} role={role} printSize={printSize} onPrintSizeChange={setPrintSize} settings={receiptSettings} />
                      {role === "OWNER" && !sale.isLocal && sale.status !== "VOIDED" && (
                        <div className="screen-only mt-3 flex flex-wrap justify-center gap-2">
                          <button className="btn btn-light" onClick={() => { setReturnSale(sale); setReturnQty({}); setReturnReason(""); }} type="button">เธเธทเธเธชเธดเธเธเนเธฒ</button>
                          <button className="btn btn-danger" onClick={() => { setVoidSale(sale); setVoidReason(""); }} type="button">เธขเธเน€เธฅเธดเธเธเธดเธฅ</button>
                        </div>
                      )}
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
          <ReceiptDetail sale={sale} printOnly role={role} settings={receiptSettings} />
        </div>
      ))}
      {voidSale && (
        <div className="screen-only fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="card w-full max-w-md p-5">
            <h2 className="text-2xl font-black">เธขเธเน€เธฅเธดเธเธเธดเธฅ {voidSale.receiptNo}</h2>
            <p className="mt-2 font-bold text-red-700">เธฃเธฐเธเธเธเธฐเธเธทเธเธชเธ•เนเธญเธเธชเธดเธเธเนเธฒเธ—เธฑเนเธเธเธดเธฅ เนเธฅเธฐเธเธฑเธเธ—เธถเธเธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเธขเธเน€เธฅเธดเธ</p>
            <label className="mt-4 block space-y-1">
              <span className="font-black">เน€เธซเธ•เธธเธเธฅ</span>
              <input className="field" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} disabled={actionBusy} />
            </label>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button className="btn btn-light" onClick={() => setVoidSale(null)} disabled={actionBusy} type="button">เธเธดเธ”</button>
              <button className="btn btn-danger" onClick={submitVoid} disabled={actionBusy} type="button">{actionBusy ? "เธเธณเธฅเธฑเธเธเธฑเธเธ—เธถเธ..." : "เธขเธทเธเธขเธฑเธเธขเธเน€เธฅเธดเธ"}</button>
            </div>
          </div>
        </div>
      )}
      {returnSale && (
        <div className="screen-only fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="card max-h-[90vh] w-full max-w-xl overflow-y-auto p-5">
            <h2 className="text-2xl font-black">เธเธทเธเธชเธดเธเธเนเธฒ {returnSale.receiptNo}</h2>
            <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {returnSale.items.map((item) => {
                const maxReturn = Math.max(item.quantity - (item.returnedQty ?? 0), 0);
                return (
                  <label key={item.id} className="grid grid-cols-[1fr_110px] items-center gap-3 p-3">
                    <div>
                      <div className="font-black">{item.productNameSnapshot}</div>
                      <div className="text-sm font-bold text-slate-500">เธเธฒเธข {item.quantity} | เธเธทเธเนเธฅเนเธง {item.returnedQty ?? 0} | เธเธทเธเนเธ”เน {maxReturn}</div>
                    </div>
                    <input className="field" type="number" min="0" max={maxReturn} value={returnQty[item.id] ?? ""} onChange={(event) => setReturnQty((current) => ({ ...current, [item.id]: event.target.value }))} disabled={actionBusy || maxReturn === 0} />
                  </label>
                );
              })}
            </div>
            <label className="mt-4 block space-y-1">
              <span className="font-black">เน€เธซเธ•เธธเธเธฅ</span>
              <input className="field" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} disabled={actionBusy} />
            </label>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button className="btn btn-light" onClick={() => setReturnSale(null)} disabled={actionBusy} type="button">เธเธดเธ”</button>
              <button className="btn btn-primary" onClick={submitReturn} disabled={actionBusy} type="button">{actionBusy ? "เธเธณเธฅเธฑเธเธเธฑเธเธ—เธถเธ..." : "เธเธฑเธเธ—เธถเธเธเธทเธเธชเธดเธเธเนเธฒ"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ReceiptDetail({ sale, onPrint, printOnly = false, role, printSize, onPrintSizeChange, settings }: {
  sale: Sale;
  onPrint?: () => void;
  printOnly?: boolean;
  role: "OWNER" | "STAFF" | null;
  printSize?: "58" | "80" | "a4";
  onPrintSizeChange?: (size: "58" | "80" | "a4") => void;
  settings?: ReceiptSettings;
}) {
  const syncLabel = sale.syncStatus === "FAILED" ? "เธเธดเธเธเนเนเธกเนเธชเธณเน€เธฃเนเธ" : sale.syncStatus === "LOCAL_ONLY" || sale.syncStatus === "SYNCING" ? "เธฃเธญเธเธดเธเธเน" : "เธเธดเธเธเนเนเธฅเนเธง";
  return (
    <div className={`mx-auto max-w-md rounded-lg bg-white p-5 text-slate-950 ${printOnly ? "" : "border border-slate-200"}`}>
      <div className="text-center">
        <div className="text-2xl font-black">{settings?.storeName ?? "MiniMart POS"}</div>
        <div className="mt-1 text-sm">เนเธเน€เธชเธฃเนเธเธฃเธฑเธเน€เธเธดเธ</div>
      </div>
      <div className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between gap-3"><span>เน€เธฅเธเธ—เธตเนเธเธดเธฅ</span><span className="font-bold">{sale.receiptNo}</span></div>
        <div className="flex justify-between gap-3"><span>เธงเธฑเธเธ—เธตเน/เน€เธงเธฅเธฒ</span><span>{thDate(sale.createdAt)}</span></div>
        {sale.status === "VOIDED" && <div className="flex justify-between gap-3 font-black text-red-700"><span>สถานะ</span><span>ยกเลิกแล้ว</span></div>}
        {sale.status === "RETURNED_PARTIAL" && <div className="flex justify-between gap-3 font-black text-amber-700"><span>สถานะ</span><span>มีคืนสินค้า</span></div>}
        {sale.isLocal && <div className="flex justify-between gap-3"><span>เธชเธ–เธฒเธเธฐเธเธดเธเธเน</span><span className="font-bold">{syncLabel}</span></div>}
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
            {(item.returnedQty ?? 0) > 0 && <div className="mt-1 text-xs font-black text-amber-700">คืนแล้ว {item.returnedQty} รายการ</div>}
            {role === "OWNER" && !printOnly && (
              <div className="mt-1 rounded bg-slate-50 p-2 text-xs text-slate-600">
                <div className="font-black">เธ•เนเธเธ—เธธเธ FIFO: {baht(item.costPrice ?? 0)} / เธซเธเนเธงเธข | เธเธณเนเธฃ: {baht(item.lineProfit ?? 0)}</div>
                {(item.itemBatches ?? []).map((batch) => (
                  <div key={batch.id} className="mt-1 flex justify-between gap-2">
                    <span>เธฅเนเธญเธ• {thDate(batch.receivedAt)} x {batch.quantity}</span>
                    <span>{baht(batch.unitCost)} = {baht(batch.totalCost)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between text-lg font-black"><span>เธขเธญเธ”เธฃเธงเธกเธ—เธฑเนเธเธซเธกเธ”</span><span>{baht(sale.totalAmount)}</span></div>
        <div className="flex justify-between"><span>เธงเธดเธเธตเธเธณเธฃเธฐเน€เธเธดเธ</span><span>{paymentLabel(sale.paymentMethod)}</span></div>
        {sale.paymentMethod === "CREDIT" && (
          <>
            <div className="flex justify-between"><span>เธฅเธนเธเธเนเธฒ</span><span className="text-right">{sale.creditCustomerName ?? "-"}</span></div>
            {sale.creditCustomerPhone && <div className="flex justify-between"><span>เน€เธเธญเธฃเนเนเธ—เธฃ</span><span>{sale.creditCustomerPhone}</span></div>}
            <div className="flex justify-between font-black"><span>เธชเธ–เธฒเธเธฐเธเนเธฒเธเธเธณเธฃเธฐ</span><span>{creditStatusLabel(sale.creditStatus)}</span></div>
            <div className="flex justify-between"><span>เธขเธญเธ”เธเนเธฒเธ</span><span>{baht(sale.creditDueAmount ?? sale.totalAmount)}</span></div>
            <div className="flex justify-between"><span>เธเธณเธฃเธฐเนเธฅเนเธง</span><span>{baht(sale.creditPaidAmount ?? 0)}</span></div>
            <div className="flex justify-between"><span>เธขเธญเธ”เธเธเน€เธซเธฅเธทเธญ</span><span>{baht(Math.max((sale.creditDueAmount ?? sale.totalAmount) - (sale.creditPaidAmount ?? 0), 0))}</span></div>
            {(sale.creditPayments ?? []).length > 0 && (
              <div className="mt-2 border-t border-dashed border-slate-300 pt-2">
                <div className="font-black">เธเธฃเธฐเธงเธฑเธ•เธดเธเธณเธฃเธฐ</div>
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
            <div className="flex justify-between"><span>เธฃเธฑเธเน€เธเธดเธ</span><span>{baht(sale.cashReceived ?? 0)}</span></div>
            <div className="flex justify-between font-black"><span>เน€เธเธดเธเธ—เธญเธ</span><span>{baht(sale.changeAmount ?? 0)}</span></div>
          </>
        )}
        {settings?.receiptFooter && <div className="border-t border-dashed border-slate-300 pt-3 text-center font-bold">{settings.receiptFooter}</div>}
      </div>
      {!printOnly && (
        <div className="mt-5 screen-only space-y-2">
          {onPrintSizeChange && (
            <div>
              <div className="mb-1 text-sm font-black text-slate-600">เธเธเธฒเธ”เนเธเน€เธชเธฃเนเธ</div>
              <div className="grid grid-cols-3 gap-2">
                {(["58", "80", "a4"] as const).map((size) => (
                  <button key={size} type="button" className={`btn min-h-10 py-1 text-sm ${printSize === size ? "btn-primary" : "btn-light"}`} onClick={() => onPrintSizeChange(size)}>
                    {size === "a4" ? "A4" : `${size}mm`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="btn btn-primary w-full" onClick={onPrint} type="button">เธเธดเธกเธเนเนเธเน€เธชเธฃเนเธ</button>
        </div>
      )}
    </div>
  );
}

