import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AuthRequiredError, authFetch, clearStoredToken, getStoredToken, setStoredToken } from '@/lib/auth';

interface AuthState {
  loading: boolean;
  user: string | null;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export class LoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoginError';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(() => getStoredToken() !== null);

  // Revalidate any stored token on boot. If the token is missing, expired, or
  // signed by a different secret, clear it and stay logged out.
  useEffect(() => {
    if (!getStoredToken()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/me');
        if (cancelled) return;
        if (res.ok) {
          const { user: u, isAdmin: admin } = (await res.json()) as {
            user: string;
            isAdmin?: boolean;
          };
          setUser(u);
          setIsAdmin(!!admin);
        } else {
          clearStoredToken();
          setUser(null);
          setIsAdmin(false);
        }
      } catch {
        if (!cancelled) {
          clearStoredToken();
          setUser(null);
          setIsAdmin(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // React to 401s from any other authFetch caller — they clear the token, we
  // mirror that into provider state so the UI flips to LoginPage.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== 'hd_auth_token') return;
      if (e.newValue == null) {
        setUser(null);
        setIsAdmin(false);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      if (res.status === 401) throw new LoginError('Usuario o contraseña incorrectos');
      throw new LoginError(`Error del servidor (${res.status})`);
    }
    const { token, user: u, isAdmin: admin } = (await res.json()) as {
      token: string;
      user: string;
      isAdmin?: boolean;
    };
    setStoredToken(token);
    setUser(u);
    setIsAdmin(!!admin);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ loading, user, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export { AuthRequiredError };
