import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { createVendorBill } from "@/server/actions/procurement";
import { PageHeader, Notice } from "@/components/sab";
import { VendorBillForm } from "../VendorBillForm";

export default async function NewVendorBillPage({
  searchParams,
}: {
  searchParams: Promise<{ vendorId?: string; poId?: string }>;
}) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const sp = await searchParams;

  const [vendors, openPOs] = await Promise.all([
    db.vendor.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, paymentTerms: true },
    }),
    db.vendor.findMany({
      where: { active: true },
      select: {
        id: true,
        purchaseOrders: {
          where: {
            status: {
              in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED", "RECEIVED"],
            },
          },
          orderBy: { issueDate: "desc" },
          select: { id: true, poNo: true, grandTotal: true },
        },
      },
    }),
  ]);

  const posByVendor: Record<
    string,
    { id: string; poNo: string; grandTotal: string }[]
  > = {};
  for (const v of openPOs) {
    posByVendor[v.id] = v.purchaseOrders.map((p) => ({
      id: p.id,
      poNo: p.poNo,
      grandTotal: String(p.grandTotal),
    }));
  }

  async function handle(raw: unknown) {
    "use server";
    const bill = await createVendorBill(raw);
    redirect(`/procurement/vendor-bills/${bill.id}`);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Procurement · New"
        title="Enter vendor bill"
        description="Optionally link to a PO for three-way matching. Matched bills route to approval once totals reconcile."
      />
      {vendors.length === 0 ? (
        <Notice tone="alert">
          No active vendors yet. Add a vendor before entering a bill.
        </Notice>
      ) : (
        <VendorBillForm
          vendors={vendors}
          posByVendor={posByVendor}
          initialVendorId={sp.vendorId}
          initialPoId={sp.poId}
          onSubmit={handle}
        />
      )}
    </div>
  );
}
