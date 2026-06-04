"use client";

import { useEffect, useState } from "react";

type Settings = {
  storeName: string;
  receiptFooter: string;
  defaultReceiptSize: "58" | "80" | "a4";
  enableCreditSales: boolean;
  requireOpenShiftBeforeSale: boolean;
  lowStockDashboardLimit: number;
  backupReminderEnabled: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then(setSettings)
      .catch(() => setMessage("โหลดการตั้งค่าไม่สำเร็จ"));
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => current ? { ...current, [key]: value } : current);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "บันทึกการตั้งค่าไม่สำเร็จ");
      setSettings(data);
      setMessage("บันทึกการตั้งค่าแล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกการตั้งค่าไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <div className="font-black text-slate-500">กำลังโหลดการตั้งค่า...</div>;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">ตั้งค่า</h1>
        <p className="text-slate-500">ตั้งค่าร้านและพฤติกรรมการขายที่ปลอดภัย</p>
      </div>
      {message && <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 font-black text-teal-800">{message}</div>}

      <form onSubmit={save} className="card max-w-3xl space-y-5 p-5">
        <label className="block space-y-1">
          <span className="font-black">ชื่อร้าน</span>
          <input className="field" value={settings.storeName} onChange={(event) => update("storeName", event.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="font-black">ข้อความท้ายใบเสร็จ</span>
          <textarea className="field min-h-24" value={settings.receiptFooter} onChange={(event) => update("receiptFooter", event.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="font-black">ขนาดใบเสร็จเริ่มต้น</span>
          <select className="field" value={settings.defaultReceiptSize} onChange={(event) => update("defaultReceiptSize", event.target.value as Settings["defaultReceiptSize"])}>
            <option value="58">58mm</option>
            <option value="80">80mm</option>
            <option value="a4">A4</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-black">จำนวนสินค้าใกล้หมดที่แสดงใน Dashboard</span>
          <input className="field" type="number" min="1" max="100" value={settings.lowStockDashboardLimit} onChange={(event) => update("lowStockDashboardLimit", Number(event.target.value))} />
        </label>
        <label className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 font-black">
          <input className="h-5 w-5" type="checkbox" checked={settings.enableCreditSales} onChange={(event) => update("enableCreditSales", event.target.checked)} />
          เปิดขายเงินเชื่อ
        </label>
        <label className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 font-black">
          <input className="h-5 w-5" type="checkbox" checked={settings.requireOpenShiftBeforeSale} onChange={(event) => update("requireOpenShiftBeforeSale", event.target.checked)} />
          ต้องเปิดกะก่อนขาย
        </label>
        <label className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 font-black">
          <input className="h-5 w-5" type="checkbox" checked={settings.backupReminderEnabled} onChange={(event) => update("backupReminderEnabled", event.target.checked)} />
          เปิดเตือนสำรองข้อมูล
        </label>
        <button className="btn btn-primary w-full" disabled={saving} type="submit">{saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}</button>
      </form>
    </section>
  );
}
