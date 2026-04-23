import { Fragment } from "react";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { formatINR } from "@/lib/money";
import { formatIST } from "@/lib/time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { NewRateForm } from "./NewRateForm";

export default async function AdminRatesPage() {
  await requireRole([Role.ADMIN]);

  const employees = await db.user.findMany({
    where: { role: "EMPLOYEE" },
    include: { rateCards: { orderBy: { effectiveFrom: "desc" } } },
    orderBy: { name: "asc" },
  });

  const totalCards = employees.reduce((s, e) => s + e.rateCards.length, 0);
  const hourlyCount = employees.filter(
    (e) => e.employmentType === "HOURLY",
  ).length;
  const salariedCount = employees.filter(
    (e) => e.employmentType === "SALARIED",
  ).length;
  const withoutCard = employees.filter((e) => e.rateCards.length === 0).length;

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Rate cards"
        description="Employee pay rates. New entries close the previous open rate automatically."
      />

      <div className="mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Employees"
          value={employees.length}
          sub={`${hourlyCount} hourly · ${salariedCount} salaried`}
        />
        <StatCard
          label="Rate cards on file"
          value={totalCards}
          sub="Includes historical"
        />
        <StatCard
          label="Missing cards"
          value={withoutCard}
          deltaDirection={withoutCard > 0 ? "down" : "up"}
          delta={withoutCard > 0 ? "Action" : "All set"}
          sub="Cannot compute labor"
        />
        <StatCard
          label="Unassigned type"
          value={employees.filter((e) => !e.employmentType).length}
          sub="Set before rates"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Rate history</CardTitle>
            <CardDescription>
              Newest card first — open cards have no end date
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2.5">Employee</th>
                  <th className="px-2 py-2.5">Type</th>
                  <th className="px-2 py-2.5 text-right">Rate / salary</th>
                  <th className="px-2 py-2.5">Effective from</th>
                  <th className="px-5 py-2.5">Effective to</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-[12px] text-slate-500"
                    >
                      No employees yet.
                    </td>
                  </tr>
                )}
                {employees.map((e) => (
                  <Fragment key={e.id}>
                    {e.rateCards.length === 0 ? (
                      <tr className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-2.5 text-slate-900">{e.name}</td>
                        <td
                          colSpan={4}
                          className="px-2 py-2.5 text-[12px] italic text-slate-500"
                        >
                          No rate cards yet.
                        </td>
                      </tr>
                    ) : (
                      e.rateCards.map((c, idx) => {
                        const isOpen = !c.effectiveTo;
                        return (
                          <tr
                            key={c.id}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-2.5 text-slate-900">
                              {idx === 0 ? e.name : ""}
                            </td>
                            <td className="px-2 py-2.5">
                              <span
                                className={
                                  "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                                  (c.type === "HOURLY"
                                    ? "bg-sky-50 text-sky-700 border-sky-200"
                                    : "bg-indigo-50 text-indigo-700 border-indigo-200")
                                }
                              >
                                {c.type}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 text-right tabular-nums text-slate-900">
                              {c.type === "HOURLY"
                                ? `${formatINR(c.hourlyRate ?? 0)} / hr`
                                : `${formatINR(c.monthlySalary ?? 0)} / mo`}
                            </td>
                            <td className="px-2 py-2.5 font-mono text-[11px] text-slate-600">
                              {formatIST(c.effectiveFrom, "dd-MM-yyyy")}
                            </td>
                            <td className="px-5 py-2.5 font-mono text-[11px]">
                              {isOpen ? (
                                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Open
                                </span>
                              ) : (
                                <span className="text-slate-600">
                                  {formatIST(c.effectiveTo!, "dd-MM-yyyy")}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New rate card</CardTitle>
            <CardDescription>
              Closes any open card for the employee.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewRateForm
              employees={employees.map((e) => ({
                id: e.id,
                name: e.name,
                employmentType: e.employmentType,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
