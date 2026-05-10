import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { startSession, stopSession, getSession } from '../services/sessionManager.js';
import { scopeByClient, assertClientAccess } from '../middleware/auth.js';

const router = Router();

async function fetchSession(id) {
  const { data } = await supabase
    .from('wa_sessions')
    .select('client_id')
    .eq('id', id)
    .maybeSingle();
  return data;
}

// List sessions — scoped per role
router.get('/', async (req, res) => {
  let query = supabase
    .from('wa_sessions')
    .select('*, clients(id, name, event_type, event_date)')
    .order('created_at', { ascending: false });

  // Client user → force filter ke client mereka (override query param)
  if (req.user?.role === 'client_user') {
    query = query.eq('client_id', req.user.client_id);
  } else if (req.query.client_id) {
    query = query.eq('client_id', req.query.client_id);
  }

  const { data, error } = await query;
  console.log('[sessions GET]', {
    role: req.user?.role,
    user_client_id: req.user?.client_id,
    query_client_id: req.query.client_id,
    error: error?.message,
    rowCount: data?.length,
    sample: data?.[0]?.label,
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Buat session baru — client_user otomatis untuk client mereka
router.post('/', async (req, res) => {
  let { client_id, label } = req.body;

  if (req.user?.role === 'client_user') {
    client_id = req.user.client_id;
  }

  if (!client_id || !label) {
    return res.status(400).json({ error: 'client_id & label wajib' });
  }

  try {
    assertClientAccess(req, client_id);
  } catch (e) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }

  const { data, error } = await supabase
    .from('wa_sessions')
    .insert({ client_id, label, status: 'disconnected' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:id/start', async (req, res) => {
  const session = await fetchSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session tidak ditemukan' });
  try {
    assertClientAccess(req, session.client_id);
  } catch (e) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }

  try {
    await startSession(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/qr', async (req, res) => {
  const session = await fetchSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session tidak ditemukan' });
  try {
    assertClientAccess(req, session.client_id);
  } catch (e) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }

  const entry = getSession(req.params.id);
  res.json({ status: entry.status, qr: entry.qr, error: entry.lastError });
});

router.post('/:id/stop', async (req, res) => {
  const session = await fetchSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session tidak ditemukan' });
  try {
    assertClientAccess(req, session.client_id);
  } catch (e) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }

  try {
    await stopSession(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hapus session permanen (otomatis logout dulu kalau masih connected)
router.delete('/:id', async (req, res) => {
  const session = await fetchSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session tidak ditemukan' });
  try {
    assertClientAccess(req, session.client_id);
  } catch (e) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }

  try {
    // Logout dulu (best effort) supaya WhatsApp di HP juga ke-unlink
    await stopSession(req.params.id).catch(() => {});

    // Hapus dari DB (cascade ke wa_auth_state karena ada FK on delete cascade)
    const { error } = await supabase.from('wa_sessions').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
