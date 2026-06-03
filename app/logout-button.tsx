"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button className="btn btn-light w-full text-lg" onClick={logout} type="button">
      <LogOut size={22} />
      ออกจากระบบ
    </button>
  );
}
