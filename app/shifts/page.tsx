"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { baht, thDate } from "@/lib/format";

type CashShift = {
  id: string;
  openedByRole: string | null;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  cashSalesTotal: number;
  transferSalesTotal: number;
  creditSalesTotal: number;
  totalSales: number;
  billCount: number;
  note: string | null;
  status: string;
};

type RunningTotals = {
  cashSalesTotal: number;
  transferSalesTotal: number;
  creditSalesTotal: number;
  totalSales: number;
  billCount: number;
  expectedCash: number;
};

type ShiftData = {
  current: CashShift | null;
  runningTotals: RunningTotals | null;
  history: CashShift[];
};

function diffLabel(closing: number, expected: number) {
  const diff = closing - expected;
  if (Math.abs(diff) < 0.01) return { text: "สมดุล", cls: "text-emerald-700" };
  if (diff > 0) return { text: `เงินเกิน ${baht(diff)}`, cls: "text-blue-700" };
  return { text: `เงินขาด ${baht(Math.abs(diff))}`, cls: "text-red-700" };
}

export default function ShiftsPage() {
  const [data, setData] = useState<ShiftData | null>(null);
  const [message, setMessage] = useState("");
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [printShift, setPrintShift] = useState<CashShift | null>(null);

  async function load() {
    const res = await fetch("/api/shifts");
    if (res.ok) setData(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function openShift(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingCash: Number(openingCash) })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "เปิดกะไม่สำเร็จ");
      setOpeningCash("0");
      setMessage("เปิดกะสำเร็จ");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เปิดกะไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function closeShift(event: React.FormEvent) {
    event.preventDefault();
    if (!data?.current || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/shifts/${data.current.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingCash: Number(closingCash), note: closeNote })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "ปิดกะไม่สำเร็จ");
      setClosingCash("");
      setCloseNote("");
      setMessage("ปิดกะสำเร็จ");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ปิดกะไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const current = data?.current;
  const totals = data?.runningTotals;

  function printCloseReport(shift: CashShift) {
    setPrintShift(shift);
    window.setTimeout(() => window.print(), 50);
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">กะขาย</h1>
        <p className="text-slate-500">เปิด-ปิดกะ และดูสรุปยอดขายแต่ละกะ</p>
      </div>

      {message && (
        <div className={`rounded-lg border px-4 py-3 font-black ${message.includes("ไม่สำเร็จ") || message.includes("ขาด") ? "border-red-200 bg-red-50 text-red-700" : "border-teal-200 bg-teal-50 text-teal-800"}`}>
          {message}
        </div>
      )}

      {!current ? (
        <form onSubmit={openShift} className="card p-5">
          <h2 className="text-xl font-black">เปิดกะใหม่</h2>
          <p className="mt-1 font-bold text-slate-500">กรุณาระบุเงินสดเริ่มต้นในกล่องรับเงิน</p>
          <label className="mt-4 block space-y-1">
            <span className="font-black">เงินทอนเริ่มต้น (บาท)</span>
            <input className="field max-w-sm" type="number" min="0" step="0.01" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} disabled={saving} />
          </label>
          <button className="btn btn-primary mt-5" disabled={saving} type="submit">
            {saving && <LoaderCircle className="animate-spin" size={20} />}
            เปิดกะ
          </button>
        </form>
      ) : (
        <>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-lg font-black text-emerald-700">กะเปิดอยู่</span>
            </div>
            <div className="mt-3 grid gap-2 text-sm font-bold text-slate-700 sm:grid-cols-2">
              <div>เปิดกะเวลา: <span className="font-black text-slate-950">{thDate(current.openedAt)}</span></div>
              <div>เงินทอนเริ่มต้น: <span className="font-black text-slate-950">{baht(current.openingCash)}</span></div>
            </div>
          </div>

          {totals && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="card p-4">
                <div className="text-sm font-bold text-slate-500">ยอดขายเงินสด</div>
                <div className="mt-1 text-2xl font-black">{baht(totals.cashSalesTotal)}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm font-bold text-slate-500">ยอดโอน</div>
                <div className="mt-1 text-2xl font-black">{baht(totals.transferSalesTotal)}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm font-bold text-slate-500">ยอดเงินเชื่อ</div>
                <div className="mt-1 text-2xl font-black">{baht(totals.creditSalesTotal)}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm font-bold text-slate-500">ยอดขายรวม</div>
                <div className="mt-1 text-2xl font-black text-teal-700">{baht(totals.totalSales)}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm font-bold text-slate-500">จำนวนบิล</div>
                <div className="mt-1 text-2xl font-black">{totals.billCount} บิล</div>
              </div>
              <div className="card p-4">
                <div className="text-sm font-bold text-slate-500">เงินสดที่ควรมี</div>
                <div className="mt-1 text-2xl font-black">{baht(totals.expectedCash)}</div>
              </div>
            </div>
          )}

          <form onSubmit={closeShift} className="card p-5">
            <h2 className="text-xl font-black">ปิดกะ</h2>
            <p className="mt-1 font-bold text-slate-500">นับเงินสดจริงในกล่อง แล้วกรอกจำนวนเพื่อปิดกะ</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="font-black">เงินสดปิดกะ (บาท)</span>
                <input className="field" type="number" min="0" step="0.01" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} disabled={saving} required />
              </label>
              <label className="space-y-1">
                <span className="font-black">หมายเหตุ</span>
                <input className="field" value={closeNote} onChange={(e) => setCloseNote(e.target.value)} disabled={saving} />
              </label>
            </div>
            {closingCash && totals && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold">
                <div className="flex justify-between gap-3"><span>เงินสดที่ควรมี</span><span>{baht(totals.expectedCash)}</span></div>
                <div className="flex justify-between gap-3"><span>เงินสดปิดกะ</span><span>{baht(Number(closingCash))}</span></div>
                <div className={`mt-2 flex justify-between gap-3 font-black ${diffLabel(Number(closingCash), totals.expectedCash).cls}`}>
                  <span>ผลต่าง</span><span>{diffLabel(Number(closingCash), totals.expectedCash).text}</span>
                </div>
              </div>
            )}
            <button className="btn btn-danger mt-5" disabled={saving || !closingCash} type="submit">
              {saving && <LoaderCircle className="animate-spin" size={20} />}
              ปิดกะ
            </button>
          </form>
        </>
      )}

      {(data?.history?.length ?? 0) > 0 && (
        <div className="card overflow-x-auto">
          <div className="px-4 pt-4 pb-2 text-xl font-black">ประวัติกะ</div>
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">เปิดกะ</th>
                <th className="px-4 py-3">ปิดกะ</th>
                <th className="px-4 py-3 text-right">เงินทอน</th>
                <th className="px-4 py-3 text-right">ยอดขายรวม</th>
                <th className="px-4 py-3 text-right">บิล</th>
                <th className="px-4 py-3 text-right">เงินสดที่ควรมี</th>
                <th className="px-4 py-3 text-right">เงินปิดกะ</th>
                <th className="px-4 py-3">ผลต่าง</th>
                <th className="px-4 py-3 text-right">รายงาน</th>
              </tr>
            </thead>
            <tbody>
              {data?.history.map((shift) => {
                const diff = shift.closingCash !== null && shift.expectedCash !== null ? diffLabel(Number(shift.closingCash), Number(shift.expectedCash)) : null;
                return (
                  <tr key={shift.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{thDate(shift.openedAt)}</td>
                    <td className="px-4 py-3">{shift.closedAt ? thDate(shift.closedAt) : "-"}</td>
                    <td className="px-4 py-3 text-right">{baht(shift.openingCash)}</td>
                    <td className="px-4 py-3 text-right font-black">{baht(shift.totalSales)}</td>
                    <td className="px-4 py-3 text-right">{shift.billCount}</td>
                    <td className="px-4 py-3 text-right">{shift.expectedCash !== null ? baht(shift.expectedCash) : "-"}</td>
                    <td className="px-4 py-3 text-right">{shift.closingCash !== null ? baht(shift.closingCash) : "-"}</td>
                    <td className={`px-4 py-3 font-black ${diff?.cls ?? ""}`}>{diff?.text ?? "-"}</td>
                    <td className="px-4 py-3 text-right"><button className="btn btn-light" onClick={() => printCloseReport(shift)} type="button">พิมพ์</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {printShift && (
        <div className="receipt-print size-a4">
          <div className="mx-auto max-w-md bg-white p-6 text-slate-950">
            <div className="text-center text-2xl font-black">รายงานปิดกะ</div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>เปิดกะ</span><span>{thDate(printShift.openedAt)}</span></div>
              <div className="flex justify-between"><span>ปิดกะ</span><span>{printShift.closedAt ? thDate(printShift.closedAt) : "-"}</span></div>
              <div className="flex justify-between"><span>เงินทอนเริ่มต้น</span><span>{baht(printShift.openingCash)}</span></div>
              <div className="flex justify-between"><span>ยอดขายเงินสด</span><span>{baht(printShift.cashSalesTotal)}</span></div>
              <div className="flex justify-between"><span>ยอดโอน</span><span>{baht(printShift.transferSalesTotal)}</span></div>
              <div className="flex justify-between"><span>ยอดเงินเชื่อ</span><span>{baht(printShift.creditSalesTotal)}</span></div>
              <div className="flex justify-between font-black"><span>ยอดขายรวม</span><span>{baht(printShift.totalSales)}</span></div>
              <div className="flex justify-between"><span>จำนวนบิล</span><span>{printShift.billCount}</span></div>
              <div className="flex justify-between"><span>เงินสดที่ควรมี</span><span>{printShift.expectedCash !== null ? baht(printShift.expectedCash) : "-"}</span></div>
              <div className="flex justify-between"><span>เงินสดปิดกะ</span><span>{printShift.closingCash !== null ? baht(printShift.closingCash) : "-"}</span></div>
            </div>
          </div>
        </div>
      )}    </section>
  );
}

