import { verifyToken } from '../services/auth.js';

/**
 * Middleware utama — verify Bearer token, attach req.user.
 * Endpoint /health, /, /auth/* di-skip.
 */
export async function authMiddleware(req, res, next) {
  // Skip endpoint public
  const publicPaths = ['/', '/health', '/api/auth/login', '/api/auth/me'];
  if (publicPaths.includes(req.path) || req.path.startsWith('/api/auth/')) {
    return next();
  }

  // API key legacy (untuk backward compat & internal scheduler) — tetap support
  const apiKey = req.header('x-api-key');
  if (process.env.API_KEY && apiKey === process.env.API_KEY) {
    req.user = { role: 'super_admin', system: true };
    return next();
  }

  // Bearer token dari Supabase Auth
  const authHeader = req.header('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized — token tidak ada' });
  }

  const user = await verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized — token invalid' });
  }

  req.user = user;
  next();
}

/**
 * Restrict ke super_admin only.
 */
export function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Hanya super admin yang bisa akses endpoint ini' });
  }
  next();
}

/**
 * Helper untuk scope query Supabase berdasarkan role.
 * Super admin → tidak ada filter (akses semua).
 * Client user → filter by client_id mereka.
 */
export function scopeByClient(req, query, columnName = 'client_id') {
  if (req.user?.role === 'super_admin') return query;
  if (!req.user?.client_id) {
    throw new Error('Client user tanpa client_id — data corrupt');
  }
  return query.eq(columnName, req.user.client_id);
}

/**
 * Throw kalau client_id di body tidak match user (untuk client_user).
 */
export function assertClientAccess(req, clientId) {
  if (req.user?.role === 'super_admin') return;
  if (clientId !== req.user?.client_id) {
    const err = new Error('Akses ditolak: data ini bukan milik Anda');
    err.statusCode = 403;
    throw err;
  }
}
