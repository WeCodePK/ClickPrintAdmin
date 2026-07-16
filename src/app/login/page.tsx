"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PhoneLoginForm } from "@/components/phone-login-form";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const { token, isReady, isAdmin, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (token && isAdmin) {
      router.replace("/");
      return;
    }
    if (token && !isAdmin) {
      logout();
    }
  }, [isReady, token, isAdmin, router, logout]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <PhoneLoginForm />
    </div>
  );
}
