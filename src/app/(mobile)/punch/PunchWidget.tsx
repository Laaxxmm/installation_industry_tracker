"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { punchIn, punchOut, switchProject } from "@/server/actions/time";

interface Props {
  openEntry: {
    id: string;
    projectCode: string;
    projectName: string;
    clockInIso: string;
  } | null;
  projects: Array<{ id: string; code: string; name: string }>;
}

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

const MAX_PHOTOS = 10;

export function PunchWidget({ openEntry, projects }: Props) {
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [elapsed, setElapsed] = useState<string>("—");
  const [photos, setPhotos] = useState<File[]>([]);
  const [note, setNote] = useState<string>("");
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

  useEffect(() => {
    if (!openEntry) return;
    const tick = () => {
      const start = new Date(openEntry.clockInIso).getTime();
      const mins = Math.floor((Date.now() - start) / 60000);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setElapsed(`${h}h ${m}m`);
    };
    tick();
    const i = setInterval(tick, 30000);
    return () => clearInterval(i);
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
    startTransition(async () => {
      const geo = await getGeo();
      try {
        await punchIn({ projectId, lat: geo?.lat ?? null, lng: geo?.lng ?? null });
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

  function doSwitch() {
    if (!projectId) return;
    startTransition(async () => {
      try {
        await switchProject(projectId);
        toast.success("Switched project");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Switch failed");
      }
    });
  }

  if (openEntry) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-accent/40 p-4 text-sm">
          <div>
            On <span className="font-mono">{openEntry.projectCode}</span>
          </div>
          <div className="text-muted-foreground">{openEntry.projectName}</div>
          <div className="mt-2 text-2xl font-semibold">{elapsed}</div>
        </div>

        <div className="space-y-2">
          <Label>Work photos (required)</Label>
          <p className="text-[11px] text-muted-foreground">
            Add at least one image of the completed work before punching out.
          </p>
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
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending || photos.length >= MAX_PHOTOS}
            className="w-full"
          >
            <Camera className="h-4 w-4" />
            {photos.length === 0
              ? "Add photo"
              : `Add another photo (${photos.length}/${MAX_PHOTOS})`}
          </Button>
          {photoPreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              {photoPreviews.map((p, i) => (
                <div
                  key={p.url}
                  className="group relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50"
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
                    className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed"
                    aria-label={`Remove ${p.file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="punchNote">Note (optional)</Label>
          <textarea
            id="punchNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Brief summary of work done"
            className="flex min-h-[60px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div className="space-y-1">
          <Button
            type="button"
            onClick={doPunchOut}
            disabled={pending}
            size="lg"
            className="w-full"
            aria-disabled={photos.length === 0}
          >
            {pending ? "Punching out…" : "Punch out"}
          </Button>
          {photos.length === 0 && !pending && (
            <p className="text-center text-[11px] text-amber-700">
              Add at least one photo above to enable punch out.
            </p>
          )}
        </div>

        <div className="pt-4 space-y-2 border-t">
          <Label htmlFor="switchProject">Switch to another project</Label>
          <Select
            id="switchProject"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </Select>
          <Button type="button" variant="outline" onClick={doSwitch} disabled={pending} className="w-full">
            Switch project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="projectPick">Project</Label>
        <Select
          id="projectPick"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </Select>
      </div>
      <Button
        type="button"
        onClick={doPunchIn}
        disabled={pending || !projectId}
        size="lg"
        className="w-full"
      >
        Punch in
      </Button>
    </div>
  );
}
