"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizePhoneNumber } from "@/lib/auth-utils";

const PENDING_NUMBER_KEY = "admin_otp_number";

export function getPendingOtpNumber() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(PENDING_NUMBER_KEY) ?? "";
}

export function clearPendingOtpNumber() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_NUMBER_KEY);
}

export function PhoneLoginForm() {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const normalized = normalizePhoneNumber(number);

    try {
      const response = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor: "user",
          number: normalized,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
        normalizedNumber?: string;
      };

      if (!response.ok || data.success === false) {
        setError(data.error || data.message || "Failed to send OTP");
        return;
      }

      const savedNumber = data.normalizedNumber || normalized;
      sessionStorage.setItem(PENDING_NUMBER_KEY, savedNumber);
      router.push(`/login/verify?number=${encodeURIComponent(savedNumber)}`);
    } catch {
      setError("Network error while requesting OTP");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-[0_1px_0_rgba(21,32,25,0.04)]"
    >
      <div className="mb-8">
        <p className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          ClickPrint
        </p>
        <p className="mt-2 text-sm text-muted">
          Enter your phone number to receive an OTP
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Phone number</span>
        <input
          className={inputClass}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="923235400291"
          inputMode="tel"
          autoComplete="tel"
          required
        />
        <span className="mt-1.5 block text-xs text-muted">
          Local numbers like 0323… are converted to 92…
        </span>
      </label>

      {error ? (
        <p className="mt-4 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Sending OTP…" : "Continue"}
      </button>
    </form>
  );
}
