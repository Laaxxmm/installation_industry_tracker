import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { requireRole } from "@/server/rbac";
import { createVendor } from "@/server/actions/procurement";
import { PageHeader } from "@/components/sab";
import { VendorForm } from "../VendorForm";

export default async function NewVendorPage() {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  async function handle(raw: unknown) {
    "use server";
    await createVendor(raw);
    redirect("/procurement/vendors");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Procurement · New"
        title="Add a vendor"
        description="Register a supplier. GSTIN + state code are required to correctly apply IGST vs. CGST+SGST on POs."
      />
      <VendorForm onSubmit={handle} />
    </div>
  );
}
