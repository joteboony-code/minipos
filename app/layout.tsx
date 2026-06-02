import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Boxes, History, Layers, Package, ShoppingCart } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiniMart POS",
  description: "ระบบขายหน้าร้านสำหรับร้านมินิมาร์ท",
  manifest: "/manifest.json"
};

const nav = [
  { href: "/", label: "รายงานวันนี้", icon: BarChart3 },
  { href: "/pos", label: "ขายสินค้า", icon: ShoppingCart },
  { href: "/products", label: "สินค้า", icon: Package },
  { href: "/categories", label: "หมวดหมู่", icon: Layers },
  { href: "/stock", label: "สต๊อก", icon: Boxes },
  { href: "/sales", label: "ประวัติการขาย", icon: History }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <div className="min-h-screen lg:flex">
          <aside className="border-b border-slate-200 bg-white lg:min-h-screen lg:w-80 lg:border-b-0 lg:border-r">
            <div className="px-6 py-6">
              <div className="text-3xl font-black text-teal-700">MiniMart POS</div>
              <div className="mt-1 text-lg font-bold text-slate-500">ระบบขายหน้าร้าน</div>
            </div>
            <nav className="flex gap-3 overflow-x-auto px-4 pb-4 lg:block lg:space-y-3 lg:overflow-visible">
              {nav.map((item) => {
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
          </aside>
          <main className="flex-1 p-4 sm:p-6 lg:p-8 xl:p-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
