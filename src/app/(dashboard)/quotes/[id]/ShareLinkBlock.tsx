"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rotateQuoteShareToken } from "@/server/actions/quotes";

export function ShareLinkBlock({
  quoteId,
  shareToken,
  canSend,
  sent,
}: {
  quoteId: string;
  shareToken: string;
  canSend: boolean;
  sent: boolean;
}) {
  const [token, setToken] = useState(shareToken);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const url =
    typeof window === "undefined"
      ? `/q/${token}`
      : `${window.location.origin}/q/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  function rotate() {
    startTransition(async () => {
      try {
        const t = await rotateQuoteShareToken(quoteId);
        setToken(t);
        toast.success("New link generated · old link invalidated");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  if (!sent && canSend) {
    return (
      <p className="text-[12px] text-slate-600">
        Share link becomes active once you send the quote.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] font-mono text-slate-800 break-all">
        {url}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={copy}>
          <Copy className="h-3.5 w-3.5" /> Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={rotate} disabled={pending}>
          <RotateCcw className="h-3.5 w-3.5" /> Rotate
        </Button>
      </div>
      <p className="text-[11px] text-slate-500">
        Rotating invalidates the old URL immediately.
      </p>
    </div>
  );
}
