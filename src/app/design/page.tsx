"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Clock,
  Package,
  BarChart3,
  Bell,
  Search,
  Plus,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Circle,
  MoreHorizontal,
  TrendingUp,
  Activity,
  Wrench,
} from "lucide-react";

/**
 * Design showcase — 4 distinct directions for the SAB India Tracker UI.
 * Public route (whitelisted in middleware). Pick one; I'll then roll it through the real app.
 */

type ThemeKey =
  | "minimal"
  | "soft"
  | "dark"
  | "enterprise"
  | "navy"
  | "clinical"
  | "sidebar"
  | "sapphire";

const THEMES: { key: ThemeKey; name: string; tagline: string; group: string }[] = [
  {
    key: "minimal",
    name: "01 — Minimal Mono",
    tagline: "Linear / Vercel. Near-black on white, one cobalt accent, dense and quiet.",
    group: "Original 4",
  },
  {
    key: "soft",
    name: "02 — Soft Warm",
    tagline: "Stripe / Mercury. Warm off-white, soft shadows, friendly premium feel.",
    group: "Original 4",
  },
  {
    key: "dark",
    name: "03 — Dark Ops",
    tagline: "Supabase / Railway. Dark slate, neon-emerald accent, operator-grade density.",
    group: "Original 4",
  },
  {
    key: "enterprise",
    name: "04 — Enterprise Indigo",
    tagline: "Carbon / Atlassian. Indigo primary, formal hierarchy, trustworthy for finance.",
    group: "Original 4",
  },
  {
    key: "navy",
    name: "05 — Finance Navy",
    tagline:
      "Bloomberg / Wise Business. Deep navy + gold accent, sharp corners, banking-grade.",
    group: "More enterprise options",
  },
  {
    key: "clinical",
    name: "06 — Clinical Teal",
    tagline:
      "Siemens / Philips Healthcare. Teal primary, medical aesthetic — fits your domain.",
    group: "More enterprise options",
  },
  {
    key: "sidebar",
    name: "07 — Graphite Sidebar",
    tagline:
      "Notion admin / Attio. Left sidebar layout, graphite + amber, product-led SaaS.",
    group: "More enterprise options",
  },
  {
    key: "sapphire",
    name: "08 — Executive Sapphire",
    tagline:
      "Salesforce Lightning / Workday. Sapphire + sparklines, board-report feel.",
    group: "More enterprise options",
  },
];

// Shared mock data so the 4 previews compare apples-to-apples ------------
const PROJECTS = [
  {
    code: "SAB-2026-0001",
    name: "Apollo Hospitals — MRI Install",
    client: "Apollo Hospitals",
    status: "ACTIVE",
    contract: 1000000,
    revenue: 620000,
    net: 119100,
    cm: 23.2,
    progress: 62,
  },
  {
    code: "SAB-2026-0002",
    name: "Fortis Gurgaon — CT Scanner",
    client: "Fortis Healthcare",
    status: "ACTIVE",
    contract: 2400000,
    revenue: 900000,
    net: 84300,
    cm: 9.4,
    progress: 38,
  },
  {
    code: "SAB-2026-0003",
    name: "Max Hospital — PET/CT Suite",
    client: "Max Healthcare",
    status: "ON_HOLD",
    contract: 1800000,
    revenue: 200000,
    net: -24500,
    cm: -12.3,
    progress: 11,
  },
  {
    code: "SAB-2026-0004",
    name: "AIIMS Delhi — Linac Bunker",
    client: "AIIMS",
    status: "ACTIVE",
    contract: 3200000,
    revenue: 1450000,
    net: 412700,
    cm: 28.5,
    progress: 45,
  },
  {
    code: "SAB-2025-0019",
    name: "Manipal — Cath Lab Retrofit",
    client: "Manipal Hospitals",
    status: "COMPLETED",
    contract: 780000,
    revenue: 780000,
    net: 142800,
    cm: 18.3,
    progress: 100,
  },
];

const ACTIVITY = [
  { who: "Priya M.", what: "approved 4 timesheets", when: "12m ago", proj: "SAB-2026-0001" },
  { who: "Ravi K.", what: "issued 40m CABLE-6SQMM", when: "1h ago", proj: "SAB-2026-0002" },
  { who: "Anita S.", what: "booked ₹12,000 direct purchase", when: "2h ago", proj: "SAB-2026-0001" },
  { who: "System", what: "transferred 8× MOUNT-STD to 0004", when: "3h ago", proj: "SAB-2026-0004" },
  { who: "Vikram D.", what: "punched in", when: "4h ago", proj: "SAB-2026-0004" },
];

const inr = (n: number) =>
  "₹" +
  n.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

// ---------------------------------------------------------------------------

