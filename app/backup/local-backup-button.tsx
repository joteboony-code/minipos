"use client";

import { exportLocalPosData } from "@/lib/local-pos-db";

export function LocalBackupButton() {
  async function downloadLocalBackup() {
    const data = await exportLocalPosData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `minimart-local-backup-${new Date().toISOString().slice(0, 16).replaceAll(":", "")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    localStorage.setItem("minimart:lastLocalBackupAt", new Date().toISOString());
  }

  return (
    <button className="btn btn-light w-full" onClick={downloadLocalBackup} type="button">
      สำรองข้อมูลในเครื่อง
    </button>
  );
}
