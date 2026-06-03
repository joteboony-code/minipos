import type { Metadata } from "next";
import { getSession, roleLabel } from "@/lib/auth";
import { NavLinks } from "./nav-links";
import { LogoutButton } from "./logout-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiniMart POS",
  description: "ระบบขายหน้าร้านสำหรับร้านมินิมาร์ท",
  manifest: "/manifest.json"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="th">
      <body>
        {!session ? (
          children
        ) : (
          <div className="min-h-screen lg:flex">
            <aside className="border-b border-slate-200 bg-white lg:min-h-screen lg:w-80 lg:border-b-0 lg:border-r lg:border-slate-200">
              <div className="px-6 py-6">
                <div className="text-3xl font-black text-teal-700">MiniMart POS</div>
                <div className="mt-1 text-lg font-bold text-slate-500">ระบบขายหน้าร้าน</div>
                <div className="mt-4 rounded-xl bg-teal-50 px-5 py-4 border border-teal-100">
                  <div className="text-base font-bold text-teal-700">เข้าสู่ระบบในฐานะ</div>
                  <div className="text-2xl font-black text-teal-900">{roleLabel(session.role)}</div>
                </div>
              </div>
              <NavLinks role={session.role} />
              <div className="px-4 pt-4 pb-6">
                <LogoutButton />
              </div>
            </aside>
            <main className="flex-1 p-4 sm:p-6 lg:p-8 xl:p-10">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
