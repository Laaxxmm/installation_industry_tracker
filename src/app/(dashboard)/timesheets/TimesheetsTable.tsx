"use client";

import { useState } from "react";
import Link from "next/link";
import { Image as ImageIcon } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Dialog } from "@/components/ui/dialog";
import { formatIST } from "@/lib/time";
import { ApprovalActions } from "./ApprovalActions";

export type TimesheetEntry = {
  id: string;
  clockInIso: string;
  clockOutIso: string | null;
  minutes: number | null;
  status: string;
  employeeName: string;
  projectCode: string;
  projectName: string;
  note: string | null;
  photoUrls: string[];
};

export function TimesheetsTable({
  entries,
  canDelete = false,
}: {
  entries: TimesheetEntry[];
  canDelete?: boolean;
}) {
  const [selected, setSelected] = useState<TimesheetEntry | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-2.5">Employee</th>
              <th className="px-2 py-2.5">Project</th>
              <th className="px-2 py-2.5">In</th>
              <th className="px-2 py-2.5">Out</th>
              <th className="px-2 py-2.5 text-right">Mins</th>
              <th className="px-2 py-2.5">Photos</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-5 py-2.5 text-right" />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-10 text-center text-[13px] text-slate-500"
                >
                  Nothing to approve. All caught up.
                </td>
              </tr>
            )}
            {entries.map((e) => {
              const clockIn = new Date(e.clockInIso);
              const clockOut = e.clockOutIso ? new Date(e.clockOutIso) : null;
              const hasPhotos = e.photoUrls.length > 0;
              const firstThree = e.photoUrls.slice(0, 3);
              const more = Math.max(0, e.photoUrls.length - firstThree.length);
              return (
                <tr
                  key={e.id}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  onClick={() => setSelected(e)}
                >
                  <td className="px-5 py-2.5 text-slate-900">{e.employeeName}</td>
                  <td className="px-2 py-2.5 font-mono text-[11px] text-brand">
                    {e.projectCode}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-[11px] text-slate-600">
                    {formatIST(clockIn, "dd MMM HH:mm")}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-[11px] text-slate-600">
                    {clockOut ? formatIST(clockOut, "dd MMM HH:mm") : "—"}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-800">
                    {e.minutes ?? "—"}
                  </td>
                  <td className="px-2 py-2.5">
                    {hasPhotos ? (
                      <div className="flex items-center gap-1">
                        {firstThree.map((url) => (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            key={url}
                            src={url}
                            alt=""
                            className="h-8 w-8 rounded border border-slate-200 object-cover"
                          />
                        ))}
                        {more > 0 && (
                          <span className="inline-flex h-8 min-w-[28px] items-center justify-center rounded border border-slate-200 bg-slate-50 px-1 text-[10px] font-semibold text-slate-600">
                            +{more}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <ImageIcon className="h-3 w-3" />
                        None
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <StatusBadge status={e.status} />
                  </td>
                  <td
                    className="px-5 py-2.5 text-right"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <ApprovalActions
                      entryId={e.id}
                      status={e.status}
                      canDelete={canDelete}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        title={selected ? `${selected.employeeName} · ${selected.projectCode}` : undefined}
        description={
          selected
            ? `${formatIST(new Date(selected.clockInIso), "dd MMM HH:mm")} → ${
                selected.clockOutIso
                  ? formatIST(new Date(selected.clockOutIso), "dd MMM HH:mm")
                  : "—"
              } · ${selected.minutes ?? "—"} min`
            : undefined
        }
        className="max-w-3xl"
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[12px]">
              <div className="text-slate-600">
                Project:{" "}
                <Link
                  href={`/projects?code=${encodeURIComponent(selected.projectCode)}`}
                  className="font-mono text-brand hover:underline"
                >
                  {selected.projectCode}
                </Link>
                <span className="ml-2 text-slate-500">{selected.projectName}</span>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            {selected.note && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Note
                </div>
                <div className="mt-1 whitespace-pre-wrap">{selected.note}</div>
              </div>
            )}

            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Work photos ({selected.photoUrls.length})
              </div>
              {selected.photoUrls.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-[12px] text-slate-500">
                  No photos attached.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {selected.photoUrls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-md border border-slate-200 bg-slate-50 transition hover:border-brand/40 hover:shadow"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-40 w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 pt-3">
              <ApprovalActions
                entryId={selected.id}
                status={selected.status}
                canDelete={canDelete}
              />
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
