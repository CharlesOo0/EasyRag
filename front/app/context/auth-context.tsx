import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "~/features/auth/types";
import { AUTH_CLEARED_EVENT, getStoredUser, setStoredUser } from "~/features/auth/storage";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Starts null on every render path, including the client's first
  // (hydrating) render, so it matches the server-rendered markup exactly -
  // reading localStorage during that render (even guarded by
  // `typeof window`) would make the client's first render diverge from the
  // server's and trigger a hydration mismatch for any already-logged-in
  // visitor. The cached user is applied right after, in an effect that only
  // runs post-hydration.
  const [user, setUserState] = useState<User | null>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUserState(stored);

    const onAuthCleared = () => setUserState(null);
    window.addEventListener(AUTH_CLEARED_EVENT, onAuthCleared);
    return () => window.removeEventListener(AUTH_CLEARED_EVENT, onAuthCleared);
  }, []);

  const setUser = (next: User | null) => {
    setStoredUser(next);
    setUserState(next);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
