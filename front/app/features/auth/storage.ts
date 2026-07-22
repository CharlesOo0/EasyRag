import type { User } from "./types";

const STORAGE_KEY = "user";

// apiFetch (lib/api.ts) clears the stored user directly on an unrecoverable
// 401, outside of any React component - it has no way to reach
// AuthProvider's in-memory state otherwise, which would leave the context
// showing a stale logged-in user after cleared storage (most visibly when a
// full-page redirect doesn't happen, e.g. because the request happened while
// already on an /auth/* route). AuthProvider listens for this to stay in sync.
export const AUTH_CLEARED_EVENT = "auth:cleared";

// Only a UI-convenience cache for SSR-safe initial render - tokens
// themselves are HttpOnly cookies set by the backend and never touched
// here. Guarded for SSR since AuthProvider's initializer runs server-side too.
export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null) {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function clearStoredUser() {
  setStoredUser(null);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CLEARED_EVENT));
  }
}
