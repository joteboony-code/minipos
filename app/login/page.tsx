"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Delete } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function doLogin(pinValue: string) {
    if (!pinValue || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pinValue })
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "รหัส PIN ไม่ถูกต้อง");
      setPin("");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next || "/pos");
    router.refresh();
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    await doLogin(pin);
  }

  function appendDigit(digit: string) {
    if (busy) return;
    setPin((prev) => prev + digit);
    setError("");
  }

  function backspace() {
    if (busy) return;
    setPin((prev) => prev.slice(0, -1));
  }

  function clearPin() {
    if (busy) return;
    setPin("");
    setError("");
  }

  const dotCount = Math.max(pin.length, 4);
  const pinDots = Array.from({ length: dotCount }, (_, i) => i < pin.length);

  const digitButtonClass =
    "flex h-20 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-4xl font-black text-slate-900 transition hover:border-teal-400 hover:bg-teal-50 active:scale-95 active:bg-teal-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-100 p-4">
      <form onSubmit={login} className="card w-full max-w-sm px-7 py-8">
        <div className="mb-7 text-center">
          <div className="text-4xl font-black text-teal-700">MiniMart POS</div>
          <div className="mt-2 text-xl font-bold text-slate-500">กรอกรหัส PIN เพื่อเข้าใช้งาน</div>
        </div>

        <div className="mb-6 flex justify-center gap-4">
          {pinDots.map((filled, i) => (
            <div
              key={i}
              className={`h-6 w-6 rounded-full border-2 transition-all duration-150 ${
                filled ? "border-teal-600 bg-teal-600 scale-110" : "border-slate-300 bg-slate-100"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-5 rounded-xl border-2 border-red-200 bg-red-50 p-4 text-center text-xl font-black text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button key={digit} type="button" disabled={busy} onClick={() => appendDigit(digit)} className={digitButtonClass}>
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={clearPin}
            className="flex h-20 items-center justify-center rounded-xl border-2 border-red-100 bg-red-50 text-xl font-black text-red-600 transition hover:bg-red-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            ล้าง
          </button>
          <button type="button" disabled={busy} onClick={() => appendDigit("0")} className={digitButtonClass}>
            0
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={backspace}
            className="flex h-20 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Delete size={34} />
          </button>
        </div>

        <button type="submit" disabled={busy || pin.length === 0} className="btn btn-primary mt-5 w-full text-2xl py-4">
          {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
    </main>
  );
}
