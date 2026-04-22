import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { TaxInvoiceDocument } from "@/server/pdf/invoice-pdf";
import { pdfResponse } from "@/server/pdf/render";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;

  const invoice = await db.clientInvoice.findUnique({
    where: { shareToken: token },
    include: {
      client: true,
      project: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return pdfResponse(
    <TaxInvoiceDocument invoice={invoice} />,
    `${invoice.invoiceNo}.pdf`,
  );
}
