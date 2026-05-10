import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { verifyToken, createSuperAdmin, invalidateTokenCache } from '../services/auth.js';

const router = Router();

// Login — return access_token + user info
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email & password wajib' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return res.status(401).json({ error: 'Email atau password salah' });
  }

  const user = await verifyToken(data.session.access_token);
  if (!user) {
    return res.status(403).json({
      error: 'User belum punya profile/role. Hubungi admin.',
    });
  }

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user,
  });
});

// Get current user (untuk verify token frontend)
router.get('/me', async (req, res) => {
  const authHeader = req.header('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });

  const user = await verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  res.json({ user });
});

// Logout (frontend cukup hapus token, tapi ini untuk invalidate di Supabase)
router.post('/logout', async (req, res) => {
  const authHeader = req.header('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    invalidateTokenCache(token);
    await supabase.auth.admin.signOut(token).catch(() => {});
  }
  res.json({ ok: true });
});

// Seed super admin — hanya jalan kalau belum ada super admin & ada init token
router.post('/seed-admin', async (req, res) => {
  const initToken = req.header('x-init-token');
  if (initToken !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const user = await createSuperAdmin({
      email: req.body.email || 'cskaladigital@gmail.com',
      password: req.body.password,
      fullName: req.body.full_name || 'Super Admin',
    });
    res.json({ ok: true, user_id: user.id, email: user.email });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
