import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { Bell, Search } from "lucide-react";
import { auth, signOut } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { NavPills, type NavPillItem } from "@/components/shell/nav-pills";

type RoledLink = {
  href: string;
  label: string;
  description?: string;
  roles: Role[];
};

type RoledGroup = {
  label: string;
  roles: Role[];
  items: RoledLink[];
};

type RoledNav =
  | { kind: "link"; link: RoledLink; matchPrefixes?: string[] }
  | { kind: "group"; group: RoledGroup };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role;

  const nav: RoledNav[] = [
    {
      kind: "link",
      link: {
        href: "/dashboard",
        label: "Home",
        roles: [Role.ADMIN, Role.MANAGER, Role.SUPERVISOR],
      },
    },
    {
      kind: "link",
      link: {
        href: "/projects",
        label: "Projects",
        roles: [Role.ADMIN, Role.MANAGER, Role.SUPERVISOR],
      },
    },
    {
      kind: "group",
      group: {
        label: "Sales",
        roles: [Role.ADMIN, Role.MANAGER, Role.SUPERVISOR],
        items: [
          {
            href: "/clients",
            label: "Clients",
            description: "Customer directory",
            roles: [Role.ADMIN, Role.MANAGER, Role.SUPERVISOR],
          },
          {
            href: "/quotes",
            label: "Quotes",
            description: "Pipeline & revisions",
            roles: [Role.ADMIN, Role.MANAGER],
          },
          {
            href: "/invoices",
            label: "Tax invoices",
            description: "GST billing",
            roles: [Role.ADMIN, Role.MANAGER],
          },
        ],
      },
    },
    {
      kind: "group",
      group: {
        label: "Operations",
        roles: [Role.ADMIN, Role.MANAGER, Role.SUPERVISOR],
        items: [
          {
            href: "/timesheets",
            label: "Timesheets",
            description: "Labor hours",
            roles: [Role.ADMIN, Role.MANAGER, Role.SUPERVISOR],
          },
          {
            href: "/inventory",
            label: "Inventory",
            description: "Stock & materials",
            roles: [Role.ADMIN, Role.MANAGER, Role.SUPERVISOR],
          },
          {
            href: "/overhead",
            label: "Overhead",
            description: "Monthly allocations",
            roles: [Role.ADMIN, Role.MANAGER],
          },
        ],
      },
    },
    {
      kind: "link",
      link: {
        href: "/reports",
        label: "Reports",
        roles: [Role.ADMIN, Role.MANAGER],
      },
    },
    {
      kind: "group",
      group: {
        label: "Admin",
        roles: [Role.ADMIN],
        items: [
          {
            href: "/admin/users",
            label: "Users",
            description: "Roles & access",
            roles: [Role.ADMIN],
          },
          {
            href: "/admin/rates",
            label: "Rates",
            description: "Wage rates",
            roles: [Role.ADMIN],
          },
        ],
      },
    },
  ];

  const visibleNav: NavPillItem[] = nav
    .map((n): NavPillItem | null => {
      if (n.kind === "link") {
        if (!n.link.roles.includes(role)) return null;
        return {
          kind: "link",
          href: n.link.href,
          label: n.link.label,
          matchPrefixes: n.matchPrefixes,
        };
      }
      if (!n.group.roles.includes(role)) return null;
      const items = n.group.items
        .filter((it) => it.roles.includes(role))
        .map((it) => ({
          href: it.href,
          label: it.label,
          description: it.description,
        }));
      if (items.length === 0) return null;
      return { kind: "group", label: n.group.label, items };
    })
    .filter((n): n is NavPillItem => n !== null);

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const initials = (session.user.name ?? "U")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[60px] max-w-[1400px] items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-brand text-[13px] font-bold text-white">
                S
              </div>
              <div className="leading-tight">
                <div className="text-[14px] font-semibold text-slate-900">
                  SAB India Tracker
                </div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Executive Dashboard
                </div>
              </div>
            </Link>
            <NavPills items={visibleNav} />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Find project, invoice, material…"
                className="h-9 w-72 rounded-md border border-slate-300 bg-white pl-8 pr-3 text-[13px] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="mx-1 hidden h-5 w-px bg-slate-200 md:block" />
            <div className="hidden items-center gap-2 md:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
                {initials}
              </div>
              <div className="leading-tight">
                <div className="text-[12px] font-medium text-slate-900">
                  {session.user.name}
                </div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  {role}
                </div>
              </div>
            </div>
            <form action={handleSignOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
    </div>
  );
}
