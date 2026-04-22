import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-[12px] text-slate-600">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
