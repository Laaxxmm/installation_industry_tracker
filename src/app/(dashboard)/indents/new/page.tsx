import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { NewIndentForm } from "./NewIndentForm";

export default async function NewIndentPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  const sp = await searchParams;
  const preselectedProjectId = sp.projectId?.trim() || null;

  // Fetch lightweight lists for the form pickers. Materials capped to
  // active set so the dropdown isn't bloated by archived SKUs.
  const [projects, materials] = await Promise.all([
    db.project.findMany({
      where: { status: { in: ["DRAFT", "ACTIVE"] } },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
      take: 500,
    }),
    db.material.findMany({
      where: { active: true },
      select: { id: true, sku: true, name: true, unit: true, onHandQty: true, avgUnitCost: true },
      orderBy: { sku: "asc" },
      take: 2000,
    }),
  ]);

  if (preselectedProjectId && !projects.some((p) => p.id === preselectedProjectId)) {
    // Stale projectId in URL → drop it.
    redirect("/indents/new");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="New material indent"
        description="Request materials from the store. In-budget items auto-approve; over-budget needs ADMIN sign-off."
      />
      <Card>
        <CardContent>
          <NewIndentForm
            projects={projects.map((p) => ({
              id: p.id,
              code: p.code,
              name: p.name,
            }))}
            materials={materials.map((m) => ({
              id: m.id,
              sku: m.sku,
              name: m.name,
              unit: m.unit,
              onHandQty: m.onHandQty.toString(),
              avgUnitCost: m.avgUnitCost.toString(),
            }))}
            preselectedProjectId={preselectedProjectId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
