"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "รหัส PIN ไม่ถูกต้อง");
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next || "/pos");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={login} className="card w-full max-w-md space-y-5 p-6">
        <div>
          <h1 className="text-3xl font-black text-teal-700">เข้าสู่ระบบ MiniMart POS</h1>
          <p className="mt-2 font-bold text-slate-500">กรอกรหัส PIN เพื่อเข้าใช้งาน</p>
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 font-black text-red-700">{error}</div>}
        <label className="block space-y-2">
          <span className="font-black">PIN</span>
          <input
            autoFocus
            className="field text-center text-3xl tracking-[0.4em]"
            inputMode="numeric"
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
          />
        </label>
        <button className="btn btn-primary w-full text-xl" disabled={busy} type="submit">เข้าสู่ระบบ</button>
      </form>
    </main>
  );
}