export default function DesignPage() {
  const [theme, setTheme] = useState<ThemeKey>("minimal");

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Switcher */}
      <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              SAB India — Frontend Directions
            </h1>
            <p className="text-xs text-slate-500">
              Pick one. Same content rendered in four distinct modern styles.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {["Original 4", "More enterprise options"].map((g) => (
              <div key={g} className="flex flex-wrap justify-end gap-2">
                <span className="self-center pr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {g}
                </span>
                {THEMES.filter((t) => t.group === g).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTheme(t.key)}
                    className={
                      "rounded-full border px-4 py-1.5 text-xs font-medium transition " +
                      (theme === t.key
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400")
                    }
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 pb-3 text-xs text-slate-500">
          {THEMES.find((t) => t.key === theme)?.tagline}
        </div>
      </div>

      {/* Preview */}
      <div className="mx-auto max-w-[1400px] p-6">
        {theme === "minimal" && <ThemeMinimal />}
        {theme === "soft" && <ThemeSoft />}
        {theme === "dark" && <ThemeDark />}
        {theme === "enterprise" && <ThemeEnterprise />}
        {theme === "navy" && <ThemeNavy />}
        {theme === "clinical" && <ThemeClinical />}
        {theme === "sidebar" && <ThemeSidebar />}
        {theme === "sapphire" && <ThemeSapphire />}
      </div>
    </div>
  );
}

// === THEME 1 — MINIMAL MONO =================================================

function ThemeMinimal() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white font-[system-ui]">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-slate-900 text-[11px] font-bold text-white">
              S
            </div>
            <span className="text-[13px] font-semibold tracking-tight text-slate-900">
              SAB India
            </span>
          </div>
          <nav className="flex items-center gap-5 text-[13px] text-slate-600">
            <a className="text-slate-900">Dashboard</a>
            <a className="hover:text-slate-900">Projects</a>
            <a className="hover:text-slate-900">Timesheets</a>
            <a className="hover:text-slate-900">Inventory</a>
            <a className="hover:text-slate-900">Reports</a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search  ⌘K"
              className="h-8 w-56 rounded-md border border-slate-200 bg-slate-50 pl-7 pr-3 text-[12px] outline-none focus:border-slate-400"
            />
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">
            <Bell className="h-4 w-4 text-slate-500" />
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[11px] font-medium text-slate-700">
            PM
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Portfolio
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Dashboard
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            <button className="flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-[12px] font-medium text-white hover:bg-slate-800">
              <Plus className="h-3.5 w-3.5" /> New project
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          {[
            { label: "Contract value", v: "₹91.8L", d: "+12.4%", up: true },
            { label: "Revenue (MTD)", v: "₹39.5L", d: "+8.1%", up: true },
            { label: "Contribution margin", v: "21.3%", d: "+2.1pp", up: true },
            { label: "Net P&L", v: "₹7,34,400", d: "-3.2%", up: false },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                {k.label}
              </div>
              <div className="mt-1 text-[22px] font-semibold tracking-tight text-slate-900 tabular-nums">
                {k.v}
              </div>
              <div
                className={
                  "mt-1 flex items-center gap-1 text-[11px] tabular-nums " +
                  (k.up ? "text-blue-600" : "text-red-600")
                }
              >
                {k.up ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {k.d}
              </div>
            </div>
          ))}
        </div>

        {/* Table + activity */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-[13px] font-semibold text-slate-900">
                Active projects
              </div>
              <button className="text-[11px] text-slate-500 hover:text-slate-900">
                View all
              </button>
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-4 py-2 font-medium">Code</th>
                  <th className="px-4 py-2 font-medium">Client</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">CM %</th>
                  <th className="px-4 py-2 text-right font-medium">Net P&L</th>
                </tr>
              </thead>
              <tbody>
                {PROJECTS.map((p) => (
                  <tr key={p.code} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-900">
                      {p.code}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{p.client}</td>
                    <td className="px-4 py-2.5">
                      <MinimalStatus status={p.status} />
                    </td>
                    <td
                      className={
                        "px-4 py-2.5 text-right tabular-nums " +
                        (p.cm < 0 ? "text-red-600" : "text-slate-900")
                      }
                    >
                      {p.cm.toFixed(1)}%
                    </td>
                    <td
                      className={
                        "px-4 py-2.5 text-right tabular-nums " +
                        (p.net < 0 ? "text-red-600" : "text-slate-900")
                      }
                    >
                      {inr(p.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-900">
              Activity
            </div>
            <ul className="divide-y divide-slate-100">
              {ACTIVITY.map((a, i) => (
                <li key={i} className="flex items-start gap-2 px-4 py-3 text-[12px]">
                  <Circle className="mt-1 h-1.5 w-1.5 flex-shrink-0 fill-slate-400 text-slate-400" />
                  <div className="flex-1">
                    <div className="text-slate-900">
                      <span className="font-medium">{a.who}</span>{" "}
                      <span className="text-slate-600">{a.what}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      <span className="font-mono">{a.proj}</span> · {a.when}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function MinimalStatus({ status }: { status: string }) {
  const map: Record<string, { dot: string; text: string; label: string }> = {
    ACTIVE: { dot: "bg-emerald-500", text: "text-slate-700", label: "Active" },
    ON_HOLD: { dot: "bg-amber-500", text: "text-slate-700", label: "On hold" },
    COMPLETED: { dot: "bg-slate-400", text: "text-slate-500", label: "Completed" },
  };
  const s = map[status] ?? map.ACTIVE;
  return (
    <span className={"inline-flex items-center gap-1.5 text-[11px] " + s.text}>
      <span className={"h-1.5 w-1.5 rounded-full " + s.dot} />
      {s.label}
    </span>
  );
}

// === THEME 2 — SOFT WARM ====================================================

function ThemeSoft() {
  return (
    <div
      className="overflow-hidden rounded-3xl border border-stone-200 font-[system-ui]"
      style={{ backgroundColor: "#FBF9F6" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm"
              style={{ backgroundColor: "#D97706" }}
            >
              S
            </div>
            <div>
              <div className="text-[15px] font-semibold text-stone-900">SAB India</div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-stone-500">
                Installation tracker
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-1 text-[13px]">
            {["Dashboard", "Projects", "Timesheets", "Inventory", "Reports"].map(
              (n, i) => (
                <a
                  key={n}
                  className={
                    "rounded-full px-3.5 py-1.5 " +
                    (i === 0
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:bg-stone-100")
                  }
                >
                  {n}
                </a>
              ),
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              placeholder="Search projects, materials…"
              className="h-10 w-72 rounded-2xl border border-stone-200 bg-white pl-9 pr-4 text-sm outline-none shadow-sm focus:border-stone-400"
            />
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-2 py-1.5 shadow-sm">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ backgroundColor: "#B45309" }}
            >
              PM
            </div>
            <div className="pr-1 text-[12px]">
              <div className="font-medium text-stone-900 leading-tight">Priya M.</div>
              <div className="text-[10px] text-stone-500 leading-tight">Manager</div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-8 pb-8">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-stone-900">
              Good afternoon, Priya
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              5 active projects · 2 timesheets awaiting approval · 1 low-stock alert
            </p>
          </div>
          <div className="flex gap-2">
            <button className="flex h-10 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50">
              <Download className="h-4 w-4" /> Export
            </button>
            <button
              className="flex h-10 items-center gap-2 rounded-2xl px-5 text-sm font-medium text-white shadow-sm"
              style={{ backgroundColor: "#D97706" }}
            >
              <Plus className="h-4 w-4" /> New project
            </button>
          </div>
        </div>

        {/* KPI */}
        <div className="mb-5 grid grid-cols-4 gap-4">
          {[
            { label: "Contract value", v: "₹91.8L", d: "+12.4%", up: true, icon: FolderKanban },
            { label: "Revenue (MTD)", v: "₹39.5L", d: "+8.1%", up: true, icon: TrendingUp },
            { label: "Contribution", v: "21.3%", d: "+2.1pp", up: true, icon: Activity },
            { label: "Net P&L", v: "₹7.34L", d: "-3.2%", up: false, icon: BarChart3 },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_8px_24px_-12px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "#FEF3E2" }}
                >
                  <k.icon className="h-4 w-4" style={{ color: "#D97706" }} />
                </div>
                <div
                  className={
                    "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium " +
                    (k.up
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700")
                  }
                >
                  {k.up ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {k.d}
                </div>
              </div>
              <div className="mt-4 text-[13px] text-stone-500">{k.label}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 tabular-nums">
                {k.v}
              </div>
            </div>
          ))}
        </div>

        {/* Table + activity */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <div className="text-[15px] font-semibold text-stone-900">
                  Active projects
                </div>
                <div className="text-xs text-stone-500">
                  Sorted by contribution margin
                </div>
              </div>
              <button className="rounded-full border border-stone-200 px-3 py-1 text-[12px] text-stone-700 hover:bg-stone-50">
                View all
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-stone-200 text-left text-[11px] uppercase tracking-wider text-stone-500">
                  <th className="px-6 py-2.5 font-medium">Project</th>
                  <th className="px-2 py-2.5 font-medium">Status</th>
                  <th className="px-2 py-2.5 text-right font-medium">Progress</th>
                  <th className="px-6 py-2.5 text-right font-medium">Net P&L</th>
                </tr>
              </thead>
              <tbody>
                {PROJECTS.map((p) => (
                  <tr key={p.code} className="border-t border-stone-100">
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-stone-900">{p.name}</div>
                      <div className="font-mono text-[11px] text-stone-500">
                        {p.code}
                      </div>
                    </td>
                    <td className="px-2 py-3.5">
                      <SoftStatus status={p.status} />
                    </td>
                    <td className="px-2 py-3.5 text-right">
                      <div className="ml-auto flex w-32 items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: p.progress + "%",
                              backgroundColor: "#D97706",
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-[11px] tabular-nums text-stone-600">
                          {p.progress}%
                        </span>
                      </div>
                    </td>
                    <td
                      className={
                        "px-6 py-3.5 text-right font-medium tabular-nums " +
                        (p.net < 0 ? "text-rose-600" : "text-stone-900")
                      }
                    >
                      {inr(p.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
            <div className="px-5 py-4 text-[15px] font-semibold text-stone-900">
              Recent activity
            </div>
            <ul className="space-y-0.5 px-2 pb-3">
              {ACTIVITY.map((a, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl p-3 hover:bg-stone-50"
                >
                  <div
                    className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                    style={{ backgroundColor: "#78716C" }}
                  >
                    {a.who[0]}
                  </div>
                  <div className="min-w-0 flex-1 text-[12px]">
                    <div className="text-stone-900">
                      <span className="font-medium">{a.who}</span>{" "}
                      <span className="text-stone-600">{a.what}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-stone-500">
                      <span className="font-mono">{a.proj}</span> · {a.when}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function SoftStatus({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    ACTIVE: { bg: "bg-emerald-50", fg: "text-emerald-700", label: "Active" },
    ON_HOLD: { bg: "bg-amber-50", fg: "text-amber-700", label: "On hold" },
    COMPLETED: { bg: "bg-stone-100", fg: "text-stone-600", label: "Completed" },
  };
  const s = map[status] ?? map.ACTIVE;
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium " +
        s.bg +
        " " +
        s.fg
      }
    >
      {s.label}
    </span>
  );
}

// === THEME 3 — DARK OPS =====================================================

function ThemeDark() {
  return (
    <div
      className="overflow-hidden rounded-xl font-mono text-slate-200"
      style={{ backgroundColor: "#0A0F1C", fontFamily: "ui-sans-serif, system-ui" }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: "#1E293B", backgroundColor: "#0B1220" }}
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold"
              style={{
                backgroundColor: "#10B981",
                color: "#052E16",
                boxShadow: "0 0 16px rgba(16,185,129,0.4)",
              }}
            >
              S
            </div>
            <span className="text-[13px] font-semibold tracking-wide text-white">
              sab.india
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
              v1.0
            </span>
          </div>
          <nav className="flex items-center gap-4 text-[12px]">
            {[
              { n: "Dashboard", a: true, i: LayoutDashboard },
              { n: "Projects", a: false, i: FolderKanban },
              { n: "Timesheets", a: false, i: Clock },
              { n: "Inventory", a: false, i: Package },
              { n: "Reports", a: false, i: BarChart3 },
            ].map((x) => (
              <a
                key={x.n}
                className={
                  "flex items-center gap-1.5 " +
                  (x.a ? "text-white" : "text-slate-400 hover:text-slate-200")
                }
              >
                <x.i className="h-3.5 w-3.5" />
                {x.n}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded border px-2 py-1 text-[10px]"
            style={{ borderColor: "#1E293B", color: "#10B981" }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "#10B981", boxShadow: "0 0 6px #10B981" }}
            />
            live
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
            <input
              placeholder="search  /"
              className="h-7 w-52 rounded border bg-slate-900/80 pl-6 pr-2 text-[11px] text-slate-200 outline-none placeholder:text-slate-500"
              style={{ borderColor: "#1E293B" }}
            />
          </div>
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium"
            style={{ backgroundColor: "#1E293B", color: "#94A3B8" }}
          >
            PM
          </div>
        </div>
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
              portfolio.overview
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Operations dashboard
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              className="flex h-7 items-center gap-1.5 rounded border px-2.5 text-[11px] text-slate-300 hover:bg-slate-800"
              style={{ borderColor: "#1E293B" }}
            >
              <Download className="h-3 w-3" /> export.xlsx
            </button>
            <button
              className="flex h-7 items-center gap-1.5 rounded px-3 text-[11px] font-medium"
              style={{
                background: "linear-gradient(180deg, #10B981, #059669)",
                color: "#042f1f",
                boxShadow: "0 0 16px rgba(16,185,129,0.25)",
              }}
            >
              <Plus className="h-3 w-3" /> new.project
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="mb-4 grid grid-cols-4 gap-2">
          {[
            { label: "contract_value", v: "₹91,80,000", d: "+12.4%", up: true },
            { label: "revenue_mtd", v: "₹39,45,120", d: "+8.1%", up: true },
            { label: "contribution_pct", v: "21.30", d: "+2.10", up: true },
            { label: "net_pnl", v: "₹7,34,400", d: "-3.2%", up: false },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded border p-3"
              style={{
                borderColor: "#1E293B",
                backgroundColor: "#0F172A",
              }}
            >
              <div className="text-[10px] tracking-wider text-slate-500">
                {k.label}
              </div>
              <div className="mt-1 text-[20px] font-semibold tabular-nums text-white">
                {k.v}
              </div>
              <div className="mt-1 flex items-center justify-between">
                <div
                  className="h-1 w-16 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, #10B981 0%, #10B981 70%, #1E293B 70%)",
                  }}
                />
                <div
                  className="text-[10px] tabular-nums"
                  style={{ color: k.up ? "#10B981" : "#F87171" }}
                >
                  {k.d}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Table + activity */}
        <div className="grid grid-cols-3 gap-2">
          <div
            className="col-span-2 overflow-hidden rounded border"
            style={{ borderColor: "#1E293B", backgroundColor: "#0B1220" }}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-2.5"
              style={{ borderColor: "#1E293B" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-white">
                  projects
                </span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">
                  {PROJECTS.length} rows
                </span>
              </div>
              <button className="text-[10px] text-slate-500 hover:text-slate-300">
                view.all →
              </button>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr
                  className="border-b text-left uppercase tracking-wider text-slate-500"
                  style={{ borderColor: "#1E293B" }}
                >
                  <th className="px-4 py-2 font-medium">code</th>
                  <th className="px-4 py-2 font-medium">client</th>
                  <th className="px-4 py-2 font-medium">status</th>
                  <th className="px-4 py-2 text-right font-medium">cm%</th>
                  <th className="px-4 py-2 text-right font-medium">net</th>
                </tr>
              </thead>
              <tbody>
                {PROJECTS.map((p, i) => (
                  <tr
                    key={p.code}
                    className="border-b"
                    style={{
                      borderColor: "#111827",
                      backgroundColor: i % 2 ? "#0B1220" : "#0D1627",
                    }}
                  >
                    <td className="px-4 py-2 font-mono text-slate-200">{p.code}</td>
                    <td className="px-4 py-2 text-slate-400">{p.client}</td>
                    <td className="px-4 py-2">
                      <DarkStatus status={p.status} />
                    </td>
                    <td
                      className="px-4 py-2 text-right tabular-nums"
                      style={{ color: p.cm < 0 ? "#F87171" : "#10B981" }}
                    >
                      {p.cm.toFixed(2)}
                    </td>
                    <td
                      className="px-4 py-2 text-right tabular-nums"
                      style={{ color: p.net < 0 ? "#F87171" : "#E2E8F0" }}
                    >
                      {inr(p.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="overflow-hidden rounded border"
            style={{ borderColor: "#1E293B", backgroundColor: "#0B1220" }}
          >
            <div
              className="border-b px-4 py-2.5 text-[12px] font-semibold text-white"
              style={{ borderColor: "#1E293B" }}
            >
              ~/activity.log
            </div>
            <ul className="p-3 font-mono text-[10px]">
              {ACTIVITY.map((a, i) => (
                <li key={i} className="flex gap-2 py-1">
                  <span className="text-slate-600">{String(i).padStart(2, "0")}</span>
                  <span className="text-slate-500">[{a.when}]</span>
                  <span className="flex-1 text-slate-300">
                    <span style={{ color: "#10B981" }}>{a.who}</span> {a.what}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function DarkStatus({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    ACTIVE: { color: "#10B981", bg: "rgba(16,185,129,0.1)", label: "active" },
    ON_HOLD: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", label: "on_hold" },
    COMPLETED: { color: "#64748B", bg: "rgba(100,116,139,0.12)", label: "done" },
  };
  const s = map[status] ?? map.ACTIVE;
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      <span
        className="h-1 w-1 rounded-full"
        style={{ backgroundColor: s.color }}
      />
      {s.label}
    </span>
  );
}

// === THEME 4 — ENTERPRISE INDIGO ============================================

function ThemeEnterprise() {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white font-[system-ui]">
      {/* Top indigo bar */}
      <div
        className="flex items-center justify-between px-6 py-2.5 text-white"
        style={{ backgroundColor: "#1E1B4B" }}
      >
        <div className="flex items-center gap-2 text-[12px]">
          <Wrench className="h-3.5 w-3.5 opacity-70" />
          <span className="font-medium">SAB India Services Pvt. Ltd.</span>
          <span className="opacity-50">·</span>
          <span className="opacity-70">Medical Equipment Installation Tracker</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] opacity-80">
          <span>IST {new Date().toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          <span>Priya M. · Manager</span>
          <a className="underline-offset-2 hover:underline">Sign out</a>
        </div>
      </div>

      {/* Secondary nav */}
      <div className="flex items-center justify-between border-b-2 border-slate-200 bg-white px-6">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2 py-3 pr-6">
            <div
              className="flex h-8 w-8 items-center justify-center rounded text-sm font-bold text-white"
              style={{ backgroundColor: "#4338CA" }}
            >
              S
            </div>
            <span className="text-[15px] font-semibold text-slate-900">
              SAB Tracker
            </span>
          </div>
          {[
            { n: "Dashboard", a: true },
            { n: "Projects", a: false },
            { n: "Timesheets", a: false },
            { n: "Inventory", a: false },
            { n: "Reports", a: false },
            { n: "Admin", a: false },
          ].map((x) => (
            <a
              key={x.n}
              className={
                "relative px-4 py-4 text-[13px] font-medium " +
                (x.a
                  ? "text-indigo-900"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              {x.n}
              {x.a && (
                <span
                  className="absolute inset-x-4 bottom-0 h-[3px]"
                  style={{ backgroundColor: "#4338CA" }}
                />
              )}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search"
              className="h-9 w-64 rounded-sm border border-slate-300 pl-8 pr-3 text-[13px] outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
            />
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-sm border border-slate-300 hover:bg-slate-50">
            <Bell className="h-4 w-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Breadcrumb + title */}
      <div
        className="border-b border-slate-200 px-6 py-4"
        style={{ backgroundColor: "#F8FAFC" }}
      >
        <div className="text-[11px] text-slate-500">
          Home / <span className="text-slate-900">Dashboard</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Portfolio Overview
            </h2>
            <p className="text-[12px] text-slate-600">
              FY 2025–26 · All projects · Rolling 30-day window
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex h-9 items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
              <Download className="h-3.5 w-3.5" /> Export XLSX
            </button>
            <button
              className="flex h-9 items-center gap-1.5 rounded-sm px-3 text-[13px] font-medium text-white"
              style={{ backgroundColor: "#4338CA" }}
            >
              <Plus className="h-3.5 w-3.5" /> New project
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* KPI strip */}
        <div className="mb-6 grid grid-cols-4 overflow-hidden rounded-md border border-slate-200 bg-white">
          {[
            { label: "CONTRACT VALUE", v: "₹91,80,000", d: "+12.4%", up: true },
            { label: "REVENUE (MTD)", v: "₹39,45,120", d: "+8.1%", up: true },
            { label: "CONTRIBUTION MARGIN", v: "21.3%", d: "+2.1pp", up: true },
            { label: "NET P&L", v: "₹7,34,400", d: "-3.2%", up: false },
          ].map((k, i, arr) => (
            <div
              key={k.label}
              className={
                "p-5 " + (i < arr.length - 1 ? "border-r border-slate-200" : "")
              }
            >
              <div className="text-[10px] font-semibold tracking-wider text-slate-500">
                {k.label}
              </div>
              <div className="mt-2 text-[26px] font-semibold tracking-tight text-slate-900 tabular-nums">
                {k.v}
              </div>
              <div
                className={
                  "mt-1 flex items-center gap-1 text-[11px] font-medium tabular-nums " +
                  (k.up ? "text-emerald-700" : "text-red-700")
                }
              >
                {k.up ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {k.d}
                <span className="ml-1 font-normal text-slate-500">vs last period</span>
              </div>
            </div>
          ))}
        </div>

        {/* Table + activity */}
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 overflow-hidden rounded-md border border-slate-200 bg-white">
            <div
              className="flex items-center justify-between border-b border-slate-200 px-5 py-3"
              style={{ backgroundColor: "#F8FAFC" }}
            >
              <div>
                <div className="text-[14px] font-semibold text-slate-900">
                  Active Projects
                </div>
                <div className="text-[11px] text-slate-500">
                  Showing {PROJECTS.length} of {PROJECTS.length}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="h-7 rounded-sm border border-slate-300 bg-white px-2 text-[11px] text-slate-700 hover:bg-slate-50">
                  Filter
                </button>
                <button className="flex h-7 w-7 items-center justify-center rounded-sm border border-slate-300 hover:bg-slate-50">
                  <MoreHorizontal className="h-3.5 w-3.5 text-slate-500" />
                </button>
              </div>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr
                  className="border-b border-slate-200 text-left"
                  style={{ backgroundColor: "#F1F5F9" }}
                >
                  <th className="px-5 py-2.5 text-[10px] font-semibold tracking-wider text-slate-600">
                    CODE
                  </th>
                  <th className="px-2 py-2.5 text-[10px] font-semibold tracking-wider text-slate-600">
                    PROJECT
                  </th>
                  <th className="px-2 py-2.5 text-[10px] font-semibold tracking-wider text-slate-600">
                    STATUS
                  </th>
                  <th className="px-2 py-2.5 text-right text-[10px] font-semibold tracking-wider text-slate-600">
                    CONTRACT
                  </th>
                  <th className="px-5 py-2.5 text-right text-[10px] font-semibold tracking-wider text-slate-600">
                    NET P&L
                  </th>
                </tr>
              </thead>
              <tbody>
                {PROJECTS.map((p) => (
                  <tr
                    key={p.code}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-5 py-3 font-mono text-[12px] text-indigo-700 hover:underline">
                      {p.code}
                    </td>
                    <td className="px-2 py-3 text-slate-800">{p.name}</td>
                    <td className="px-2 py-3">
                      <EnterpriseStatus status={p.status} />
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                      {inr(p.contract)}
                    </td>
                    <td
                      className={
                        "px-5 py-3 text-right font-medium tabular-nums " +
                        (p.net < 0 ? "text-red-700" : "text-slate-900")
                      }
                    >
                      {inr(p.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <div
              className="border-b border-slate-200 px-5 py-3 text-[14px] font-semibold text-slate-900"
              style={{ backgroundColor: "#F8FAFC" }}
            >
              Recent Activity
            </div>
            <ul>
              {ACTIVITY.map((a, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 border-b border-slate-100 px-5 py-3 last:border-0"
                >
                  <div
                    className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: "#4338CA" }}
                  />
                  <div className="flex-1 text-[12px]">
                    <div className="text-slate-800">
                      <span className="font-semibold">{a.who}</span>{" "}
                      <span className="text-slate-600">{a.what}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      <span className="font-mono text-indigo-700">{a.proj}</span>{" "}
                      · {a.when}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function EnterpriseStatus({ status }: { status: string }) {
  const map: Record<string, { border: string; bg: string; fg: string; label: string }> = {
    ACTIVE: {
      border: "border-emerald-200",
      bg: "bg-emerald-50",
      fg: "text-emerald-800",
      label: "Active",
    },
    ON_HOLD: {
      border: "border-amber-200",
      bg: "bg-amber-50",
      fg: "text-amber-800",
      label: "On Hold",
    },
    COMPLETED: {
      border: "border-slate-200",
      bg: "bg-slate-50",
      fg: "text-slate-600",
      label: "Completed",
    },
  };
  const s = map[status] ?? map.ACTIVE;
  return (
    <span
      className={
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
        s.border +
        " " +
        s.bg +
        " " +
        s.fg
      }
    >
      {s.label}
    </span>
  );
}

// === THEME 5 — FINANCE NAVY =================================================

function ThemeNavy() {
  const parens = (n: number) =>
    n < 0 ? "(" + inr(Math.abs(n)) + ")" : inr(n);

  return (
    <div className="overflow-hidden rounded-[3px] border border-slate-300 bg-white font-[system-ui]">
      {/* Navy top bar */}
      <div
        className="flex items-center justify-between px-6 py-3 text-white"
        style={{ backgroundColor: "#0A2540" }}
      >
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5 border-r border-white/15 pr-6">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-[3px] text-[12px] font-bold"
              style={{ backgroundColor: "#C9A961", color: "#0A2540" }}
            >
              S
            </div>
            <div>
              <div className="text-[14px] font-semibold tracking-tight">
                SAB INDIA
              </div>
              <div
                className="text-[9px] font-medium uppercase tracking-[0.18em]"
                style={{ color: "#C9A961" }}
              >
                Project Financials
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-0 text-[12px]">
            {[
              { n: "Dashboard", a: true },
              { n: "Projects", a: false },
              { n: "Timesheets", a: false },
              { n: "Inventory", a: false },
              { n: "P&L", a: false },
              { n: "Reports", a: false },
            ].map((x) => (
              <a
                key={x.n}
                className={
                  "relative px-4 py-1 font-medium " +
                  (x.a ? "text-white" : "text-white/60 hover:text-white")
                }
              >
                {x.n}
                {x.a && (
                  <span
                    className="absolute inset-x-3 -bottom-3 h-[2px]"
                    style={{ backgroundColor: "#C9A961" }}
                  />
                )}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <div className="tabular-nums text-white/70">
            FY 25–26 · Q4 · IST 16:42
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold">
            PM
          </div>
        </div>
      </div>

      {/* Sub-header with breadcrumb */}
      <div className="border-b border-slate-200 px-6 py-3">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">
          Portfolio &nbsp;/&nbsp;{" "}
          <span className="text-slate-900">Dashboard</span>
        </div>
        <div className="mt-1 flex items-end justify-between">
          <div>
            <h2
              className="text-[22px] font-semibold tracking-tight text-slate-900"
              style={{ fontFamily: "'Source Serif Pro', Georgia, serif" }}
            >
              Portfolio Overview
            </h2>
            <p className="text-[11px] text-slate-500">
              Rolling 30 days · All projects · INR
            </p>
          </div>
          <div className="flex gap-2">
            <button className="h-9 rounded-[3px] border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
              Export XLSX
            </button>
            <button
              className="h-9 rounded-[3px] px-4 text-[12px] font-semibold text-white"
              style={{ backgroundColor: "#0A2540" }}
            >
              + New Project
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 p-6">
        {/* KPI strip */}
        <div className="mb-5 grid grid-cols-4 gap-px overflow-hidden rounded-[3px] border border-slate-300 bg-slate-300">
          {[
            { label: "CONTRACT VALUE", v: "₹91,80,000", d: "+12.4%", up: true },
            { label: "REVENUE · MTD", v: "₹39,45,120", d: "+8.1%", up: true },
            { label: "CONTRIBUTION", v: "21.3%", d: "+2.1 pp", up: true },
            { label: "NET P&L", v: "₹7,34,400", d: "−3.2%", up: false },
          ].map((k) => (
            <div key={k.label} className="bg-white px-5 py-4">
              <div className="text-[10px] font-semibold tracking-[0.14em] text-slate-500">
                {k.label}
              </div>
              <div
                className="mt-2 text-[24px] font-semibold tracking-tight tabular-nums"
                style={{ color: "#0A2540" }}
              >
                {k.v}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium tabular-nums">
                <span
                  style={{ color: k.up ? "#047857" : "#B91C1C" }}
                  className="tabular-nums"
                >
                  {k.d}
                </span>
                <span className="text-slate-400">vs prior</span>
              </div>
            </div>
          ))}
        </div>

        {/* Table + side */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 overflow-hidden rounded-[3px] border border-slate-300 bg-white">
            <div className="flex items-center justify-between border-b-2 border-slate-200 px-5 py-3">
              <div>
                <div
                  className="text-[14px] font-semibold"
                  style={{ color: "#0A2540" }}
                >
                  Active Projects
                </div>
                <div className="text-[10px] text-slate-500">
                  {PROJECTS.length} projects · sorted by contract value
                </div>
              </div>
              <div
                className="flex h-7 items-center gap-2 rounded-[3px] border border-slate-300 px-2 text-[11px]"
                style={{ color: "#C9A961" }}
              >
                <span className="font-semibold">PRIME</span>
                <span className="text-slate-500">auto-refreshed</span>
              </div>
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] tracking-[0.1em] text-slate-600">
                  <th className="px-5 py-2 font-semibold">CODE</th>
                  <th className="px-2 py-2 font-semibold">CLIENT</th>
                  <th className="px-2 py-2 font-semibold">STATUS</th>
                  <th className="px-2 py-2 text-right font-semibold">
                    CONTRACT
                  </th>
                  <th className="px-2 py-2 text-right font-semibold">CM %</th>
                  <th className="px-5 py-2 text-right font-semibold">
                    NET P&L
                  </th>
                </tr>
              </thead>
              <tbody>
                {PROJECTS.map((p) => (
                  <tr
                    key={p.code}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td
                      className="px-5 py-3 font-mono text-[11px]"
                      style={{ color: "#0A2540" }}
                    >
                      {p.code}
                    </td>
                    <td className="px-2 py-3 text-slate-800">{p.client}</td>
                    <td className="px-2 py-3">
                      <NavyStatus status={p.status} />
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                      {inr(p.contract)}
                    </td>
                    <td
                      className="px-2 py-3 text-right tabular-nums"
                      style={{
                        color: p.cm < 0 ? "#B91C1C" : "#0A2540",
                      }}
                    >
                      {p.cm < 0
                        ? `(${Math.abs(p.cm).toFixed(1)}%)`
                        : `${p.cm.toFixed(1)}%`}
                    </td>
                    <td
                      className="px-5 py-3 text-right font-semibold tabular-nums"
                      style={{
                        color: p.net < 0 ? "#B91C1C" : "#0A2540",
                      }}
                    >
                      {parens(p.net)}
                    </td>
                  </tr>
                ))}
                <tr
                  className="border-t-2 border-slate-300 bg-slate-50 text-[12px] font-semibold"
                  style={{ color: "#0A2540" }}
                >
                  <td className="px-5 py-2.5" colSpan={3}>
                    TOTAL
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {inr(PROJECTS.reduce((a, p) => a + p.contract, 0))}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">—</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">
                    {parens(PROJECTS.reduce((a, p) => a + p.net, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-[3px] border border-slate-300 bg-white">
            <div
              className="border-b-2 border-slate-200 px-5 py-3 text-[14px] font-semibold"
              style={{ color: "#0A2540" }}
            >
              Audit Trail
            </div>
            <ul className="divide-y divide-slate-100">
              {ACTIVITY.map((a, i) => (
                <li key={i} className="px-5 py-3 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-500">
                      {a.when.toUpperCase()}
                    </span>
                    <span
                      className="font-mono text-[10px]"
                      style={{ color: "#C9A961" }}
                    >
                      {a.proj}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-800">
                    <span className="font-semibold">{a.who}</span>{" "}
                    <span className="text-slate-600">{a.what}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavyStatus({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    ACTIVE: { bg: "#0A2540", fg: "#FFFFFF", label: "Active" },
    ON_HOLD: { bg: "#FEF3C7", fg: "#92400E", label: "On Hold" },
    COMPLETED: { bg: "#E2E8F0", fg: "#475569", label: "Completed" },
  };
  const s = map[status] ?? map.ACTIVE;
  return (
    <span
      className="inline-flex items-center rounded-[2px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

// === THEME 6 — CLINICAL TEAL ================================================

function ThemeClinical() {
  const teal = "#0F766E";
  const tealLight = "#CCFBF1";
  return (
    <div
      className="overflow-hidden rounded-xl border font-[system-ui]"
      style={{ backgroundColor: "#F0FDFA", borderColor: "#99F6E4" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-3.5" style={{ borderColor: "#CCFBF1" }}>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: teal }}
            >
              <span className="absolute text-[15px] font-bold leading-none">+</span>
            </div>
            <div>
              <div className="text-[15px] font-semibold text-slate-900">
                SAB India
              </div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Medical Installation
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-1 text-[13px]">
            {[
              { n: "Dashboard", a: true },
              { n: "Projects", a: false },
              { n: "Timesheets", a: false },
              { n: "Inventory", a: false },
              { n: "Reports", a: false },
            ].map((x) => (
              <a
                key={x.n}
                className={
                  "rounded-lg px-3.5 py-1.5 font-medium transition " +
                  (x.a ? "text-white" : "text-slate-600 hover:bg-teal-50")
                }
                style={x.a ? { backgroundColor: teal } : {}}
              >
                {x.n}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium"
            style={{ backgroundColor: tealLight, color: teal }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: teal }} />
            All systems normal
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search…"
              className="h-9 w-56 rounded-lg border bg-white pl-9 pr-3 text-[13px] outline-none focus:border-teal-600"
              style={{ borderColor: "#CCFBF1" }}
            />
          </div>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: teal }}
          >
            PM
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Portfolio overview
            </h2>
            <p className="mt-1 text-[13px] text-slate-600">
              5 active installations · Apollo, Fortis, Max, AIIMS, Manipal
            </p>
          </div>
          <div className="flex gap-2">
            <button className="flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50" style={{ borderColor: "#CCFBF1" }}>
              <Download className="h-4 w-4" /> Export
            </button>
            <button
              className="flex h-10 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: teal }}
            >
              <Plus className="h-4 w-4" /> New project
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="mb-5 grid grid-cols-4 gap-4">
          {[
            { label: "Contract value", v: "₹91.8L", d: "+12.4%", up: true, icon: FolderKanban },
            { label: "Revenue (MTD)", v: "₹39.5L", d: "+8.1%", up: true, icon: TrendingUp },
            { label: "Contribution", v: "21.3%", d: "+2.1pp", up: true, icon: Activity },
            { label: "Net P&L", v: "₹7.34L", d: "-3.2%", up: false, icon: BarChart3 },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-xl border bg-white p-5"
              style={{ borderColor: "#CCFBF1" }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: tealLight }}
                >
                  <k.icon className="h-5 w-5" style={{ color: teal }} />
                </div>
                <div
                  className={
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                    (k.up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")
                  }
                >
                  {k.d}
                </div>
              </div>
              <div className="mt-4 text-[12px] font-medium text-slate-600">
                {k.label}
              </div>
              <div className="mt-1 text-[26px] font-semibold tracking-tight text-slate-900 tabular-nums">
                {k.v}
              </div>
            </div>
          ))}
        </div>

        {/* Table + activity */}
        <div className="grid grid-cols-3 gap-4">
          <div
            className="col-span-2 overflow-hidden rounded-xl border bg-white"
            style={{ borderColor: "#CCFBF1" }}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="text-[15px] font-semibold text-slate-900">
                Installation sites
              </div>
              <div className="flex gap-2">
                <button className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-medium" style={{ color: teal }}>All (5)</button>
                <button className="rounded-full px-3 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50">Active (3)</button>
                <button className="rounded-full px-3 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50">Completed</button>
              </div>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-y text-left text-[11px] font-medium uppercase tracking-wider text-slate-500" style={{ borderColor: "#CCFBF1" }}>
                  <th className="px-5 py-2.5">Site</th>
                  <th className="px-2 py-2.5">Status</th>
                  <th className="px-2 py-2.5 text-right">Progress</th>
                  <th className="px-5 py-2.5 text-right">Net P&L</th>
                </tr>
              </thead>
              <tbody>
                {PROJECTS.map((p) => (
                  <tr key={p.code} className="border-b last:border-0 hover:bg-teal-50/30" style={{ borderColor: "#F0FDFA" }}>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="font-mono text-[10px] text-slate-500">{p.code}</div>
                    </td>
                    <td className="px-2 py-3.5">
                      <ClinicalStatus status={p.status} />
                    </td>
                    <td className="px-2 py-3.5 text-right">
                      <div className="ml-auto flex w-32 items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{ width: p.progress + "%", backgroundColor: teal }}
                          />
                        </div>
                        <span className="w-8 text-right text-[11px] tabular-nums text-slate-600">
                          {p.progress}%
                        </span>
                      </div>
                    </td>
                    <td className={"px-5 py-3.5 text-right font-semibold tabular-nums " + (p.net < 0 ? "text-rose-600" : "text-slate-900")}>
                      {inr(p.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: "#CCFBF1" }}>
            <div className="border-b px-5 py-4 text-[15px] font-semibold text-slate-900" style={{ borderColor: "#CCFBF1" }}>
              Recent activity
            </div>
            <ul>
              {ACTIVITY.map((a, i) => (
                <li key={i} className="flex items-start gap-3 border-b px-5 py-3 text-[12px] last:border-0" style={{ borderColor: "#F0FDFA" }}>
                  <div
                    className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
                    style={{ backgroundColor: tealLight, color: teal }}
                  >
                    {a.who[0]}
                  </div>
                  <div className="flex-1">
                    <div className="text-slate-800">
                      <span className="font-medium">{a.who}</span>{" "}
                      <span className="text-slate-600">{a.what}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      <span className="font-mono">{a.proj}</span> · {a.when}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClinicalStatus({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    ACTIVE: { bg: "#CCFBF1", fg: "#0F766E", label: "Installing" },
    ON_HOLD: { bg: "#FEF3C7", fg: "#92400E", label: "On hold" },
    COMPLETED: { bg: "#F1F5F9", fg: "#475569", label: "Handed over" },
  };
  const s = map[status] ?? map.ACTIVE;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.fg }} />
      {s.label}
    </span>
  );
}

// === THEME 7 — GRAPHITE SIDEBAR =============================================

function ThemeSidebar() {
  const amber = "#F59E0B";
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 font-[system-ui]">
      <div className="flex min-h-[720px]">
        {/* Sidebar */}
        <aside
          className="flex w-56 flex-col text-slate-300"
          style={{ backgroundColor: "#111827" }}
        >
          <div className="flex items-center gap-2 px-5 py-5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-bold text-white"
              style={{ backgroundColor: amber }}
            >
              S
            </div>
            <div className="text-[14px] font-semibold text-white">SAB Tracker</div>
          </div>

          <div className="px-3 py-1">
            <div className="px-3 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Workspace
            </div>
            {[
              { n: "Dashboard", i: LayoutDashboard, a: true },
              { n: "Projects", i: FolderKanban, a: false },
              { n: "Timesheets", i: Clock, a: false },
              { n: "Inventory", i: Package, a: false },
            ].map((x) => (
              <a
                key={x.n}
                className={
                  "mt-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition " +
                  (x.a
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200")
                }
              >
                <x.i className="h-4 w-4" />
                {x.n}
                {x.a && (
                  <span
                    className="ml-auto h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: amber }}
                  />
                )}
              </a>
            ))}

            <div className="px-3 pt-5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Financials
            </div>
            {[
              { n: "Reports", i: BarChart3 },
              { n: "Overhead", i: Activity },
            ].map((x) => (
              <a
                key={x.n}
                className="mt-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <x.i className="h-4 w-4" />
                {x.n}
              </a>
            ))}
          </div>

          <div className="mt-auto border-t border-slate-800 px-3 py-3">
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-800">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ backgroundColor: amber }}
              >
                PM
              </div>
              <div className="min-w-0 flex-1 text-[12px]">
                <div className="truncate text-white">Priya Mehta</div>
                <div className="truncate text-[10px] text-slate-500">
                  manager@sab.local
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 bg-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-7 py-4">
            <div>
              <div className="text-[11px] text-slate-500">Workspace / Dashboard</div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Good afternoon, Priya
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  placeholder="Search…"
                  className="h-9 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>
              <button className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
                <Download className="h-3.5 w-3.5" /> Export
              </button>
              <button
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-white"
                style={{ backgroundColor: "#111827" }}
              >
                <Plus className="h-3.5 w-3.5" /> New project
              </button>
            </div>
          </div>

          <div className="p-7">
            {/* KPIs */}
            <div className="mb-5 grid grid-cols-4 gap-3">
              {[
                { label: "Contract value", v: "₹91.8L", d: "+12.4%", up: true },
                { label: "Revenue (MTD)", v: "₹39.5L", d: "+8.1%", up: true },
                { label: "Contribution", v: "21.3%", d: "+2.1pp", up: true },
                { label: "Net P&L", v: "₹7.34L", d: "-3.2%", up: false },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-medium text-slate-600">
                      {k.label}
                    </div>
                    <div
                      className={
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums " +
                        (k.up
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700")
                      }
                    >
                      {k.d}
                    </div>
                  </div>
                  <div className="mt-2 text-[22px] font-semibold tracking-tight text-slate-900 tabular-nums">
                    {k.v}
                  </div>
                  <div
                    className="mt-2 h-1 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: "#F1F5F9" }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: "65%",
                        backgroundColor: amber,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Table + activity */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                  <div className="text-[14px] font-semibold text-slate-900">
                    Projects
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-[11px]">
                    <button className="rounded-md bg-white px-2.5 py-1 font-medium text-slate-900 shadow-sm">
                      All
                    </button>
                    <button className="px-2.5 py-1 font-medium text-slate-600">
                      Active
                    </button>
                    <button className="px-2.5 py-1 font-medium text-slate-600">
                      Mine
                    </button>
                  </div>
                </div>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[10px] font-medium uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-2.5">Project</th>
                      <th className="px-2 py-2.5">Status</th>
                      <th className="px-2 py-2.5 text-right">Progress</th>
                      <th className="px-5 py-2.5 text-right">Net P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PROJECTS.map((p) => (
                      <tr
                        key={p.code}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-900">
                            {p.name}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">
                            {p.code}
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <SidebarStatus status={p.status} />
                        </td>
                        <td className="px-2 py-3 text-right text-[11px] tabular-nums text-slate-700">
                          {p.progress}%
                        </td>
                        <td
                          className={
                            "px-5 py-3 text-right font-semibold tabular-nums " +
                            (p.net < 0 ? "text-rose-600" : "text-slate-900")
                          }
                        >
                          {inr(p.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                  <div className="text-[14px] font-semibold text-slate-900">
                    Activity
                  </div>
                  <button className="text-[11px] text-slate-500 hover:text-slate-900">
                    View all
                  </button>
                </div>
                <ul>
                  {ACTIVITY.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 border-b border-slate-100 px-5 py-3 text-[12px] last:border-0"
                    >
                      <div
                        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
                        style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
                      >
                        {a.who[0]}
                      </div>
                      <div className="flex-1">
                        <div className="text-slate-800">
                          <span className="font-medium">{a.who}</span>{" "}
                          <span className="text-slate-600">{a.what}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          <span className="font-mono">{a.proj}</span> · {a.when}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarStatus({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    ACTIVE: {
      cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
      label: "Active",
    },
    ON_HOLD: { cls: "bg-amber-50 text-amber-700 ring-amber-600/20", label: "On hold" },
    COMPLETED: { cls: "bg-slate-100 text-slate-600 ring-slate-600/20", label: "Done" },
  };
  const s = map[status] ?? map.ACTIVE;
  return (
    <span
      className={
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset " +
        s.cls
      }
    >
      {s.label}
    </span>
  );
}

// === THEME 8 — EXECUTIVE SAPPHIRE ===========================================

function Sparkline({ color, data }: { color: string; data: number[] }) {
  const w = 80;
  const h = 28;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const rng = max - min || 1;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * h}`,
    )
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <polyline
        fill={color}
        fillOpacity="0.08"
        stroke="none"
        points={`0,${h} ${points} ${w},${h}`}
      />
    </svg>
  );
}

function ThemeSapphire() {
  const sapphire = "#0B5CAD";
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white font-[system-ui]">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded text-[13px] font-bold text-white"
              style={{ backgroundColor: sapphire }}
            >
              S
            </div>
            <div>
              <div className="text-[14px] font-semibold text-slate-900">
                SAB India Tracker
              </div>
              <div className="text-[10px] font-medium tracking-wider text-slate-500">
                EXECUTIVE DASHBOARD
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-0.5 text-[13px]">
            {[
              { n: "Home", a: true },
              { n: "Projects", a: false },
              { n: "Timesheets", a: false },
              { n: "Inventory", a: false },
              { n: "Reports", a: false },
              { n: "Admin", a: false },
            ].map((x) => (
              <a
                key={x.n}
                className={
                  "rounded-md px-3 py-1.5 font-medium transition " +
                  (x.a
                    ? "text-white"
                    : "text-slate-700 hover:bg-slate-100")
                }
                style={x.a ? { backgroundColor: sapphire } : {}}
              >
                {x.n}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Find project, invoice, material…"
              className="h-9 w-72 rounded-md border border-slate-300 pl-8 pr-3 text-[13px] outline-none focus:border-sapphire focus:ring-1"
              style={{ ["--tw-ring-color" as string]: sapphire }}
            />
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 hover:bg-slate-50">
            <Bell className="h-4 w-4 text-slate-600" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
            PM
          </div>
        </div>
      </div>

      <div className="p-6" style={{ backgroundColor: "#F4F6F9" }}>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="text-[11px] font-medium tracking-wider text-slate-500">
              OVERVIEW
            </div>
            <h2 className="text-[26px] font-semibold tracking-tight text-slate-900">
              Portfolio Performance
            </h2>
            <p className="text-[12px] text-slate-600">
              FY 2025–26 · Rolling 30 days · Last sync 2 min ago
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-slate-300 bg-white p-0.5 text-[11px] font-medium">
              <button className="rounded px-3 py-1 text-white" style={{ backgroundColor: sapphire }}>
                30d
              </button>
              <button className="px-3 py-1 text-slate-700">90d</button>
              <button className="px-3 py-1 text-slate-700">YTD</button>
            </div>
            <button className="flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            <button
              className="flex h-9 items-center gap-1.5 rounded-md px-4 text-[12px] font-semibold text-white"
              style={{ backgroundColor: sapphire }}
            >
              <Plus className="h-3.5 w-3.5" /> New project
            </button>
          </div>
        </div>

        {/* KPIs with sparklines */}
        <div className="mb-5 grid grid-cols-4 gap-4">
          {[
            {
              label: "CONTRACT VALUE",
              v: "₹91,80,000",
              d: "+12.4%",
              up: true,
              spark: [3, 4, 3.5, 5, 5.5, 6, 7, 7.5, 8, 9.18],
            },
            {
              label: "REVENUE · MTD",
              v: "₹39,45,120",
              d: "+8.1%",
              up: true,
              spark: [1.8, 2.1, 2.3, 2.6, 2.5, 3, 3.2, 3.5, 3.7, 3.95],
            },
            {
              label: "CONTRIBUTION",
              v: "21.3%",
              d: "+2.1pp",
              up: true,
              spark: [18, 19, 19.4, 20, 19.8, 20.5, 20.9, 21, 21.2, 21.3],
            },
            {
              label: "NET P&L",
              v: "₹7,34,400",
              d: "-3.2%",
              up: false,
              spark: [8.2, 8.5, 8.8, 8.6, 8.4, 8.1, 7.9, 7.7, 7.5, 7.34],
            },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-semibold tracking-wider text-slate-500">
                    {k.label}
                  </div>
                  <div className="mt-2 text-[24px] font-semibold tracking-tight text-slate-900 tabular-nums">
                    {k.v}
                  </div>
                </div>
                <Sparkline
                  color={k.up ? "#059669" : "#DC2626"}
                  data={k.spark}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <div
                  className={
                    "flex items-center gap-1 font-semibold tabular-nums " +
                    (k.up ? "text-emerald-700" : "text-red-700")
                  }
                >
                  {k.up ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {k.d}
                </div>
                <span className="text-slate-500">vs last period</span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts row + activity */}
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div className="col-span-2 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[14px] font-semibold text-slate-900">
                  Revenue vs direct cost
                </div>
                <div className="text-[11px] text-slate-500">
                  Last 12 weeks · INR lakhs
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: sapphire }}
                  />
                  Revenue
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  Direct cost
                </div>
              </div>
            </div>
            {/* Mock bar chart */}
            <div className="flex h-36 items-end gap-2">
              {[
                [6, 4], [7, 4.5], [5.5, 4.1], [8, 5], [9, 5.8], [8.5, 5.5],
                [10, 6.5], [11, 7], [9.5, 6.2], [12, 8], [13, 8.5], [14, 9],
              ].map(([rev, cost], i) => (
                <div key={i} className="flex flex-1 flex-col justify-end gap-0.5">
                  <div
                    className="w-full rounded-t-sm"
                    style={{
                      height: `${(rev / 14) * 100}%`,
                      backgroundColor: sapphire,
                    }}
                  />
                  <div
                    className="w-full rounded-t-sm bg-slate-300"
                    style={{ height: `${(cost / 14) * 40}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-slate-500">
              <span>W1</span><span>W4</span><span>W7</span><span>W10</span><span>Now</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[14px] font-semibold text-slate-900">
              Cost composition
            </div>
            <div className="text-[11px] text-slate-500">Current month</div>
            <div className="mt-4 space-y-3">
              {[
                { label: "Labor", v: 39.1, color: sapphire },
                { label: "Material", v: 16.8, color: "#0EA5E9" },
                { label: "Overhead", v: 25, color: "#94A3B8" },
                { label: "Other", v: 0.5, color: "#CBD5E1" },
              ].map((seg) => (
                <div key={seg.label}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-700">{seg.label}</span>
                    <span className="font-semibold tabular-nums text-slate-900">
                      ₹{seg.v}k
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(seg.v / 40) * 100}%`,
                        backgroundColor: seg.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Projects table */}
        <div className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <div className="text-[14px] font-semibold text-slate-900">
              Top projects by contract value
            </div>
            <button className="text-[11px] font-medium" style={{ color: sapphire }}>
              View all →
            </button>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr
                className="border-b border-slate-200 text-left text-[10px] font-semibold tracking-wider text-slate-500"
                style={{ backgroundColor: "#F8FAFC" }}
              >
                <th className="px-5 py-2.5">CODE</th>
                <th className="px-2 py-2.5">CLIENT</th>
                <th className="px-2 py-2.5">STATUS</th>
                <th className="px-2 py-2.5 text-right">CONTRACT</th>
                <th className="px-2 py-2.5 text-right">CM %</th>
                <th className="px-5 py-2.5 text-right">NET P&L</th>
              </tr>
            </thead>
            <tbody>
              {PROJECTS.map((p) => (
                <tr
                  key={p.code}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td
                    className="px-5 py-3 font-mono text-[11px] font-medium"
                    style={{ color: sapphire }}
                  >
                    {p.code}
                  </td>
                  <td className="px-2 py-3 text-slate-800">{p.client}</td>
                  <td className="px-2 py-3">
                    <SapphireStatus status={p.status} />
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                    {inr(p.contract)}
                  </td>
                  <td
                    className={
                      "px-2 py-3 text-right tabular-nums " +
                      (p.cm < 0 ? "text-red-700" : "text-emerald-700")
                    }
                  >
                    {p.cm.toFixed(1)}%
                  </td>
                  <td
                    className={
                      "px-5 py-3 text-right font-semibold tabular-nums " +
                      (p.net < 0 ? "text-red-700" : "text-slate-900")
                    }
                  >
                    {inr(p.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SapphireStatus({ status }: { status: string }) {
  const map: Record<string, { dot: string; fg: string; label: string }> = {
    ACTIVE: { dot: "#059669", fg: "text-emerald-800", label: "Active" },
    ON_HOLD: { dot: "#D97706", fg: "text-amber-800", label: "On hold" },
    COMPLETED: { dot: "#64748B", fg: "text-slate-600", label: "Completed" },
  };
  const s = map[status] ?? map.ACTIVE;
  return (
    <span className={"inline-flex items-center gap-1.5 text-[11px] font-medium " + s.fg}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  );
}
