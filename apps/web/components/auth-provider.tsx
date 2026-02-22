"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: string, phoneNumber?: string) => Promise<void>;
  logout: () => void;
  setTokenFromOAuth: (token: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  setTokenFromOAuth: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = ["/", "/login", "/register", "/verify", "/terms", "/privacy"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // On mount, check for stored token and fetch user
  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (stored) {
      setToken(stored);
      apiFetch<{ data: AuthUser }>("/auth/me", { token: stored })
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem("token");
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Redirect unverified users to /verify
  useEffect(() => {
    if (loading) return;
    if (user && !user.emailVerified && !PUBLIC_PATHS.includes(pathname)) {
      router.push("/verify");
    }
  }, [user, loading, pathname, router]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ data: { user: AuthUser; token: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, role: string, phoneNumber?: string) => {
    const payload: Record<string, string> = { email, password, name, role };
    if (phoneNumber) payload.phoneNumber = phoneNumber;
    const res = await apiFetch<{ data: { user: AuthUser; token: string } }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    localStorage.setItem("token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  const setTokenFromOAuth = useCallback((oauthToken: string) => {
    localStorage.setItem("token", oauthToken);
    setToken(oauthToken);
    apiFetch<{ data: AuthUser }>("/auth/me", { token: oauthToken })
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("token");
        setToken(null);
      });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, setTokenFromOAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
