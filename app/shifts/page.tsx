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
  if (Math.abs(diff) < 0.01) return { text: "เธชเธกเธ”เธธเธฅ", cls: "text-emerald-700" };
  if (diff > 0) return { text: `เน€เธเธดเธเน€เธเธดเธ ${baht(diff)}`, cls: "text-blue-700" };
  return { text: `เน€เธเธดเธเธเธฒเธ” ${baht(Math.abs(diff))}`, cls: "text-red-700" };
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
      if (!res.ok) throw new Error(body.error ?? "เน€เธเธดเธ”เธเธฐเนเธกเนเธชเธณเน€เธฃเนเธ");
      setOpeningCash("0");
      setMessage("เน€เธเธดเธ”เธเธฐเธชเธณเน€เธฃเนเธ");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เน€เธเธดเธ”เธเธฐเนเธกเนเธชเธณเน€เธฃเนเธ");
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
      if (!res.ok) throw new Error(body.error ?? "เธเธดเธ”เธเธฐเนเธกเนเธชเธณเน€เธฃเนเธ");
      setClosingCash("");
      setCloseNote("");
      setMessage("เธเธดเธ”เธเธฐเธชเธณเน€เธฃเนเธ");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เธเธดเธ”เธเธฐเนเธกเนเธชเธณเน€เธฃเนเธ");
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
        <h1 className="text-2xl font-black">เธเธฐเธเธฒเธข</h1>
        <p className="text-slate-500">เน€เธเธดเธ”-เธเธดเธ”เธเธฐ เนเธฅเธฐเธ”เธนเธชเธฃเธธเธเธขเธญเธ”เธเธฒเธขเนเธ•เนเธฅเธฐเธเธฐ</p>
      </div>

      {message && (
        <div className={`rounded-lg border px-4 py-3 font-black ${message.includes("เนเธกเนเธชเธณเน€เธฃเนเธ") || message.includes("เธเธฒเธ”") ? "border-red-200 bg-red-50 text-red-700" : "border-teal-200 bg-teal-50 text-teal-800"}`}>
          {message}
        </div>
      )}

      {!current ? (
        <form onSubmit={openShift} className="card p-5">
          <h2 className="text-xl font-black">เน€เธเธดเธ”เธเธฐเนเธซเธกเน</h2>
          <p className="mt-1 font-bold text-slate-500">เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธเน€เธเธดเธเธชเธ”เน€เธฃเธดเนเธกเธ•เนเธเนเธเธเธฅเนเธญเธเธฃเธฑเธเน€เธเธดเธ</p>
          <label className="mt-4 block space-y-1">
            <span className="font-black">เน€เธเธดเธเธ—เธญเธเน€เธฃเธดเนเธกเธ•เนเธ (เธเธฒเธ—)</span>
            <input className="field max-w-sm" type="number" min="0" step="0.01" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} disabled={saving} />
          </label>
          <button className="btn btn-primary mt-5" disabled={saving} type="submit">
            {saving && <LoaderCircle className="animate-spin" size={20} />}
            เน€เธเธดเธ”เธเธฐ
          </button>
        </form>
      ) : (
        <>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-lg font-black text-emerald-700">เธเธฐเน€เธเธดเธ”เธญเธขเธนเน</span>
            </div>
            <div className="mt-3 grid gap-2 text-sm font-bold text-slate-700 sm:grid-cols-2">
              <div>เน€เธเธดเธ”เธเธฐเน€เธงเธฅเธฒ: <span className="font-black text-slate-950">{thDate(current.openedAt)}</span></div>
              <div>เน€เธเธดเธเธ—เธญเธเน€เธฃเธดเนเธกเธ•เนเธ: <span className="font-black text-slate-950">{baht(current.openingCash)}</span></div>
            </div>
          </div>

          {totals && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="card p-4">
                <div className="text-sm font-bold text-slate-500">เธขเธญเธ”เธเธฒเธขเน€เธเธดเธเธชเธ”</div>
                <div className="mt-1 text-2xl font-black">{baht(totals.cashSalesTotal)}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm font-bold text-slate-500">เธขเธญเธ”เนเธญเธ</div>
                <div className="mt-1 text-2xl font-black">{baht(totals.transferSalesTotal)}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm font-bold text-slate-500">เธขเธญเธ”เน€เธเธดเธเน€เธเธทเนเธญ</div>
                <div className="mt-1 text-2xl font-black">{baht(totals.creditSalesTotal)}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm font-bold text-slate-500">เธขเธญเธ”เธเธฒเธขเธฃเธงเธก</div>
                <div className="mt-1 text-2xl font-black text-teal-700">{baht(totals.totalSales)}</div>
              </div>
              <div className="card p-4">
                <div className="text-sm font-bold text-slate-500">เธเธณเธเธงเธเธเธดเธฅ</div>
                <div className="mt-1 text-2xl font-black">{totals.billCount} เธเธดเธฅ</div>
              </div>
              <div className="card p-4">
                <div className="text-sm font-bold text-slate-500">เน€เธเธดเธเธชเธ”เธ—เธตเนเธเธงเธฃเธกเธต</div>
                <div className="mt-1 text-2xl font-black">{baht(totals.expectedCash)}</div>
              </div>
            </div>
          )}

          <form onSubmit={closeShift} className="card p-5">
            <h2 className="text-xl font-black">เธเธดเธ”เธเธฐ</h2>
            <p className="mt-1 font-bold text-slate-500">เธเธฑเธเน€เธเธดเธเธชเธ”เธเธฃเธดเธเนเธเธเธฅเนเธญเธ เนเธฅเนเธงเธเธฃเธญเธเธเธณเธเธงเธเน€เธเธทเนเธญเธเธดเธ”เธเธฐ</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="font-black">เน€เธเธดเธเธชเธ”เธเธดเธ”เธเธฐ (เธเธฒเธ—)</span>
                <input className="field" type="number" min="0" step="0.01" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} disabled={saving} required />
              </label>
              <label className="space-y-1">
                <span className="font-black">เธซเธกเธฒเธขเน€เธซเธ•เธธ</span>
                <input className="field" value={closeNote} onChange={(e) => setCloseNote(e.target.value)} disabled={saving} />
              </label>
            </div>
            {closingCash && totals && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold">
                <div className="flex justify-between gap-3"><span>เน€เธเธดเธเธชเธ”เธ—เธตเนเธเธงเธฃเธกเธต</span><span>{baht(totals.expectedCash)}</span></div>
                <div className="flex justify-between gap-3"><span>เน€เธเธดเธเธชเธ”เธเธดเธ”เธเธฐ</span><span>{baht(Number(closingCash))}</span></div>
                <div className={`mt-2 flex justify-between gap-3 font-black ${diffLabel(Number(closingCash), totals.expectedCash).cls}`}>
                  <span>เธเธฅเธ•เนเธฒเธ</span><span>{diffLabel(Number(closingCash), totals.expectedCash).text}</span>
                </div>
              </div>
            )}
            <button className="btn btn-danger mt-5" disabled={saving || !closingCash} type="submit">
              {saving && <LoaderCircle className="animate-spin" size={20} />}
              เธเธดเธ”เธเธฐ
            </button>
          </form>
        </>
      )}

      {(data?.history?.length ?? 0) > 0 && (
        <div className="card overflow-x-auto">
          <div className="px-4 pt-4 pb-2 text-xl font-black">เธเธฃเธฐเธงเธฑเธ•เธดเธเธฐ</div>
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">เน€เธเธดเธ”เธเธฐ</th>
                <th className="px-4 py-3">เธเธดเธ”เธเธฐ</th>
                <th className="px-4 py-3 text-right">เน€เธเธดเธเธ—เธญเธ</th>
                <th className="px-4 py-3 text-right">เธขเธญเธ”เธเธฒเธขเธฃเธงเธก</th>
                <th className="px-4 py-3 text-right">เธเธดเธฅ</th>
                <th className="px-4 py-3 text-right">เน€เธเธดเธเธชเธ”เธ—เธตเนเธเธงเธฃเธกเธต</th>
                <th className="px-4 py-3 text-right">เน€เธเธดเธเธเธดเธ”เธเธฐ</th>
                <th className="px-4 py-3">เธเธฅเธ•เนเธฒเธ</th>
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

