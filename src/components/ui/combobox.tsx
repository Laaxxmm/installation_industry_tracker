"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label: string };

export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  emptyText = "No matches",
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: ComboOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = filtered[activeIdx];
      if (hit) pick(hit.value);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((o) => !o);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex h-9 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-1.5 text-left text-[13px] text-slate-900 shadow-sm transition focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn("truncate", !selected && "text-slate-400")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-200 p-1.5">
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search…"
              className="h-8"
            />
          </div>
          <ul className="max-h-60 overflow-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-[12px] text-slate-500">{emptyText}</li>
            )}
            {filtered.map((o, idx) => {
              const isActive = idx === activeIdx;
              const isSelected = o.value === value;
              return (
                <li
                  key={o.value}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(o.value);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px]",
                    isActive ? "bg-slate-100" : "bg-white",
                    isSelected ? "font-medium text-slate-900" : "text-slate-700",
                  )}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isSelected ? "text-brand" : "text-transparent",
                    )}
                  />
                  <span className="truncate">{o.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
