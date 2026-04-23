import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { createVendorPO } from "@/server/actions/procurement";
import { PageHeader, Notice } from "@/components/sab";
import { VendorPOForm } from "../VendorPOForm";

export default async function NewVendorPOPage() {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  const [vendors, projects] = await Promise.all([
    db.vendor.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, category: true, msme: true, paymentTerms: true },
    }),
    db.project.findMany({
      orderBy: { startDate: "desc" },
      take: 100,
      select: { id: true, code: true, name: true },
    }),
  ]);

  async function handle(raw: unknown) {
    "use server";
    const po = await createVendorPO(raw);
    redirect(`/procurement/purchase-orders/${po.id}`);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Procurement · New"
        title="Raise a purchase order"
        description="Add line items; approval tier is set by total value. ≤ ₹1L auto-approves, ≤ ₹10L needs PM, > ₹10L needs director."
      />
      {vendors.length === 0 ? (
        <Notice tone="alert">
          No active vendors on file. Add one before raising a PO.
        </Notice>
      ) : (
        <VendorPOForm vendors={vendors} projects={projects} onSubmit={handle} />
      )}
    </div>
  );
}
