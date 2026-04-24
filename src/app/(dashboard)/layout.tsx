import { redirect } from "next/navigation";
import { auth, signOut } from "@/server/auth";
import { Sidebar, TopBar, SignOutButton } from "@/components/sab";
import { AIAssistantLauncher } from "@/components/ai/AIAssistantLauncher";
import { aiEnabled } from "@/lib/ai/client";

export default async function DashboardLayout({
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

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--sab-paper)",
        color: "var(--sab-ink)",
      }}
    >
      <Sidebar
        userName={session.user.name ?? "User"}
        userRole={session.user.role ?? "USER"}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar
          title="Operations workspace"
          right={
            <form action={handleSignOut}>
              <SignOutButton />
            </form>
          }
        />
        <main style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>{children}</main>
      </div>
      {aiEnabled() && <AIAssistantLauncher />}
    </div>
  );
}
