"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/punch", label: "Punch" },
  { href: "/me", label: "My timesheet" },
];

export function NavPillsMobile() {
  const pathname = usePathname();

  return (
    <nav className="flex border-t border-slate-200 bg-slate-50 text-[12px]">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              "flex-1 py-2.5 text-center font-medium transition-colors " +
              (active
                ? "border-b-2 border-brand bg-white text-brand"
                : "border-b-2 border-transparent text-slate-600 hover:text-slate-900")
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
