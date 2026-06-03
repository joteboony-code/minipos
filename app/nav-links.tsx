"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, CreditCard, DatabaseBackup, FileText, History, Layers, Package, ShoppingCart } from "lucide-react";

type Role = "OWNER" | "STAFF";

const nav: Array<{ href: string; label: string; icon: typeof BarChart3; roles: Role[] }> = [
  { href: "/", label: "รายงานวันนี้", icon: BarChart3, roles: ["OWNER"] },
  { href: "/pos", label: "ขายสินค้า", icon: ShoppingCart, roles: ["OWNER", "STAFF"] },
  { href: "/products", label: "สินค้า", icon: Package, roles: ["OWNER"] },
  { href: "/categories", label: "หมวดหมู่", icon: Layers, roles: ["OWNER"] },
  { href: "/stock", label: "สต๊อก", icon: Boxes, roles: ["OWNER"] },
  { href: "/sales", label: "ประวัติการขาย", icon: History, roles: ["OWNER", "STAFF"] },
  { href: "/credits", label: "เงินเชื่อ", icon: CreditCard, roles: ["OWNER"] },
  { href: "/reports", label: "รายงาน", icon: FileText, roles: ["OWNER"] },
  { href: "/backup", label: "สำรองข้อมูล", icon: DatabaseBackup, roles: ["OWNER"] },
];

export function NavLinks({ role }: { role: Role }) {
  const pathname = usePathname();
  const visibleNav = nav.filter((item) => item.roles.includes(role));

  return (
    <nav className="flex gap-2 overflow-x-auto px-3 pb-3 lg:block lg:space-y-2 lg:overflow-visible lg:px-4 lg:pb-0">
      {visibleNav.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-h-[4.5rem] shrink-0 items-center gap-4 rounded-xl px-4 py-3 text-xl font-black transition ${
              isActive
                ? "bg-teal-600 text-white shadow-md"
                : "text-slate-700 hover:bg-teal-50 hover:text-teal-800"
            }`}
          >
            <Icon size={30} strokeWidth={2.5} className="shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
