"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/**
 * Client auth context for the self-hosted backend — the drop-in replacement for
 * Clerk's `useAuth`. On mount it probes `/api/auth/me` to learn whether a valid
 * session cookie exists; login/register call `refresh()` to re-read it, and
 * `signOut()` clears the cookie. Same `{ isLoaded, isSignedIn }` shape the
 * consumers already used, plus `user`, `refresh`, and `signOut`.
 */
export interface AuthUser {
  email: string;
}

export interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Probe the session. Pure async (no React state) so it's safe to await inside
 *  an effect before calling setState. */
async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as
      | { user?: AuthUser | null }
      | null;
    return data?.user ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    const next = await fetchMe();
    setUser(next);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchMe();
      if (!cancelled) {
        setUser(next);
        setIsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    } catch {
      // ignore — clear local state regardless
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isLoaded, isSignedIn: !!user, user, refresh, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Read the auth state. Outside a provider (auth disabled) it reports a loaded,
 *  signed-out state so consumers render safely without crashing. */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      isLoaded: true,
      isSignedIn: false,
      user: null,
      refresh: async () => {},
      signOut: async () => {},
    };
  }
  return ctx;
}
