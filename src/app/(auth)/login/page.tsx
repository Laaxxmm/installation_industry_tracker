import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  if (session?.user) redirect(sp.callbackUrl ?? "/");

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F4F6F9]">
      {/* Sapphire decorative background */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 600px at -10% -10%, rgba(11,92,173,0.10), transparent), radial-gradient(900px 500px at 110% 110%, rgba(11,92,173,0.06), transparent)",
        }}
      />
      <div className="mx-auto grid min-h-screen max-w-[1200px] grid-cols-1 lg:grid-cols-2">
        {/* Left: brand pane (desktop only) */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand px-10 py-10 text-white lg:flex">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(600px 300px at 20% 0%, rgba(255,255,255,0.18), transparent), radial-gradient(700px 400px at 100% 100%, rgba(255,255,255,0.10), transparent)",
            }}
          />
          <div className="relative flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/15 text-[15px] font-bold backdrop-blur">
              S
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[14px] font-semibold">SAB India</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Project Tracker
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Executive dashboard
            </div>
            <h1 className="mt-3 text-[32px] font-semibold leading-[1.15] tracking-tight">
              Every project.
              <br />
              Every rupee.
              <br />
              One source of truth.
            </h1>
            <p className="mt-4 max-w-md text-[13px] leading-relaxed text-white/80">
              Track labor, materials, overhead and revenue against unique
              project codes — with real-time contribution margin and net P&amp;L
              across every site.
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-4 text-[11px]">
            {[
              { k: "Projects", v: "Code-tracked" },
              { k: "Labor", v: "Hourly + salaried" },
              { k: "Stock", v: "Moving-average" },
            ].map((item) => (
              <div
                key={item.k}
                className="rounded-md border border-white/15 bg-white/5 p-3 backdrop-blur"
              >
                <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/60">
                  {item.k}
                </div>
                <div className="mt-1 text-[13px] font-semibold">{item.v}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* Right: login card */}
        <section className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-[15px] font-bold text-white">
                S
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[14px] font-semibold text-slate-900">
                  SAB India
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Project Tracker
                </span>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-6 shadow-card">
              <div className="mb-5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Welcome back
                </div>
                <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-slate-900">
                  Sign in
                </h2>
                <p className="mt-1 text-[12px] text-slate-500">
                  Use your SAB India credentials to continue.
                </p>
              </div>
              <LoginForm callbackUrl={sp.callbackUrl} error={sp.error} />
            </div>

            <p className="mt-4 text-center text-[11px] text-slate-500">
              Secure session · Asia/Kolkata · IST timestamps
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
