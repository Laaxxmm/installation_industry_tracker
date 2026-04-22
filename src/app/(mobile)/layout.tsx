import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { NavPillsMobile } from "./NavPillsMobile";

export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const initials = (session.user.name ?? "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6F9]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/punch" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-[13px] font-bold text-white">
              S
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-slate-900">
                SAB Tracker
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Field crew
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">
                {initials}
              </span>
              <div className="hidden flex-col leading-tight sm:flex">
                <span className="text-[11px] font-medium text-slate-900">
                  {session.user.name}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-slate-500">
                  {session.user.role}
                </span>
              </div>
            </div>
            <form action={handleSignOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
        <NavPillsMobile />
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5">
        {children}
      </main>
    </div>
  );
}
