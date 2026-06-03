"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { baht, thDate } from "@/lib/format";

export type CreditSaleRow = {
  id: string;
  receiptNo: string;
  createdAt: string;
  customerName: string;
  phone: string;
  due: number;
  paid: number;
  remaining: number;
  status: string;
  payments: Array<{ id: string; amount: number; note: string | null; createdAt: string }>;
};

function creditStatusLabel(status?: string | null) {
  if (status === "PAID") return "ชำระแล้ว";
  if (status === "PARTIAL") return "ชำระบางส่วน";
  return "ค้างชำระ";
}

function MetricCard({ label, value, tone = "slate" }: { label: string; value: string | number; tone?: "slate" | "green" | "teal" | "amber" }) {
  const toneClass = tone === "green" ? "text-emerald-700" : tone === "teal" ? "text-teal-700" : tone === "amber" ? "text-amber-700" : "text-slate-950";
  return (
    <div className="card p-5">
      <div className="text-base font-black text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

export function CreditsClient({ initialRows }: { initialRows: CreditSaleRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [paymentSale, setPaymentSale] = useState<CreditSaleRow | null>(null);
  const [historySale, setHistorySale] = useState<CreditSaleRow | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const totals = useMemo(() => {
    const totalCredit = rows.reduce((sum, sale) => sum + sale.due, 0);
    const paidTotal = rows.reduce((sum, sale) => sum + sale.paid, 0);
    const unpaidTotal = rows.reduce((sum, sale) => sum + sale.remaining, 0);
    const openBillCount = rows.filter((sale) => sale.status !== "PAID").length;
    return { totalCredit, paidTotal, unpaidTotal, openBillCount };
  }, [rows]);

  function openPaymentModal(sale: CreditSaleRow) {
    setPaymentSale(sale);
    setAmount(sale.remaining.toFixed(2).replace(/\.00$/, ""));
    setNote("");
    setMessage("");
  }

  async function savePayment(event: React.FormEvent) {
    event.preventDefault();
    if (!paymentSale || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/credits/${paymentSale.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), note })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "บันทึกรับชำระไม่สำเร็จ");

      setRows((current) =>
        current.map((sale) =>
          sale.id === paymentSale.id
            ? {
                ...sale,
                paid: data.sale.creditPaidAmount,
                remaining: data.remainingAmount,
                status: data.creditStatus,
                payments: [data.payment, ...sale.payments]
              }
            : sale
        )
      );
      setPaymentSale(null);
      setMessage("บันทึกรับชำระเงินเชื่อแล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกรับชำระไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-3xl font-black">เงินเชื่อ</h1>
        <p className="mt-2 text-lg font-bold text-slate-500">รายการขายเงินเชื่อและยอดค้างชำระ</p>
      </div>

      {message && <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 font-black text-teal-800">{message}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="ยอดเงินเชื่อทั้งหมด" value={baht(totals.totalCredit)} tone="teal" />
        <MetricCard label="ยอดค้างชำระ" value={baht(totals.unpaidTotal)} tone="amber" />
        <MetricCard label="จำนวนบิลค้างชำระ" value={totals.openBillCount} />
        <MetricCard label="ชำระแล้ว" value={baht(totals.paidTotal)} tone="green" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">วันที่</th>
              <th className="px-4 py-3">เลขที่บิล</th>
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3">เบอร์โทร</th>
              <th className="px-4 py-3 text-right">ยอดค้าง</th>
              <th className="px-4 py-3 text-right">ชำระแล้ว</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((sale) => (
              <tr key={sale.id} className={`border-t border-slate-100 ${sale.status === "PAID" ? "bg-slate-50 text-slate-500" : ""}`}>
                <td className="px-4 py-3">{thDate(sale.createdAt)}</td>
                <td className="px-4 py-3 font-black">{sale.receiptNo}</td>
                <td className="px-4 py-3">{sale.customerName}</td>
                <td className="px-4 py-3">{sale.phone}</td>
                <td className="px-4 py-3 text-right font-black text-amber-700">{baht(sale.remaining)}</td>
                <td className="px-4 py-3 text-right">{baht(sale.paid)}</td>
                <td className="px-4 py-3 font-black">{creditStatusLabel(sale.status)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button className="btn btn-primary min-h-10 px-3 py-1 text-sm" disabled={sale.status === "PAID"} onClick={() => openPaymentModal(sale)} type="button">
                      รับชำระ
                    </button>
                    <button className="btn btn-light min-h-10 px-3 py-1 text-sm" onClick={() => setHistorySale(sale)} type="button">
                      ดูประวัติชำระ
                    </button>
                    <Link className="btn btn-light min-h-10 px-3 py-1 text-sm" href="/sales">
                      ดูบิล
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center font-bold text-slate-500" colSpan={8}>
                  ยังไม่มีรายการเงินเชื่อ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {paymentSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={savePayment} className="card w-full max-w-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-black text-teal-700">รับชำระเงินเชื่อ</div>
                <h2 className="mt-1 text-2xl font-black">{paymentSale.customerName}</h2>
                <div className="mt-1 text-sm font-bold text-slate-500">{paymentSale.receiptNo}</div>
              </div>
              <button className="btn btn-light touch-icon-button" disabled={saving} onClick={() => setPaymentSale(null)} type="button" title="ยกเลิก">
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm font-bold sm:grid-cols-2">
              <div>ยอดเงินเชื่อ: <span className="font-black">{baht(paymentSale.due)}</span></div>
              <div>ชำระแล้ว: <span className="font-black">{baht(paymentSale.paid)}</span></div>
              <div className="sm:col-span-2">ยอดค้าง: <span className="font-black text-amber-700">{baht(paymentSale.remaining)}</span></div>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block space-y-1">
                <span className="font-black">จำนวนเงินที่รับ</span>
                <input className="field" type="number" min="0.01" max={paymentSale.remaining} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={saving} />
              </label>
              <label className="block space-y-1">
                <span className="font-black">หมายเหตุ</span>
                <input className="field" value={note} onChange={(event) => setNote(event.target.value)} disabled={saving} />
              </label>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button className="btn btn-primary" disabled={saving} type="submit">
                {saving && <LoaderCircle className="animate-spin" size={20} />}
                {saving ? "กำลังบันทึก..." : "บันทึกรับชำระ"}
              </button>
              <button className="btn btn-light" disabled={saving} onClick={() => setPaymentSale(null)} type="button">
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      )}

      {historySale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="card w-full max-w-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-black text-teal-700">ประวัติชำระ</div>
                <h2 className="mt-1 text-2xl font-black">{historySale.customerName}</h2>
                <div className="mt-1 text-sm font-bold text-slate-500">{historySale.receiptNo}</div>
              </div>
              <button className="btn btn-light touch-icon-button" onClick={() => setHistorySale(null)} type="button" title="ปิด">
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {historySale.payments.length === 0 ? (
                <div className="p-4 text-center font-bold text-slate-500">ยังไม่มีประวัติชำระ</div>
              ) : (
                historySale.payments.map((payment) => (
                  <div key={payment.id} className="flex justify-between gap-4 p-3">
                    <div>
                      <div className="font-black">{thDate(payment.createdAt)}</div>
                      <div className="text-sm font-bold text-slate-500">{payment.note ?? "-"}</div>
                    </div>
                    <div className="font-black text-teal-700">{baht(payment.amount)}</div>
                  </div>
                ))
              )}
            </div>
            <button className="btn btn-primary mt-5 w-full" onClick={() => setHistorySale(null)} type="button">ปิด</button>
          </div>
        </div>
      )}
    </section>
  );
}
