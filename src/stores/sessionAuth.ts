import { create } from "zustand";

const AUTH_STORAGE_KEY = "hoomaan.auth.v1";

interface PersistedSession {
  userName: string;
  isGuest: boolean;
}

function readStoredSession(): PersistedSession | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (typeof parsed.userName !== "string" || !parsed.userName.trim()) return null;
    return { userName: parsed.userName.trim(), isGuest: Boolean(parsed.isGuest) };
  } catch {
    return null;
  }
}

function writeStoredSession(session: PersistedSession | null): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    if (!session) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Session remains in memory when storage is blocked or unavailable.
  }
}

export interface SessionAuthState {
  authenticated: boolean;
  userName: string;
  isGuest: boolean;
  signIn: (input: { userName: string; remember: boolean }) => void;
  enterAsGuest: () => void;
  signOut: () => void;
}

const saved = readStoredSession();

export const useSessionAuth = create<SessionAuthState>((set) => ({
  authenticated: saved !== null,
  userName: saved?.userName ?? "",
  isGuest: saved?.isGuest ?? false,
  signIn: ({ userName, remember }) => {
    const clean = userName.trim();
    const session: PersistedSession = { userName: clean, isGuest: false };
    writeStoredSession(remember ? session : null);
    set({ authenticated: true, userName: clean, isGuest: false });
  },
  enterAsGuest: () => {
    writeStoredSession(null);
    set({ authenticated: true, userName: "Guest", isGuest: true });
  },
  signOut: () => {
    writeStoredSession(null);
    set({ authenticated: false, userName: "", isGuest: false });
  },
}));
