"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({
  callbackUrl,
  error,
}: {
  callbackUrl?: string;
  error?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(error ?? null);
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    startTransition(async () => {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: callbackUrl ?? "/",
      });
      if (!res || res.error) {
        setLocalError("Invalid email or password");
        toast.error("Invalid email or password");
        return;
      }
      router.push(callbackUrl ?? "/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label
          htmlFor="email"
          className="text-[11px] font-semibold uppercase tracking-wider text-slate-600"
        >
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="you@sabindia.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label
          htmlFor="password"
          className="text-[11px] font-semibold uppercase tracking-wider text-slate-600"
        >
          Password
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {localError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{localError}</span>
        </div>
      )}
      <Button type="submit" className="w-full" disabled={pending} size="lg">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
