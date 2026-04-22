import { NextResponse } from "next/server";
import { QuoteEventKind } from "@prisma/client";
import { db } from "@/server/db";
import { QuoteDocument } from "@/server/pdf/quote-pdf";
import { pdfResponse } from "@/server/pdf/render";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;

  const quote = await db.quote.findUnique({
    where: { shareToken: token },
    include: {
      client: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Rate-limited CLIENT_VIEWED event: at most one per day per token.
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const recent = await db.quoteEvent.findFirst({
    where: {
      quoteId: quote.id,
      kind: QuoteEventKind.CLIENT_VIEWED,
      at: { gte: dayAgo },
    },
    select: { id: true },
  });
  if (!recent) {
    await db.quoteEvent.create({
      data: {
        quoteId: quote.id,
        kind: QuoteEventKind.CLIENT_VIEWED,
        note: "PDF downloaded via public link",
      },
    });
  }

  return pdfResponse(<QuoteDocument quote={quote} />, `${quote.quoteNo}.pdf`);
}
