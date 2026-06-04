"use client";

import { useEffect, useMemo, useState } from "react";
import { thDate } from "@/lib/format";

type AuditLog = {
  id: string;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string | null;
  metadata: unknown;
  createdAt: string;
};

function metadataText(metadata: unknown) {
  if (!metadata || metadata === null) return "-";
  try {
    const text = JSON.stringify(metadata);
    return text === "null" ? "-" : text;
  } catch {
    return "-";
  }
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      if (entityType) params.set("entityType", entityType);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/audit?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "โหลดประวัติระบบไม่สำเร็จ");
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดประวัติระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actions = useMemo(() => [...new Set(logs.map((log) => log.action))].sort(), [logs]);
  const entityTypes = useMemo(() => [...new Set(logs.map((log) => log.entityType))].sort(), [logs]);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">ประวัติระบบ</h1>
        <p className="text-slate-500">ตรวจสอบการทำรายการสำคัญของระบบ</p>
      </div>

      <form className="card grid gap-3 p-4 md:grid-cols-5" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <label className="space-y-1">
          <span className="font-black">การกระทำ</span>
          <input className="field" list="audit-actions" value={action} onChange={(event) => setAction(event.target.value)} placeholder="เช่น SALE_CREATED" />
          <datalist id="audit-actions">{actions.map((entry) => <option key={entry} value={entry} />)}</datalist>
        </label>
        <label className="space-y-1">
          <span className="font-black">ประเภทรายการ</span>
          <input className="field" list="audit-entities" value={entityType} onChange={(event) => setEntityType(event.target.value)} placeholder="เช่น Sale" />
          <datalist id="audit-entities">{entityTypes.map((entry) => <option key={entry} value={entry} />)}</datalist>
        </label>
        <label className="space-y-1">
          <span className="font-black">จากวันที่</span>
          <input className="field" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="font-black">ถึงวันที่</span>
          <input className="field" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <div className="flex items-end gap-2">
          <button className="btn btn-primary w-full" disabled={loading} type="submit">{loading ? "กำลังโหลด..." : "ค้นหา"}</button>
        </div>
      </form>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 font-black text-red-700">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">วันที่/เวลา</th>
              <th className="px-4 py-3">ผู้ใช้งาน/สิทธิ์</th>
              <th className="px-4 py-3">การกระทำ</th>
              <th className="px-4 py-3">รายการ</th>
              <th className="px-4 py-3">รายละเอียด</th>
              <th className="px-4 py-3">ข้อมูลเพิ่มเติม</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3">{thDate(log.createdAt)}</td>
                <td className="px-4 py-3 font-bold">{log.actorRole ?? "-"}</td>
                <td className="px-4 py-3 font-black text-teal-700">{log.action}</td>
                <td className="px-4 py-3">{log.entityType}{log.entityId ? ` / ${log.entityId}` : ""}</td>
                <td className="px-4 py-3">{log.description ?? "-"}</td>
                <td className="max-w-sm px-4 py-3 text-xs text-slate-500">{metadataText(log.metadata)}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>ยังไม่มีประวัติระบบ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
