'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, getToken, setToken } from './api';

export type User = {
  id: string;
  email: string;
  role: 'super_admin' | 'client_user';
  client_id: string | null;
  full_name?: string;
  client?: {
    id: string;
    name: string;
    schedule_enabled: boolean;
  } | null;
};

type AuthContext = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthContext>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

const PUBLIC_PATHS = ['/login'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function load() {
      const token = getToken();
      if (!token) {
        setLoading(false);
        if (!PUBLIC_PATHS.includes(pathname)) router.replace('/login');
        return;
      }
      try {
        const { user } = await api<{ user: User }>('/api/auth/me');
        setUser(user);
        // Client user tidak punya dashboard — redirect ke akun WA
        if (user.role === 'client_user' && pathname === '/') {
          router.replace('/sessions');
        }
      } catch {
        setToken(null);
        if (!PUBLIC_PATHS.includes(pathname)) router.replace('/login');
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const data = await api<{ access_token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(data.access_token);
    setUser(data.user);
    // Super admin → dashboard, client user → langsung ke akun WA
    router.replace(data.user.role === 'client_user' ? '/sessions' : '/');
  }

  function logout() {
    setToken(null);
    setUser(null);
    router.replace('/login');
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
