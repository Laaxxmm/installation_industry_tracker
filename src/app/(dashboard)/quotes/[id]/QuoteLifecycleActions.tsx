"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QuoteStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  acceptQuote,
  addQuoteNote,
  markQuoteLost,
  recordQuoteFeedback,
  reviseQuote,
  sendQuote,
} from "@/server/actions/quotes";
import { ConvertQuoteDialog } from "./ConvertQuoteDialog";

export function QuoteLifecycleActions({
  quoteId,
  status,
  canSend,
  canAccept,
  canConvert,
  canRevise,
}: {
  quoteId: string;
  status: QuoteStatus;
  canSend: boolean;
  canAccept: boolean;
  canConvert: boolean;
  canRevise: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [showFeedback, setShowFeedback] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<
    "ALTERATION_REQUESTED" | "CUSTOMIZATION_REQUESTED" | "NEGOTIATION"
  >("NEGOTIATION");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [noteText, setNoteText] = useState("");
  const [lostNote, setLostNote] = useState("");

  function run(action: () => Promise<unknown>, successMsg: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMsg);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canSend && (
          <Button
            size="sm"
            onClick={() => run(() => sendQuote(quoteId), "Quote sent")}
            disabled={pending}
          >
            {status === QuoteStatus.DRAFT ? "Send to client" : "Re-send"}
          </Button>
        )}

        {status !== QuoteStatus.DRAFT &&
          status !== QuoteStatus.CONVERTED &&
          status !== QuoteStatus.LOST && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFeedback((v) => !v)}
            >
              Record feedback
            </Button>
          )}

        {canAccept && (
          <Button
            size="sm"
            variant="success"
            onClick={() => run(() => acceptQuote(quoteId), "Quote accepted")}
            disabled={pending}
          >
            Accept
          </Button>
        )}

        {canConvert && (
          <Button
            size="sm"
            variant="success"
            onClick={() => setShowConvert(true)}
          >
            Convert to project
          </Button>
        )}

        {canRevise && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              run(async () => {
                const r = await reviseQuote(quoteId);
                router.push(`/quotes/${r.id}`);
              }, "Revision created")
            }
            disabled={pending}
          >
            Revise
          </Button>
        )}

        <Button size="sm" variant="ghost" onClick={() => setShowNote((v) => !v)}>
          Add note
        </Button>

        {status !== QuoteStatus.CONVERTED && status !== QuoteStatus.LOST && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowLost((v) => !v)}
          >
            Mark lost
          </Button>
        )}
      </div>

      {showFeedback && (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 grid gap-2 sm:grid-cols-[200px,1fr]">
            <Select
              value={feedbackKind}
              onChange={(e) =>
                setFeedbackKind(e.target.value as typeof feedbackKind)
              }
              className="h-8 text-[12px]"
            >
              <option value="ALTERATION_REQUESTED">Alteration requested</option>
              <option value="CUSTOMIZATION_REQUESTED">
                Customization requested
              </option>
              <option value="NEGOTIATION">Negotiation</option>
            </Select>
            <Textarea
              rows={2}
              placeholder="What did the client ask for?"
              value={feedbackNote}
              onChange={(e) => setFeedbackNote(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowFeedback(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                run(
                  () =>
                    recordQuoteFeedback(
                      quoteId,
                      feedbackKind,
                      feedbackNote || feedbackKind,
                    ),
                  "Feedback logged",
                )
              }
              disabled={pending}
            >
              Log feedback
            </Button>
          </div>
        </div>
      )}

      {showNote && (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <Textarea
            rows={2}
            placeholder="Internal note (not shown to client)"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowNote(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                run(() => addQuoteNote(quoteId, noteText), "Note added")
              }
              disabled={pending || !noteText.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      )}

      {showLost && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
          <Textarea
            rows={2}
            placeholder="Reason for loss (optional)"
            value={lostNote}
            onChange={(e) => setLostNote(e.target.value)}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowLost(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                run(
                  () => markQuoteLost(quoteId, lostNote || undefined),
                  "Marked lost",
                )
              }
              disabled={pending}
            >
              Confirm lost
            </Button>
          </div>
        </div>
      )}

      {showConvert && (
        <ConvertQuoteDialog
          quoteId={quoteId}
          onClose={() => setShowConvert(false)}
        />
      )}
    </>
  );
}
