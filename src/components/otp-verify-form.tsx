"use client";

import { type FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import {
  clearPendingOtpNumber,
  getPendingOtpNumber,
} from "@/components/phone-login-form";
import { getIsAdminFromToken, normalizePhoneNumber } from "@/lib/auth-utils";
import type { AuthProfile, OtpVerifyResponse, Shop } from "@/lib/types";

export function OtpVerifyForm({ initialNumber }: { initialNumber?: string }) {
  const router = useRouter();
  const { login } = useAuth();

  const number = useMemo(() => {
    const fromQuery = initialNumber?.trim() ?? "";
    const fromSession = getPendingOtpNumber();
    return normalizePhoneNumber(fromQuery || fromSession);
  }, [initialNumber]);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleResend() {
    if (!number) return;
    setIsResending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: "user", number }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        setError(data.error || data.message || "Failed to resend OTP");
      }
    } catch {
      setError("Network error while resending OTP");
    } finally {
      setIsResending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!number) {
      setError("Phone number missing. Go back and enter your number.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          number,
        }),
      });

      const data = (await response.json()) as OtpVerifyResponse & {
        error?: string;
      };

      if (!response.ok || data.success === false) {
        setError(data.error || data.message || "OTP verification failed");
        return;
      }

      const token = data.data?.token;
      const profile = data.data?.profile as AuthProfile | undefined;
      const shop = (data.data?.shop as Shop | null | undefined) ?? null;

      if (!token || !profile?._id) {
        setError("Unexpected verify response from server");
        return;
      }

      const isAdmin = getIsAdminFromToken(token);
      if (!isAdmin) {
        setError("This account is not an admin. Access denied.");
        return;
      }

      login({ token, profile, shop, isAdmin });
      clearPendingOtpNumber();
      router.replace("/");
    } catch {
      setError("Network error while verifying OTP");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm tracking-[0.3em] outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-[0_1px_0_rgba(21,32,25,0.04)]"
    >
      <div className="mb-8">
        <p className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Enter OTP
        </p>
        <p className="mt-2 text-sm text-muted">
          We sent a code to{" "}
          <span className="font-medium text-foreground">
            {number || "your number"}
          </span>
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium">OTP code</span>
        <input
          className={inputClass}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="00000"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
        />
      </label>

      {error ? (
        <p className="mt-4 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || !number}
        className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Verifying…" : "Verify & continue"}
      </button>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <Link href="/login" className="text-muted hover:text-foreground">
          ← Change number
        </Link>
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending || !number}
          className="text-accent hover:underline disabled:opacity-60"
        >
          {isResending ? "Resending…" : "Resend OTP"}
        </button>
      </div>
    </form>
  );
}
