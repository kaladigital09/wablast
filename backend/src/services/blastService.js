import { sendMessage } from './sessionManager.js';
import { supabase } from '../db/supabase.js';

const MIN_DELAY = parseInt(process.env.MIN_DELAY_MS || '5000', 10);
const MAX_DELAY = parseInt(process.env.MAX_DELAY_MS || '15000', 10);
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT_PER_SESSION || '300', 10);

const runningCampaigns = new Set();
const runningSessions = new Set(); // Lock per akun WA — cegah 2 campaign concurrent di akun sama

function randomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeJid(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  let n = digits;
  if (n.startsWith('0')) n = '62' + n.slice(1);
  if (n.startsWith('8')) n = '62' + n;
  return `${n}@s.whatsapp.net`;
}

function applyTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

async function getDailySent(sessionId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('status', 'sent')
    .gte('sent_at', startOfDay.toISOString());
  return count || 0;
}

export async function runCampaign(campaignId) {
  if (runningCampaigns.has(campaignId)) return;
  runningCampaigns.add(campaignId);

  let lockedSessionId = null;

  try {
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select('*, clients(name)')
      .eq('id', campaignId)
      .single();
    if (error || !campaign) throw new Error('Campaign tidak ditemukan');

    const namaClient = campaign.clients?.name || '';

    if (campaign.status === 'completed' || campaign.status === 'cancelled') return;

    // Cegah 2 campaign jalan bareng di akun WA yang sama → anti-banned
    if (runningSessions.has(campaign.session_id)) {
      console.log(
        `[Blast] Campaign ${campaignId} antri — session ${campaign.session_id} sedang dipakai`
      );
      await supabase
        .from('campaigns')
        .update({
          status: 'queued',
          notes: 'Menunggu campaign lain selesai di akun WA yang sama',
        })
        .eq('id', campaignId);
      return;
    }

    runningSessions.add(campaign.session_id);
    lockedSessionId = campaign.session_id;

    await supabase
      .from('campaigns')
      .update({ status: 'running', started_at: new Date().toISOString(), notes: null })
      .eq('id', campaignId);

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'failed'])
      .order('id', { ascending: true });

    let sentToday = await getDailySent(campaign.session_id);

    for (const msg of messages || []) {
      const { data: fresh } = await supabase
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .single();
      if (fresh?.status === 'cancelled') break;

      if (sentToday >= DAILY_LIMIT) {
        await supabase
          .from('campaigns')
          .update({ status: 'paused_limit', notes: `Daily limit ${DAILY_LIMIT} tercapai` })
          .eq('id', campaignId);
        break;
      }

      const jid = normalizeJid(msg.phone);
      if (!jid) {
        await supabase
          .from('messages')
          .update({ status: 'failed', error: 'Nomor tidak valid' })
          .eq('id', msg.id);
        continue;
      }

      const vars = msg.variables || {};
      const text = applyTemplate(campaign.template_text || '', {
        nama: msg.name,
        nama_client: namaClient,
        ...vars,
      });

      try {
        const content = {};
        if (campaign.image_url) {
          content.image = { url: campaign.image_url };
          content.caption = text;
        } else {
          content.text = text;
        }
        await sendMessage(campaign.session_id, jid, content);

        await supabase
          .from('messages')
          .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
          .eq('id', msg.id);
        sentToday++;
      } catch (err) {
        await supabase
          .from('messages')
          .update({ status: 'failed', error: err.message?.slice(0, 500) || 'unknown' })
          .eq('id', msg.id);
      }

      await sleep(randomDelay());
    }

    const { count: pendingCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'failed']);

    if (!pendingCount) {
      await supabase
        .from('campaigns')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', campaignId);
    }
  } finally {
    runningCampaigns.delete(campaignId);
    if (lockedSessionId) runningSessions.delete(lockedSessionId);
  }
}

export function isCampaignRunning(campaignId) {
  return runningCampaigns.has(campaignId);
}

// Kirim 1 pesan saja — dipakai untuk mode manual per-row
export async function sendSingleMessage(campaignId, messageId) {
  const { data: campaign, error: cErr } = await supabase
    .from('campaigns')
    .select('*, clients(name)')
    .eq('id', campaignId)
    .single();
  if (cErr || !campaign) throw new Error('Campaign tidak ditemukan');

  const { data: msg, error: mErr } = await supabase
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .eq('campaign_id', campaignId)
    .single();
  if (mErr || !msg) throw new Error('Pesan tidak ditemukan');

  if (msg.status === 'sent') {
    return { status: 'sent', skipped: true, message: 'Sudah pernah terkirim' };
  }

  const jid = normalizeJid(msg.phone);
  if (!jid) {
    await supabase
      .from('messages')
      .update({ status: 'failed', error: 'Nomor tidak valid' })
      .eq('id', msg.id);
    throw new Error('Nomor tidak valid');
  }

  const namaClient = campaign.clients?.name || '';
  const vars = msg.variables || {};
  const text = applyTemplate(campaign.template_text || '', {
    nama: msg.name,
    nama_client: namaClient,
    ...vars,
  });

  try {
    const content = {};
    if (campaign.image_url) {
      content.image = { url: campaign.image_url };
      content.caption = text;
    } else {
      content.text = text;
    }
    await sendMessage(campaign.session_id, jid, content);

    await supabase
      .from('messages')
      .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
      .eq('id', msg.id);

    // Update campaign status kalau sudah selesai semua
    const { count: pendingCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'failed']);
    if (!pendingCount) {
      await supabase
        .from('campaigns')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', campaignId);
    }

    return { status: 'sent' };
  } catch (err) {
    await supabase
      .from('messages')
      .update({ status: 'failed', error: err.message?.slice(0, 500) || 'unknown' })
      .eq('id', msg.id);
    throw err;
  }
}
