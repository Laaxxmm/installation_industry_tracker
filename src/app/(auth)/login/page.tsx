import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { LoginForm } from "./LoginForm";

// Reskinned in the SAB "Industrial Operations, papered" language — warm cream
// paper + orange signal mark + ink left pane. Matches the mobile shell so the
// journey from /login into /punch feels like the same app.

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  if (session?.user) redirect(sp.callbackUrl ?? "/");

  return (
    <main className="relative min-h-screen overflow-hidden bg-sab-paper font-sab-sans">
      {/* Warm paper-grain wash — same vibe as the mobile header */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 500px at -10% -10%, oklch(0.965 0.022 55 / 0.55), transparent), radial-gradient(800px 400px at 110% 110%, oklch(0.965 0.022 55 / 0.4), transparent)",
        }}
      />
      <div className="mx-auto grid min-h-screen max-w-[1200px] grid-cols-1 lg:grid-cols-2">
        {/* Left: ink brand pane (desktop only) */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-sab-ink px-10 py-10 text-white lg:flex">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(600px 320px at 15% 0%, oklch(0.68 0.16 45 / 0.18), transparent), radial-gradient(700px 400px at 100% 100%, oklch(0.68 0.16 45 / 0.08), transparent)",
            }}
          />
          <div className="relative flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[7px] bg-sab-accent">
              <svg width="22" height="22" viewBox="0 0 40 40">
                <path
                  d="M11 25c0-4 3-6 7-6s7-2 7-6"
                  stroke="#fff"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx="11" cy="15" r="2.4" fill="#fff" />
                <circle cx="29" cy="25" r="2.4" fill="#fff" />
              </svg>
            </span>
            <div className="flex flex-col leading-[1.1]">
              <span className="text-[14px] font-semibold tracking-[-0.01em]">
                SAB India
              </span>
              <span className="font-sab-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
                Project Tracker
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="font-sab-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
              Fire-safety installation tracker
            </div>
            <h1 className="mt-3 font-sab-sans text-[34px] font-semibold leading-[1.1] tracking-[-0.025em]">
              Every project.
              <br />
              Every{" "}
              <span className="text-sab-accent">rupee</span>.
              <br />
              One source of truth.
            </h1>
            <p className="mt-4 max-w-md text-[13px] leading-[1.55] text-white/70">
              Track labor, materials, overhead and revenue against unique
              project codes — with real-time contribution margin and net P&amp;L
              across every site.
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-3 text-[11px]">
            {[
              { k: "Projects", v: "Code-tracked" },
              { k: "Labor", v: "Hourly + salaried" },
              { k: "Stock", v: "Moving-average" },
            ].map((item) => (
              <div
                key={item.k}
                className="rounded-[10px] border border-white/10 bg-white/[0.04] p-3"
              >
                <div className="font-sab-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-white/50">
                  {item.k}
                </div>
                <div className="mt-[3px] font-sab-sans text-[13px] font-semibold tracking-[-0.01em]">
                  {item.v}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Right: login card — mobile-first */}
        <section className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            {/* Brand lockup (mobile only — desktop has the left pane) */}
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <span className="flex h-9 w-9 items-center justify-center rounded-[7px] bg-sab-accent">
                <svg width="22" height="22" viewBox="0 0 40 40">
                  <path
                    d="M11 25c0-4 3-6 7-6s7-2 7-6"
                    stroke="#fff"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <circle cx="11" cy="15" r="2.4" fill="#fff" />
                  <circle cx="29" cy="25" r="2.4" fill="#fff" />
                </svg>
              </span>
              <div className="flex flex-col leading-[1.1]">
                <span className="font-sab-sans text-[14px] font-semibold tracking-[-0.01em] text-sab-ink">
                  SAB India
                </span>
                <span className="font-sab-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-sab-ink-3">
                  Project Tracker
                </span>
              </div>
            </div>

            <div className="rounded-[14px] border border-sab-rule bg-sab-card p-6 shadow-card">
              <div className="mb-5">
                <div className="sab-eyebrow">Welcome back</div>
                <h2 className="mt-1 font-sab-sans text-[22px] font-semibold tracking-[-0.025em] text-sab-ink">
                  Sign in
                </h2>
                <p className="mt-1 font-sab-sans text-[13px] text-sab-ink-3">
                  Use your SAB India credentials to continue.
                </p>
              </div>
              <LoginForm callbackUrl={sp.callbackUrl} error={sp.error} />
            </div>

            <p className="mt-4 text-center font-sab-mono text-[10px] uppercase tracking-[0.12em] text-sab-ink-3">
              Secure session · Asia/Kolkata · IST timestamps
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
