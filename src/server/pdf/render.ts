import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import type { ReactElement } from "react";

export async function pdfResponse(
  element: ReactElement<DocumentProps>,
  filename: string,
  disposition: "inline" | "attachment" = "inline",
): Promise<NextResponse> {
  const buffer = await renderToBuffer(element);
  return new NextResponse(buffer as unknown as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
