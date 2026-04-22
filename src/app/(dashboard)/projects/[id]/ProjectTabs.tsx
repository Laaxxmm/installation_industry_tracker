"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname() ?? "";
  const tabs = [
    { href: `/projects/${projectId}`, label: "Overview", exact: true },
    { href: `/projects/${projectId}/progress`, label: "Progress" },
    { href: `/projects/${projectId}/budget`, label: "Budget" },
    { href: `/projects/${projectId}/materials`, label: "Materials" },
    { href: `/projects/${projectId}/pnl`, label: "P&L" },
    { href: `/projects/${projectId}/ledger`, label: "Ledger" },
    { href: `/projects/${projectId}/po`, label: "Work Order" },
  ];
  return (
    <nav className="flex items-center gap-0 border-b border-slate-200 overflow-x-auto">
      {tabs.map((t) => {
        const active = t.exact
          ? pathname === t.href
          : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "relative -mb-px whitespace-nowrap px-4 py-2.5 text-[13px] font-medium transition",
              active
                ? "text-brand"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {t.label}
            <span
              className={cn(
                "absolute inset-x-0 -bottom-px h-[2px] rounded-full transition",
                active ? "bg-brand" : "bg-transparent",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
