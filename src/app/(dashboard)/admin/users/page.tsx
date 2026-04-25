import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { NewUserForm } from "./NewUserForm";
import { UserActions } from "./UserActions";
import { EditUserButton } from "./EditUserButton";

const ROLE_STYLES: Record<string, string> = {
  ADMIN: "bg-brand/10 text-brand border-brand/30",
  MANAGER: "bg-indigo-50 text-indigo-700 border-indigo-200",
  SUPERVISOR: "bg-amber-50 text-amber-700 border-amber-200",
  EMPLOYEE: "bg-slate-100 text-slate-700 border-slate-300",
};

export default async function AdminUsersPage() {
  await requireRole([Role.ADMIN]);

  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });

  const active = users.filter((u) => u.active).length;
  const byRole = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Manage staff accounts and their roles."
      />

      <div className="mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={users.length}
          sub={`${active} active`}
        />
        <StatCard
          label="Admins"
          value={byRole.ADMIN ?? 0}
          sub="Full access"
        />
        <StatCard
          label="Managers"
          value={byRole.MANAGER ?? 0}
          sub="Finance & projects"
        />
        <StatCard
          label="Field staff"
          value={(byRole.SUPERVISOR ?? 0) + (byRole.EMPLOYEE ?? 0)}
          sub={`${byRole.SUPERVISOR ?? 0} supervisors · ${byRole.EMPLOYEE ?? 0} employees`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Directory</CardTitle>
            <CardDescription>{users.length} users registered</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2.5">Name</th>
                  <th className="px-2 py-2.5">Email</th>
                  <th className="px-2 py-2.5">Role</th>
                  <th className="px-2 py-2.5">Type</th>
                  <th className="px-2 py-2.5">Status</th>
                  <th className="px-5 py-2.5 text-right" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-2.5 text-slate-900">{u.name}</td>
                    <td className="px-2 py-2.5 text-[12px] text-slate-600">
                      {u.email}
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className={
                          "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                          (ROLE_STYLES[u.role] ?? ROLE_STYLES.EMPLOYEE)
                        }
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-[12px] text-slate-600">
                      {u.employmentType ?? "—"}
                    </td>
                    <td className="px-2 py-2.5">
                      {u.active ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <EditUserButton
                          user={{
                            id: u.id,
                            email: u.email,
                            name: u.name,
                            role: u.role,
                            employmentType: u.employmentType,
                          }}
                        />
                        <UserActions userId={u.id} active={u.active} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add user</CardTitle>
            <CardDescription>Creates with temporary password.</CardDescription>
          </CardHeader>
          <CardContent>
            <NewUserForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
