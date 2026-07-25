import { create } from "zustand";
import { persist } from "zustand/middleware";
import Cookies from "js-cookie";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  gymId: string;
  roles: string[];
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setSession: (session: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  clearSession: () => void;
}

// A lightweight non-sensitive cookie flag lets the edge middleware gate
// /dashboard routes without exposing the real tokens outside localStorage.
const SESSION_FLAG_COOKIE = "rf_session";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ accessToken, refreshToken, user }) => {
        Cookies.set(SESSION_FLAG_COOKIE, "1", { sameSite: "lax", expires: 7 });
        set({ accessToken, refreshToken, user });
      },
      clearSession: () => {
        Cookies.remove(SESSION_FLAG_COOKIE);
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    { name: "rfitness-auth" },
  ),
);
