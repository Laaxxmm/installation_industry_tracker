"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

// Styled with SAB tokens to match the mobile shell. Inputs use sab-rule
// borders with an orange focus ring; the submit button is the signal orange
// used for punch + submit-for-approval elsewhere.

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

  const inputClass =
    "block w-full rounded-[8px] border border-sab-rule bg-sab-card px-3 py-[10px] " +
    "font-sab-sans text-[14px] text-sab-ink placeholder:text-sab-ink-4 " +
    "outline-none transition " +
    "focus:border-sab-accent focus:ring-2 focus:ring-sab-accent/20";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-[6px]">
        <label htmlFor="email" className="sab-eyebrow block">
          Email
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@sabindia.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="space-y-[6px]">
        <label htmlFor="password" className="sab-eyebrow block">
          Password
        </label>
        <input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      {localError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[8px] border border-sab-alert/25 bg-sab-alert-wash px-3 py-2 font-sab-sans text-[12.5px] text-sab-alert"
        >
          <AlertCircle className="mt-[2px] h-[14px] w-[14px] flex-shrink-0" />
          <span>{localError}</span>
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center rounded-[10px] bg-sab-accent font-sab-sans text-[14px] font-semibold tracking-[-0.005em] text-white transition hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
