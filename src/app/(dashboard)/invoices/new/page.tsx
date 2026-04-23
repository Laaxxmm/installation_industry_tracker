import { InvoiceStatus, Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { sabStateCode } from "@/lib/org";
import { NewInvoiceForm } from "./NewInvoiceForm";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const { project: preselectedProjectId } = await searchParams;

  // Run both lookups in parallel — projects + billed-so-far rollups are independent.
  const [projects, billed] = await Promise.all([
    db.project.findMany({
      where: { clientId: { not: null }, status: { in: ["ACTIVE", "DRAFT", "ON_HOLD"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        name: true,
        client: {
          select: { id: true, name: true, stateCode: true },
        },
        purchaseOrder: { select: { amount: true } },
      },
    }),
    db.clientInvoice.groupBy({
      by: ["projectId"],
      _sum: { grandTotal: true },
      where: {
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] },
      },
    }),
  ]);
  const billedByProject = new Map(
    billed.map((b) => [b.projectId, b._sum.grandTotal?.toString() ?? "0"]),
  );

  const projectOptions = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    client: p.client,
    purchaseOrder: p.purchaseOrder
      ? { amount: p.purchaseOrder.amount.toString() }
      : null,
    billedSoFar: billedByProject.get(p.id) ?? "0",
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Billing"
        title="New tax invoice"
        description="Create a GST-compliant draft. Assigns a sequence invoice number only on issue."
      />
      {projectOptions.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-[13px] text-slate-600 shadow-card">
          No projects with a linked client. Convert a quote first, or attach a
          Client to an existing project.
        </div>
      ) : (
        <NewInvoiceForm
          projects={projectOptions}
          supplierStateCode={sabStateCode()}
          preselectedProjectId={preselectedProjectId}
        />
      )}
    </div>
  );
}
