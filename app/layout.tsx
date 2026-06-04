import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BarChart3, Boxes, ClipboardList, Clock, CreditCard, DatabaseBackup, FileText, History, Layers, Package, Settings, ShoppingCart } from "lucide-react";
import { getSession, roleLabel, type Role } from "@/lib/auth";
import { LogoutButton } from "./logout-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiniMart POS",
  description: "ระบบขายหน้าร้านสำหรับร้านมินิมาร์ท",
  manifest: "/manifest.json"
};

const nav: Array<{ href: string; label: string; icon: typeof BarChart3; roles: Role[] }> = [
  { href: "/", label: "รายงานวันนี้", icon: BarChart3, roles: ["OWNER"] },
  { href: "/pos", label: "ขายสินค้า", icon: ShoppingCart, roles: ["OWNER", "STAFF"] },
  { href: "/products", label: "สินค้า", icon: Package, roles: ["OWNER"] },
  { href: "/categories", label: "หมวดหมู่", icon: Layers, roles: ["OWNER"] },
  { href: "/stock", label: "สต๊อก", icon: Boxes, roles: ["OWNER"] },
  { href: "/stock-count", label: "นับสต๊อก", icon: ClipboardList, roles: ["OWNER"] },
  { href: "/sales", label: "ประวัติการขาย", icon: History, roles: ["OWNER", "STAFF"] },
  { href: "/credits", label: "เงินเชื่อ", icon: CreditCard, roles: ["OWNER"] },
  { href: "/shifts", label: "กะขาย", icon: Clock, roles: ["OWNER"] },
  { href: "/low-stock", label: "สินค้าใกล้หมด", icon: AlertTriangle, roles: ["OWNER"] },
  { href: "/reports", label: "รายงาน", icon: FileText, roles: ["OWNER"] },
  { href: "/audit", label: "ประวัติระบบ", icon: ClipboardList, roles: ["OWNER"] },
  { href: "/settings", label: "ตั้งค่า", icon: Settings, roles: ["OWNER"] },
  { href: "/backup", label: "สำรองข้อมูล", icon: DatabaseBackup, roles: ["OWNER"] }
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const visibleNav = session ? nav.filter((item) => item.roles.includes(session.role)) : [];

  return (
    <html lang="th">
      <head>
        <script dangerouslySetInnerHTML={{__html: `if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js')`}} />
      </head>
      <body>
        {!session ? (
          children
        ) : (
          <div className="min-h-screen lg:flex">
            <aside className="border-b border-slate-200 bg-white lg:min-h-screen lg:w-80 lg:border-b-0 lg:border-r">
              <div className="px-6 py-6">
                <div className="text-3xl font-black text-teal-700">MiniMart POS</div>
                <div className="mt-1 text-lg font-bold text-slate-500">ระบบขายหน้าร้าน</div>
                <div className="mt-4 rounded-lg bg-slate-100 px-4 py-3">
                  <div className="text-sm font-bold text-slate-500">เข้าสู่ระบบในฐานะ</div>
                  <div className="text-xl font-black text-slate-900">{roleLabel(session.role)}</div>
                </div>
              </div>
              <nav className="flex gap-3 overflow-x-auto px-4 pb-4 lg:block lg:space-y-3 lg:overflow-visible">
                {visibleNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex min-h-16 shrink-0 items-center gap-4 rounded-lg px-4 py-4 text-xl font-black text-slate-800 hover:bg-teal-50 hover:text-teal-800"
                    >
                      <Icon size={30} strokeWidth={2.4} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="px-4 pb-6">
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
