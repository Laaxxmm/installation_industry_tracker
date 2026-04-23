"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
] as const;

export function TimesheetsStatusFilter({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "SUBMITTED") params.set("status", value);
      else params.delete("status");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <label className="flex items-center gap-2">
      <span className="text-[11px] font-medium text-slate-600">Status</span>
      <select
        value={current || "SUBMITTED"}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
