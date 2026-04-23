import { redirect } from "next/navigation";
import { auth, signOut } from "@/server/auth";
import { MobileHeader } from "@/components/sab/MobileHeader";
import { MobileTabBar } from "@/components/sab/MobileTabBar";
import { getOpenEntry } from "@/server/queries/open-entry";

export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const openEntry = await getOpenEntry(session.user.id);
  const isLive = !!openEntry;
  const tone = isLive ? "ink" : "paper";

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div
      className={
        "flex min-h-screen flex-col font-sab-sans " +
        (isLive ? "bg-sab-ink text-white" : "bg-sab-paper text-sab-ink")
      }
    >
      <MobileHeader
        userName={session.user.name ?? "Team"}
        role={session.user.role ?? "EMPLOYEE"}
        tone={tone}
        onSignOut={handleSignOut}
      />
      <main className="mx-auto w-full max-w-lg flex-1 pb-24">{children}</main>
      <MobileTabBar tone={tone} />
    </div>
  );
}
