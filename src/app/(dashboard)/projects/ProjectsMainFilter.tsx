"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ProjectsMainFilter({
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
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 shadow-card">
      <label className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Description
        </span>
        <select
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 rounded border border-slate-200 bg-white px-2 text-[12px] text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
        >
          <option value="">All descriptions</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      {current && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-[11px] font-medium text-brand hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
