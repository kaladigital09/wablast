import cron from 'node-cron';
import { supabase } from '../db/supabase.js';
import { runCampaign, isCampaignRunning } from './blastService.js';

const CAMPAIGN_RETENTION_DAYS = parseInt(process.env.CAMPAIGN_RETENTION_DAYS || '30', 10);

export function startScheduler() {
  // Cek tiap menit:
  // 1. Campaign 'scheduled' yang sudah waktunya
  // 2. Campaign 'queued' yang menunggu giliran (akun WA-nya tadi sibuk)
  cron.schedule('* * * * *', async () => {
    const now = new Date().toISOString();

    const { data: scheduled } = await supabase
      .from('campaigns')
      .select('id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true });

    const { data: queued } = await supabase
      .from('campaigns')
      .select('id')
      .eq('status', 'queued')
      .order('created_at', { ascending: true });

    const candidates = [...(scheduled || []), ...(queued || [])];

    for (const c of candidates) {
      if (!isCampaignRunning(c.id)) {
        runCampaign(c.id).catch((e) => console.error('Campaign error:', e));
      }
    }
  });

  // Cleanup harian — hapus campaign yang sudah selesai/cancelled > 30 hari
  // Jalan setiap hari jam 03:00 (waktu server)
  cron.schedule('0 3 * * *', async () => {
    await runCleanup().catch((e) => console.error('[Cleanup] Error:', e));
  });

  // Run cleanup sekali saat startup (in case backend down beberapa hari)
  setTimeout(() => {
    runCleanup().catch((e) => console.error('[Cleanup] Error:', e));
  }, 30_000);

  console.log(
    `[Scheduler] Started — minute scheduler + daily cleanup (retention ${CAMPAIGN_RETENTION_DAYS}d)`
  );
}

async function runCleanup() {
  const cutoff = new Date(Date.now() - CAMPAIGN_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: toDelete, error: selectErr } = await supabase
    .from('campaigns')
    .select('id, name, status, completed_at, created_at')
    .in('status', ['completed', 'cancelled'])
    .or(`completed_at.lte.${cutoff},and(completed_at.is.null,created_at.lte.${cutoff})`);

  if (selectErr) {
    console.error('[Cleanup] Select error:', selectErr.message);
    return;
  }

  if (!toDelete?.length) {
    console.log(`[Cleanup] No campaigns older than ${CAMPAIGN_RETENTION_DAYS} days`);
    return;
  }

  const ids = toDelete.map((c) => c.id);
  const { error: deleteErr } = await supabase.from('campaigns').delete().in('id', ids);

  if (deleteErr) {
    console.error('[Cleanup] Delete error:', deleteErr.message);
    return;
  }

  console.log(
    `[Cleanup] Deleted ${ids.length} campaign(s) older than ${CAMPAIGN_RETENTION_DAYS} days`
  );
}
