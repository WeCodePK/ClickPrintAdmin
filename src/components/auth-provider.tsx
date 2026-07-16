"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getIsAdminFromToken } from "@/lib/auth-utils";
import type { AuthProfile, AuthSession, Shop } from "@/lib/types";

const SESSION_KEY = "admin_auth_session";

type AuthState = {
  token: string | null;
  user: AuthProfile | null;
  shop: Shop | null;
  isAdmin: boolean;
  isReady: boolean;
  login: (session: AuthSession) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthProfile | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;

      const session = JSON.parse(raw) as AuthSession;
      if (!session?.token || !session?.profile?._id) return;

      setToken(session.token);
      setUser(session.profile);
      setShop(session.shop ?? null);
      setIsAdmin(
        typeof session.isAdmin === "boolean"
          ? session.isAdmin
          : getIsAdminFromToken(session.token),
      );
    } catch {
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setIsReady(true);
    }
  }, []);

  const login = useCallback((session: AuthSession) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setToken(session.token);
    setUser(session.profile);
    setShop(session.shop ?? null);
    setIsAdmin(session.isAdmin);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setToken(null);
    setUser(null);
    setShop(null);
    setIsAdmin(false);
  }, []);

  const value = useMemo(
    () => ({ token, user, shop, isAdmin, isReady, login, logout }),
    [token, user, shop, isAdmin, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
