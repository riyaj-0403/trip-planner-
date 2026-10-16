import { useCallback, useMemo, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";
import { clearSession, getToken, getUser, saveSession } from "../lib/authStorage";
import type { AuthResponse, AuthUser } from "../types";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start from whatever is already in sessionStorage so a refresh keeps you logged in.
  const [user, setUser] = useState<AuthUser | null>(() => (getToken() ? getUser() : null));

  const finish = useCallback((res: AuthResponse) => {
    const { token, ...rest } = res; const { tokenType, ...profile } = rest;
    saveSession(token, profile);
    setUser(profile);
    void tokenType; // avoid unused variable warning
  }, []);

  const login = useCallback(
    async (input: authApi.LoginInput) => finish(await authApi.login(input)),
    [finish]
  );
  const register = useCallback(
    async (input: authApi.RegisterInput) => finish(await authApi.register(input)),
    [finish]
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    // Full reload on purpose: wipes the trip-list cache in api/real.ts and any
    // leftover state, so the next person never sees the previous user's data.
    window.location.assign("/login");
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: user !== null, login, register, logout }),
    [user, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}