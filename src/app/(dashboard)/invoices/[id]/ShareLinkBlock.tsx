"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, RefreshCcw, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { rotateInvoiceShareToken } from "@/server/actions/client-invoices";

export function ShareLinkBlock({
  invoiceId,
  shareToken,
}: {
  invoiceId: string;
  shareToken: string;
}) {
  const [token, setToken] = useState(shareToken);
  const [isPending, startTransition] = useTransition();

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/i/${token}`
      : `/i/${token}`;

  const copy = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link copied");
  };

  const rotate = () => {
    if (
      !confirm(
        "Rotate share link? The existing link will stop working immediately.",
      )
    )
      return;
    startTransition(async () => {
      try {
        const result = await rotateInvoiceShareToken(invoiceId);
        setToken(result.shareToken);
        toast.success("New link generated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Rotate failed");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share link</CardTitle>
        <CardDescription>
          Read-only public link. Anyone with the URL can download the PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700">
          /i/{token.slice(0, 16)}…
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={copy} className="flex-1">
            <Copy className="h-3.5 w-3.5" /> Copy link
          </Button>
          <a href={`/i/${token}`} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </a>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={rotate}
          disabled={isPending}
          className="w-full"
        >
          <RefreshCcw className="h-3.5 w-3.5" /> Rotate link
        </Button>
      </CardContent>
    </Card>
  );
}
