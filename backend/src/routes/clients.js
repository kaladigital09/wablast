import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireSuperAdmin, scopeByClient, assertClientAccess } from '../middleware/auth.js';
import {
  createClientUser,
  deleteUser,
  resetClientPassword,
  updateUserEmail,
  updateUserProfile,
} from '../services/auth.js';

const router = Router();

// List clients
// - super_admin: semua clients (with user info)
// - client_user: hanya client mereka sendiri
router.get('/', async (req, res) => {
  if (req.user?.role === 'super_admin') {
    // Coba view dengan user info dulu; fallback ke clients biasa
    let { data, error } = await supabase
      .from('clients_with_user')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[clients] view clients_with_user gagal, fallback:', error.message);
      const fallback = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  // client_user — hanya 1 client mereka
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', req.user.client_id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ? [data] : []);
});

// Detail client
router.get('/:id', async (req, res) => {
  try {
    assertClientAccess(req, req.params.id);
  } catch (e) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
});

// Buat client baru — SUPER ADMIN ONLY
// Body: { name, event_type, event_date, notes, contact_email, schedule_enabled, create_user }
// Kalau create_user=true, otomatis bikin akun login + return password sekali
router.post('/', requireSuperAdmin, async (req, res) => {
  try {
    const {
      name,
      event_type,
      event_date,
      notes,
      contact_email,
      schedule_enabled = false,
      create_user = false,
      full_name,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'name wajib' });

    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        name,
        event_type,
        event_date: event_date || null,
        notes,
        contact_email: contact_email || null,
        schedule_enabled,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    let userInfo = null;
    if (create_user) {
      if (!contact_email) {
        return res.status(400).json({
          error: 'Email wajib diisi jika ingin buatkan akun login untuk client',
        });
      }
      try {
        const { user, password } = await createClientUser({
          email: contact_email,
          fullName: full_name || name,
          clientId: client.id,
        });
        userInfo = { id: user.id, email: user.email, password };
      } catch (e) {
        // Rollback client kalau user creation gagal
        await supabase.from('clients').delete().eq('id', client.id);
        return res.status(400).json({ error: e.message });
      }
    }

    res.json({ ...client, user: userInfo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update client
router.patch('/:id', async (req, res) => {
  try {
    assertClientAccess(req, req.params.id);
  } catch (e) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }

  try {
    const allowedForClient = ['name', 'event_type', 'event_date', 'notes'];
    const allowedForAdmin = [
      ...allowedForClient,
      'contact_email',
      'schedule_enabled',
    ];
    const allowed = req.user?.role === 'super_admin' ? allowedForAdmin : allowedForClient;

    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    // full_name client (untuk display di profile user)
    const fullNameUpdate = req.body.full_name;

    if (!Object.keys(updates).length && fullNameUpdate === undefined) {
      return res.status(400).json({ error: 'Tidak ada field yang diupdate' });
    }

    // Ambil owner_user_id dulu (untuk sync email/full_name kalau di-update)
    const { data: existing } = await supabase
      .from('clients')
      .select('owner_user_id')
      .eq('id', req.params.id)
      .single();

    // Update client
    let updatedClient = null;
    if (Object.keys(updates).length) {
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      updatedClient = data;
    }

    // Sync ke auth.users kalau email berubah (hanya admin)
    if (
      req.user?.role === 'super_admin' &&
      existing?.owner_user_id &&
      updates.contact_email
    ) {
      try {
        await updateUserEmail(existing.owner_user_id, updates.contact_email);
      } catch (err) {
        return res
          .status(400)
          .json({ error: `Gagal update email login: ${err.message}` });
      }
    }

    // Sync full_name di user_profiles
    if (existing?.owner_user_id && fullNameUpdate !== undefined) {
      await updateUserProfile(existing.owner_user_id, { full_name: fullNameUpdate });
    }

    if (!updatedClient) {
      const { data } = await supabase.from('clients').select('*').eq('id', req.params.id).single();
      updatedClient = data;
    }
    res.json(updatedClient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get detail client + user info (untuk halaman edit)
// Tidak pakai view supaya selalu fresh dari source tables
router.get('/:id/full', async (req, res) => {
  try {
    assertClientAccess(req, req.params.id);
  } catch (e) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }

  // Ambil client
  const { data: client, error: cErr } = await supabase
    .from('clients')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (cErr) return res.status(404).json({ error: cErr.message });

  // Ambil user terkait kalau ada owner_user_id
  let userInfo = { user_id: null, user_email: null, user_full_name: null };
  if (client.owner_user_id) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('id', client.owner_user_id)
      .maybeSingle();
    if (profile) {
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
      userInfo = {
        user_id: profile.id,
        user_email: authUser?.user?.email || null,
        user_full_name: profile.full_name || null,
      };
    }
  }

  // Untuk client_user: kalau ini client mereka, override dengan email mereka
  if (req.user?.role === 'client_user' && client.id === req.user.client_id) {
    userInfo = {
      user_id: req.user.id,
      user_email: req.user.email,
      user_full_name: req.user.full_name || userInfo.user_full_name,
    };
  }

  res.json({ ...client, ...userInfo });
});

// Reset password client user — SUPER ADMIN ONLY
router.post('/:id/reset-password', requireSuperAdmin, async (req, res) => {
  try {
    const { data: client } = await supabase
      .from('clients')
      .select('owner_user_id')
      .eq('id', req.params.id)
      .single();
    if (!client?.owner_user_id) {
      return res.status(400).json({ error: 'Client ini belum punya akun login' });
    }
    const password = await resetClientPassword(client.owner_user_id);
    res.json({ ok: true, password });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete client — SUPER ADMIN ONLY
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { data: client } = await supabase
      .from('clients')
      .select('owner_user_id')
      .eq('id', req.params.id)
      .single();

    // Delete client (cascade ke sessions, campaigns, dll)
    const { error } = await supabase.from('clients').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });

    // Delete user terkait
    if (client?.owner_user_id) {
      await deleteUser(client.owner_user_id);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
