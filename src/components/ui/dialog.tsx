"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-10 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        {(title || description) && (
          <div className="mb-4 pr-8">
            {title && (
              <h2 className="text-[15px] font-semibold text-slate-900">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-[12px] text-slate-500">{description}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
