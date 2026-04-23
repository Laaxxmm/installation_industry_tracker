"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/sab/Icon";
import { Code } from "@/components/sab/Code";
import { punchIn, punchOut, switchProject } from "@/server/actions/time";

// Rebuild of the field-crew punch widget per the Claude-Design handoff.
// Two visual states: `ready` (warm paper, "Today's assignment") and
// `live` (dark ink, 56px mono timer). Functional scope unchanged from
// the prior widget — GPS, up to 10 photos, note, project switch — only
// the presentation layer is new.

interface OpenEntry {
  id: string;
  projectCode: string;
  projectName: string;
  clockInIso: string;
}

interface ProjectOption {
  id: string;
  code: string;
  name: string;
}

interface Props {
  openEntry: OpenEntry | null;
  projects: ProjectOption[];
}

const MAX_PHOTOS = 10;

async function getGeo(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function formatClockIn(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function PunchWidget({ openEntry, projects }: Props) {
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [elapsed, setElapsed] = useState<number>(0);
  const [photos, setPhotos] = useState<File[]>([]);
  const [note, setNote] = useState<string>("");
  const [showSwitch, setShowSwitch] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const photoPreviews = useMemo(
    () => photos.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [photos],
  );

  useEffect(() => {
    return () => {
      photoPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [photoPreviews]);

  // Live 1-second timer — design calls for HH:MM:SS, not HH:MM.
  useEffect(() => {
    if (!openEntry) return;
    const start = new Date(openEntry.clockInIso).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openEntry]);

  function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setPhotos((prev) => {
      const combined = [...prev, ...incoming];
      if (combined.length > MAX_PHOTOS) {
        toast.error(`Maximum ${MAX_PHOTOS} photos.`);
        return combined.slice(0, MAX_PHOTOS);
      }
      return combined;
    });
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function doPunchIn() {
    if (!projectId) {
      toast.error("Pick a project first.");
      return;
    }
    startTransition(async () => {
      const geo = await getGeo();
      try {
        await punchIn({
          projectId,
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
        });
        toast.success("Punched in");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Punch-in failed");
      }
    });
  }

  function doPunchOut() {
    if (!openEntry) return;
    if (photos.length === 0) {
      toast.error("Please add at least one photo of the work done.");
      return;
    }
    startTransition(async () => {
      const geo = await getGeo();
      const fd = new FormData();
      fd.append("entryId", openEntry.id);
      if (geo) {
        fd.append("lat", String(geo.lat));
        fd.append("lng", String(geo.lng));
      }
      if (note.trim()) fd.append("note", note.trim());
      photos.forEach((f) => fd.append("photos", f, f.name));
      try {
        await punchOut(fd);
        toast.success("Punched out");
        setPhotos([]);
        setNote("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Punch-out failed");
      }
    });
  }

  function doSwitch(targetId: string) {
    if (!targetId) return;
    startTransition(async () => {
      try {
        await switchProject(targetId);
        toast.success("Switched project");
        setShowSwitch(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Switch failed");
      }
    });
  }

  // ── LIVE (punched-in) ───────────────────────────────────────────
  if (openEntry) {
    return (
      <div className="space-y-4 px-4">
        {/* Hero card — elapsed timer + project sub-card */}
        <div className="rounded-[14px] border border-white/12 bg-white/[0.06] p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="sab-eyebrow inline-flex items-center gap-[6px] text-white/55">
              <span className="sab-pulse h-[7px] w-[7px] rounded-full bg-sab-accent" />
              Elapsed
            </span>
            <span className="font-sab-mono text-[11px] text-white/60">
              in @ {formatClockIn(openEntry.clockInIso)}
            </span>
          </div>
          <div className="sab-tabular font-sab-mono text-[56px] font-medium leading-none tracking-[-0.03em]">
            {formatElapsed(elapsed)}
          </div>

          <div className="mt-[18px] rounded-lg bg-white/[0.08] px-[14px] py-3">
            <div className="sab-eyebrow text-white/55">Project</div>
            <div className="mt-[6px] flex items-center gap-2">
              <span
                className="font-sab-mono text-[11px] font-medium text-sab-accent"
                style={{
                  background: "rgba(217,119,87,0.2)",
                  padding: "2px 6px",
                  borderRadius: 3,
                }}
              >
                {openEntry.projectCode}
              </span>
            </div>
            <div className="mt-[6px] text-[14px] font-medium tracking-[-0.01em]">
              {openEntry.projectName}
            </div>
            <div className="mt-[10px] flex gap-[14px] font-sab-mono text-[10.5px] text-white/65">
              <span className="inline-flex items-center gap-1">
                <Icon name="camera" size={11} /> {photos.length} photo
                {photos.length === 1 ? "" : "s"}
              </span>
              {projects.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowSwitch((v) => !v)}
                  className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                >
                  <Icon name="refresh" size={11} /> Switch
                </button>
              )}
            </div>
            {showSwitch && (
              <div className="mt-3 border-t border-white/10 pt-3">
                <label className="sab-eyebrow block text-white/55">
                  Switch to
                </label>
                <select
                  value=""
                  onChange={(e) => doSwitch(e.target.value)}
                  disabled={pending}
                  className="mt-2 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 font-sab-mono text-[12px] text-white focus:border-sab-accent focus:outline-none"
                >
                  <option value="" disabled>
                    Choose another project…
                  </option>
                  {projects
                    .filter((p) => p.code !== openEntry.projectCode)
                    .map((p) => (
                      <option key={p.id} value={p.id} className="bg-sab-ink">
                        {p.code} — {p.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={doPunchOut}
            disabled={pending}
            className="mt-[18px] flex w-full items-center justify-center gap-2 rounded-[10px] bg-sab-accent px-4 py-[14px] font-sab-sans text-[15px] font-semibold tracking-[-0.01em] text-white disabled:opacity-60"
          >
            <Icon name="x" size={16} />
            {pending ? "Punching out…" : "Punch out"}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending || photos.length >= MAX_PHOTOS}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-[10px] border border-white/18 bg-transparent px-4 py-[11px] font-sab-sans text-[13px] font-medium text-white disabled:opacity-60"
          >
            <Icon name="camera" size={14} />
            {photos.length === 0
              ? "Add progress photo (required)"
              : `Add another photo (${photos.length}/${MAX_PHOTOS})`}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              addPhotos(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Photo previews */}
        {photoPreviews.length > 0 && (
          <div className="grid grid-cols-4 gap-2 px-1">
            {photoPreviews.map((p, i) => (
              <div
                key={p.url}
                className="group relative aspect-square overflow-hidden rounded-md border border-white/10 bg-white/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.file.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  disabled={pending}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-80 disabled:opacity-40"
                  aria-label={`Remove ${p.file.name}`}
                >
                  <Icon name="x" size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Note (optional) */}
        <div className="rounded-[14px] border border-white/10 bg-white/[0.04] p-4">
          <label
            htmlFor="punchNote"
            className="sab-eyebrow block text-white/55"
          >
            Note (optional)
          </label>
          <textarea
            id="punchNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Brief summary of work done"
            className="mt-2 w-full resize-none rounded-md border border-white/10 bg-transparent p-2 font-sab-sans text-[13px] text-white placeholder:text-white/40 focus:border-sab-accent focus:outline-none"
          />
        </div>
      </div>
    );
  }

  // ── READY (off-the-clock) ───────────────────────────────────────
  const selectedProject = projects.find((p) => p.id === projectId);

  return (
    <div className="space-y-4 px-4">
      <div className="rounded-[14px] border border-sab-rule bg-sab-card p-5">
        <div className="sab-eyebrow">Today's assignment</div>

        {projects.length === 0 ? (
          <p className="mt-3 text-[13px] text-sab-ink-3">
            No active projects. Ask your supervisor to assign you.
          </p>
        ) : (
          <>
            <div className="mt-[10px]">
              <Code
                style={{
                  fontSize: 12,
                  padding: "3px 7px",
                  background: "oklch(0.965 0.022 55)",
                  borderRadius: 3,
                }}
              >
                {selectedProject?.code ?? "—"}
              </Code>
            </div>
            <div className="mt-2 text-[17px] font-semibold tracking-[-0.015em]">
              {selectedProject?.name ?? "Pick a project below"}
            </div>
            <div className="mt-1 text-[12.5px] text-sab-ink-3">
              {projects.length === 1
                ? "Sole active assignment"
                : `${projects.length} active assignments — change below`}
            </div>

            <div className="mt-[14px] flex items-center gap-2 rounded-md bg-sab-paper-alt px-3 py-[10px] font-sab-mono text-[11px] text-sab-ink-2">
              <Icon name="mapPin" size={12} className="text-sab-accent" />
              <span>GPS captured on tap — denial won't block the clock.</span>
            </div>

            <button
              type="button"
              onClick={doPunchIn}
              disabled={pending || !projectId}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] bg-sab-accent px-4 py-[15px] font-sab-sans text-[15px] font-semibold tracking-[-0.01em] text-white disabled:opacity-60"
            >
              <Icon name="check" size={17} />
              {pending ? "Punching in…" : "Punch in"}
            </button>

            {projects.length > 1 && (
              <div className="mt-4 border-t border-sab-rule pt-3">
                <label
                  htmlFor="projectPick"
                  className="sab-eyebrow block"
                >
                  Change project
                </label>
                <select
                  id="projectPick"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={pending}
                  className="mt-2 w-full rounded-md border border-sab-rule bg-white px-3 py-2 font-sab-mono text-[12px] text-sab-ink focus:border-sab-accent focus:outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
