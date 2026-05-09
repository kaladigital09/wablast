import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { supabase } from '../db/supabase.js';
import { runCampaign, sendSingleMessage } from '../services/blastService.js';
import { assertClientAccess, requireSuperAdmin } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const MAX_RECIPIENTS_PER_CAMPAIGN = 20;

router.get('/config', (_, res) => {
  res.json({
    max_recipients_per_campaign: MAX_RECIPIENTS_PER_CAMPAIGN,
  });
});

async function fetchCampaign(id) {
  const { data } = await supabase
    .from('campaigns')
    .select('client_id')
    .eq('id', id)
    .maybeSingle();
  return data;
}

// List campaigns
router.get('/', async (req, res) => {
  let query = supabase.from('campaigns').select('*').order('created_at', { ascending: false });

  if (req.user?.role === 'client_user') {
    query = query.eq('client_id', req.user.client_id);
  } else if (req.query.client_id) {
    query = query.eq('client_id', req.query.client_id);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/:id', async (req, res) => {
  const campaign = await fetchCampaign(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Tidak ditemukan' });
  try {
    assertClientAccess(req, campaign.client_id);
  } catch (e) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
});

router.post('/', upload.single('csv'), async (req, res) => {
  try {
    let {
      client_id,
      session_id,
      name,
      template_text,
      image_url,
      scheduled_at,
      invitation_link,
    } = req.body;

    // Client user → force client_id ke milik mereka
    if (req.user?.role === 'client_user') {
      client_id = req.user.client_id;
    }

    if (!client_id || !session_id || !name || !template_text) {
      return res.status(400).json({ error: 'client_id, session_id, name, template_text wajib' });
    }
    if (!req.file) return res.status(400).json({ error: 'CSV file wajib' });

    try {
      assertClientAccess(req, client_id);
    } catch (e) {
      return res.status(e.statusCode || 403).json({ error: e.message });
    }

    // Cek scheduler permission
    if (scheduled_at && req.user?.role === 'client_user') {
      const { data: client } = await supabase
        .from('clients')
        .select('schedule_enabled')
        .eq('id', client_id)
        .single();
      if (!client?.schedule_enabled) {
        return res.status(403).json({
          error: 'Fitur scheduler belum diaktifkan untuk akun Anda. Hubungi admin.',
        });
      }
    }

    const records = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const validRows = records.filter((r) => r.phone || r.nomor || r.no_hp);

    if (validRows.length > MAX_RECIPIENTS_PER_CAMPAIGN) {
      return res.status(400).json({
        error: `Maksimal ${MAX_RECIPIENTS_PER_CAMPAIGN} nomor per campaign untuk hindari banned WA. CSV Anda berisi ${validRows.length} nomor — silakan pecah jadi beberapa batch.`,
      });
    }

    if (validRows.length === 0) {
      return res.status(400).json({
        error: 'CSV kosong atau tidak ada nomor valid (kolom phone/nomor/no_hp wajib ada).',
      });
    }

    const status = scheduled_at ? 'scheduled' : 'draft';

    const { data: campaign, error: cErr } = await supabase
      .from('campaigns')
      .insert({
        client_id,
        session_id,
        name,
        template_text,
        image_url: image_url || null,
        scheduled_at: scheduled_at || null,
        status,
        total_recipients: validRows.length,
      })
      .select()
      .single();
    if (cErr) throw cErr;

    const messages = validRows.map((row) => {
      const phone = row.phone || row.nomor || row.no_hp;
      const guestName = row.name || row.nama || '';
      const variables = { ...row };
      delete variables.phone;
      delete variables.nomor;
      delete variables.no_hp;
      delete variables.name;
      delete variables.nama;

      if (invitation_link && guestName) {
        variables.link = invitation_link + encodeURIComponent(guestName);
      } else if (invitation_link) {
        variables.link = invitation_link;
      }

      return {
        campaign_id: campaign.id,
        session_id,
        phone,
        name: guestName,
        variables,
        status: 'pending',
      };
    });

    if (messages.length) {
      const { error: mErr } = await supabase.from('messages').insert(messages);
      if (mErr) throw mErr;
    }

    res.json({ ...campaign, total_recipients: messages.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/run', async (req, res) => {
  const campaign = await fetchCampaign(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Tidak ditemukan' });
  try {
    assertClientAccess(req, campaign.client_id);
  } catch (e) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }

  runCampaign(req.params.id).catch((e) => console.error(e));
  res.json({ ok: true, message: 'Campaign dimulai' });
});

router.post('/:id/cancel', async (req, res) => {
  const campaign = await fetchCampaign(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Tidak ditemukan' });
  try {
    assertClientAccess(req, campaign.client_id);
  } catch (e) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }

  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.post('/:id/messages/:messageId/send', async (req, res) => {
  const campaign = await fetchCampaign(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Tidak ditemukan' });
  try {
    assertClientAccess(req, campaign.client_id);
  } catch (e) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }

  try {
    const result = await sendSingleMessage(req.params.id, req.params.messageId);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hapus campaign — SUPER ADMIN ONLY
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  const campaign = await fetchCampaign(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Tidak ditemukan' });

  // Cascade: messages otomatis ke-delete karena ada FK on delete cascade
  const { error } = await supabase.from('campaigns').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.get('/:id/messages', async (req, res) => {
  const campaign = await fetchCampaign(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Tidak ditemukan' });
  try {
    assertClientAccess(req, campaign.client_id);
  } catch (e) {
    return res.status(e.statusCode || 403).json({ error: e.message });
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('campaign_id', req.params.id)
    .order('id', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const stats = {
    total: data.length,
    pending: data.filter((m) => m.status === 'pending').length,
    sent: data.filter((m) => m.status === 'sent').length,
    failed: data.filter((m) => m.status === 'failed').length,
  };
  res.json({ messages: data, stats });
});

export default router;
