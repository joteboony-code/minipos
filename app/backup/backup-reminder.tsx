"use client";

import { useEffect, useState } from "react";
import { getPendingSyncCount } from "@/lib/local-pos-db";

const backupKey = "minimart:lastLocalBackupAt";
const staleBackupMs = 24 * 60 * 60 * 1000;

export function BackupReminder() {
  const [pendingCount, setPendingCount] = useState(0);
  const [lastBackupAt, setLastBackupAt] = useState("");

  useEffect(() => {
    getPendingSyncCount().then(setPendingCount).catch(() => setPendingCount(0));
    setLastBackupAt(localStorage.getItem(backupKey) ?? "");
  }, []);

  const lastBackupTime = lastBackupAt ? new Date(lastBackupAt).getTime() : 0;
  const isBackupStale = !lastBackupTime || Date.now() - lastBackupTime > staleBackupMs;

  if (pendingCount === 0 && !isBackupStale) return null;

  return (
    <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4 font-bold text-amber-900">
      {pendingCount > 0 && <div>มีรายการรอซิงก์ {pendingCount} รายการ ควรสำรองข้อมูลในเครื่องก่อนปิดเครื่อง</div>}
      {isBackupStale && (
        <div className={pendingCount > 0 ? "mt-1" : ""}>
          {lastBackupAt ? `สำรองข้อมูลในเครื่องล่าสุด ${new Date(lastBackupAt).toLocaleString("th-TH")}` : "ยังไม่พบประวัติสำรองข้อมูลในเครื่อง"}
        </div>
      )}
    </div>
  );
}
