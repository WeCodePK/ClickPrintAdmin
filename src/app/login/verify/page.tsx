"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { OtpVerifyForm } from "@/components/otp-verify-form";
import { useAuth } from "@/components/auth-provider";

function VerifyContent() {
  const { token, isReady, isAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const number = searchParams.get("number") ?? undefined;

  useEffect(() => {
    if (isReady && token && isAdmin) {
      router.replace("/");
    }
  }, [isReady, token, isAdmin, router]);

  return <OtpVerifyForm initialNumber={number} />;
}

export default function VerifyLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Suspense
        fallback={
          <div className="text-sm text-muted">Loading verification…</div>
        }
      >
        <VerifyContent />
      </Suspense>
    </div>
  );
}
