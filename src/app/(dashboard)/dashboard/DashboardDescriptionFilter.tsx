"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function DashboardDescriptionFilter({
  options,
  current,
}: {
  options: string[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("description", value);
      else params.delete("description");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <label className="flex items-center gap-2">
      <span className="text-[11px] font-medium text-slate-600">Description</span>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
