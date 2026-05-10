const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type FetchOpts = Omit<RequestInit, 'body'> & { body?: any };

const TOKEN_KEY = 'kala_blast_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T = any>(path: string, opts: FetchOpts = {}): Promise<T> {
  const isFormData = opts.body instanceof FormData;
  const token = getToken();

  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && opts.body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers,
    cache: 'no-store',
    body: isFormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));

    // 401 dari endpoint auth (login/me) → biarkan pesan asli, jangan redirect
    const isAuthEndpoint = path.startsWith('/api/auth/');

    if (res.status === 401 && !isAuthEndpoint) {
      // Token invalid pada endpoint terproteksi → logout & redirect
      setToken(null);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const fetcher = (path: string) => api(path);
