"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/sab";

type PartLine = { sku: string; description: string; qty: string; unit: string };

type Props = {
  serviceIssueId: string;
  canStart: boolean;
  canResolve: boolean;
  onStart: (id: string) => Promise<unknown>;
  onLogVisit: (id: string, raw: unknown) => Promise<unknown>;
  onResolve: (id: string) => Promise<unknown>;
};

function newOpId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function MobileServiceVisitForm({
  serviceIssueId,
  canStart,
  canResolve,
  onStart,
  onLogVisit,
  onResolve,
}: Props) {
  const router = useRouter();
  const [workPerformed, setWorkPerformed] = useState("");
  const [findings, setFindings] = useState("");
  const [parts, setParts] = useState<PartLine[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [signatureUrl, setSignatureUrl] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [opId] = useState(() => newOpId());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Canvas signature state. For v1 this is a visual sign-off indicator on
  // the device; persistence happens via signatureUrl (pasted pre-signed URL
  // once the upload pipeline is wired in v2).
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  function captureGeo() {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError(err.message),
      { maximumAge: 60_000, timeout: 10_000, enableHighAccuracy: true },
    );
  }

  function addPart() {
    setParts((ps) => [...ps, { sku: "", description: "", qty: "1", unit: "nos" }]);
  }
  function updatePart(i: number, patch: Partial<PartLine>) {
    setParts((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function onPhotoInput(e: React.ChangeEvent<HTMLInputElement>) {
    const urls = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
    setPhotoUrls(urls);
  }

  // ---- Canvas signature ----
  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  }
  function startStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    c.setPointerCapture(e.pointerId);
  }
  function drawStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSignature) setHasSignature(true);
  }
  function endStroke() {
    drawingRef.current = false;
  }
  function clearSignature() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasSignature(false);
  }

  function start() {
    setError(null);
    startTransition(async () => {
      try {
        await onStart(serviceIssueId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start ticket");
      }
    });
  }

  function logVisit() {
    setError(null);
    const cleanedParts = parts.filter((p) => p.description.trim().length > 0);
    startTransition(async () => {
      try {
        await onLogVisit(serviceIssueId, {
          findings: findings.trim() || undefined,
          workPerformed: workPerformed.trim() || undefined,
          partsUsed: cleanedParts.length > 0 ? cleanedParts : undefined,
          photoUrls,
          signatureUrl: signatureUrl.trim() || undefined,
          geoLat: geo?.lat,
          geoLng: geo?.lng,
          arrivedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          offlineClientOpId: opId,
        });
        setWorkPerformed("");
        setFindings("");
        setParts([]);
        setPhotoUrls([]);
        setSignatureUrl("");
        clearSignature();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not log visit");
      }
    });
  }

  function resolve() {
    setError(null);
    startTransition(async () => {
      try {
        await onResolve(serviceIssueId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not resolve ticket");
      }
    });
  }

  return (
    <div className="grid gap-3">
      {error && <Notice tone="alert">{error}</Notice>}

      {canStart && (
        <div>
          <Button disabled={pending} onClick={start} className="w-full">
            Start (arrived on-site)
          </Button>
        </div>
      )}

      <section>
        <Label>Work performed</Label>
        <Textarea
          rows={2}
          value={workPerformed}
          onChange={(e) => setWorkPerformed(e.target.value)}
        />
      </section>

      <section>
        <Label>Findings</Label>
        <Textarea
          rows={2}
          value={findings}
          onChange={(e) => setFindings(e.target.value)}
        />
      </section>

      <section>
        <Label>Parts used</Label>
        <div className="grid gap-2">
          {parts.map((p, i) => (
            <div key={i} className="grid gap-1 grid-cols-[1fr_80px_60px]">
              <Input
                placeholder="Description"
                value={p.description}
                onChange={(e) => updatePart(i, { description: e.target.value })}
              />
              <Input
                placeholder="SKU"
                value={p.sku}
                onChange={(e) => updatePart(i, { sku: e.target.value })}
              />
              <Input
                placeholder="Qty"
                value={p.qty}
                onChange={(e) => updatePart(i, { qty: e.target.value })}
              />
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" className="mt-1" onClick={addPart}>
          + Part
        </Button>
      </section>

      <section>
        <Label>Photos (comma-separated URLs)</Label>
        <Input placeholder="https://… , https://…" onChange={onPhotoInput} />
      </section>

      <section className="grid gap-2">
        <Button variant="outline" onClick={captureGeo} className="w-full">
          {geo ? `Geo captured: ${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}` : "Capture location"}
        </Button>
      </section>

      <section>
        <Label>Client signature</Label>
        <div
          className="rounded border"
          style={{ borderColor: "hsl(var(--border))", background: "#fff" }}
        >
          <canvas
            ref={canvasRef}
            width={600}
            height={160}
            className="w-full touch-none"
            style={{ height: 120, display: "block" }}
            onPointerDown={startStroke}
            onPointerMove={drawStroke}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            onPointerCancel={endStroke}
          />
        </div>
        <div className="flex gap-2 mt-1">
          <Button size="sm" variant="outline" onClick={clearSignature} disabled={!hasSignature}>
            Clear
          </Button>
          <div className="text-[11px] self-center" style={{ color: "var(--sab-ink3)" }}>
            {hasSignature ? "Signed on device" : "Ask the client to sign above"}
          </div>
        </div>
        <Label className="mt-2">Signature URL (optional, after upload)</Label>
        <Input
          placeholder="https://… (pasted pre-signed URL)"
          value={signatureUrl}
          onChange={(e) => setSignatureUrl(e.target.value)}
        />
      </section>

      <div>
        <Button disabled={pending} onClick={logVisit} className="w-full">
          {pending ? "Saving…" : "Log this visit"}
        </Button>
      </div>

      {canResolve && (
        <div>
          <Button
            disabled={pending}
            variant="outline"
            onClick={resolve}
            className="w-full"
          >
            Mark resolved
          </Button>
        </div>
      )}
    </div>
  );
}
