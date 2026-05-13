'use client';
import useSWR from 'swr';
import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { api, fetcher } from '@/lib/api';
import PageLoader from '../../components/PageLoader';
import BlastProgressModal from '../../components/BlastProgressModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

const statusConfig: Record<string, { color: string; label: string; dot: string }> = {
  draft: { color: 'bg-stone-100 text-stone-700', label: 'Draft', dot: 'bg-stone-400' },
  scheduled: { color: 'bg-blue-50 text-blue-700', label: 'Terjadwal', dot: 'bg-blue-500' },
  queued: { color: 'bg-purple-50 text-purple-700', label: 'Antri', dot: 'bg-purple-500 animate-pulse' },
  running: { color: 'bg-amber-50 text-amber-700', label: 'Berjalan', dot: 'bg-amber-500 animate-pulse' },
  completed: { color: 'bg-emerald-50 text-emerald-700', label: 'Selesai', dot: 'bg-emerald-500' },
  cancelled: { color: 'bg-red-50 text-red-700', label: 'Dibatalkan', dot: 'bg-red-500' },
  paused_limit: { color: 'bg-orange-50 text-orange-700', label: 'Limit harian', dot: 'bg-orange-500' },
};

const msgStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-stone-100 text-stone-600', label: 'Pending' },
  sent: { color: 'bg-emerald-50 text-emerald-700', label: 'Terkirim' },
  failed: { color: 'bg-red-50 text-red-700', label: 'Gagal' },
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const [sendingId, setSendingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all');
  const [blastModalOpen, setBlastModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'cancel' | 'run' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'detail' | 'messages'>('detail');

  const { data: campaign, mutate: mutateCampaign } = useSWR(`/api/campaigns/${id}`, fetcher, {
    // Polling cuma saat campaign sedang berjalan (running/queued).
    refreshInterval: (latest) =>
      latest && ['running', 'queued'].includes(latest.status) ? 3000 : 0,
  });
  const isLive = campaign && ['running', 'queued'].includes(campaign.status);
  const { data: messagesData, mutate: mutateMessages } = useSWR(
    `/api/campaigns/${id}/messages`,
    fetcher,
    { refreshInterval: isLive ? 3000 : 0 }
  );
  // Untuk lookup label akun WA di section Detail Campaign
  const { data: sessions } = useSWR('/api/sessions', fetcher);
  const usedSession = sessions?.find((s: any) => s.id === campaign?.session_id);

  async function sendOne(messageId: number) {
    setSendingId(messageId);
    try {
      await api(`/api/campaigns/${id}/messages/${messageId}/send`, { method: 'POST' });
      mutateMessages();
      mutateCampaign();
    } catch (err: any) {
      alert('Gagal kirim: ' + err.message);
    } finally {
      setSendingId(null);
    }
  }

  async function performRun() {
    setActionLoading(true);
    try {
      await api(`/api/campaigns/${id}/run`, { method: 'POST' });
      setConfirmAction(null);
      setBlastModalOpen(true);
      mutateCampaign();
    } catch (err: any) {
      alert('Gagal: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function performCancel() {
    setActionLoading(true);
    try {
      await api(`/api/campaigns/${id}/cancel`, { method: 'POST' });
      mutateCampaign();
      mutateMessages();
      setConfirmAction(null);
    } catch (err: any) {
      alert('Gagal: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function performDelete() {
    setActionLoading(true);
    try {
      await api(`/api/campaigns/${id}`, { method: 'DELETE' });
      router.push('/campaigns');
    } catch (err: any) {
      alert('Gagal hapus: ' + err.message);
      setActionLoading(false);
    }
  }

  // Trigger dari modal blast progress saat user klik "Hentikan Blast"
  const cancelFromModal = () => setConfirmAction('cancel');

  // Auto-open modal HANYA kalau user pernah buka modal & campaign masih running.
  // Kalau user baru masuk halaman dan campaign sedang running, biarkan user klik
  // tombol modal sendiri (tidak auto-popup).
  // Modal akan tetap stay open selama running setelah user buka.
  useEffect(() => {
    if (blastModalOpen && !['running'].includes(campaign?.status || '')) {
      // Modal stay open agar user lihat hasil akhir (sent/failed/cancelled),
      // tombol close jadi tersedia karena status bukan running.
    }
  }, [campaign?.status, blastModalOpen]);

  if (!campaign) return <PageLoader />;

  const stats = messagesData?.stats || { total: 0, pending: 0, sent: 0, failed: 0 };
  const progress = stats.total ? Math.round(((stats.sent + stats.failed) / stats.total) * 100) : 0;
  const cfg = statusConfig[campaign.status] || statusConfig.draft;

  const allMessages = messagesData?.messages || [];
  const filteredMessages =
    filter === 'all' ? allMessages : allMessages.filter((m: any) => m.status === filter);

  // Extract base invitation link dari message sample (link disimpan per-row di messages.variables.link,
  // bukan di tabel campaigns). Ambil dari message pertama yang punya variables.link.
  const sampleLinkMsg = allMessages.find((m: any) => m.variables?.link);
  const sampleLink: string | null = sampleLinkMsg?.variables?.link ?? null;
  // Buang encoding nama tamu di akhir untuk dapat base URL
  let baseInvitationLink: string | null = null;
  if (sampleLink && sampleLinkMsg?.name) {
    const encoded = encodeURIComponent(sampleLinkMsg.name);
    if (sampleLink.endsWith(encoded)) {
      baseInvitationLink = sampleLink.slice(0, -encoded.length);
    } else {
      baseInvitationLink = sampleLink;
    }
  } else if (sampleLink) {
    baseInvitationLink = sampleLink;
  }

  return (
    <div className="space-y-6">
      <BlastProgressModal
        open={blastModalOpen}
        stats={stats}
        status={campaign.status}
        campaignName={campaign.name}
        onCancel={cancelFromModal}
        onClose={() => setBlastModalOpen(false)}
      />

      {campaign.status === 'running' && !blastModalOpen && (
        <button
          onClick={() => setBlastModalOpen(true)}
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-30 bg-violet-600 hover:bg-violet-700 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-full shadow-lg font-medium text-xs sm:text-sm flex items-center gap-2 animate-fade-in"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          <span className="hidden sm:inline">Blast berjalan — </span>Lihat progres
        </button>
      )}

      <div>
        <Link
          href="/campaigns"
          className="text-sm text-stone-500 hover:text-stone-700 inline-flex items-center gap-1 mb-3"
        >
          ← Kembali ke Campaigns
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 break-words">
              {campaign.name}
            </h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`badge ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                {cfg.label}
              </span>
              <span className="text-sm text-stone-500">
                Dibuat {new Date(campaign.created_at).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {!['running', 'completed', 'cancelled'].includes(campaign.status) && (
              <button
                onClick={() => setConfirmAction('run')}
                className="btn-primary text-sm"
              >
                ▶ Jalankan Massal
              </button>
            )}
            {!['completed', 'cancelled'].includes(campaign.status) && (
              <button
                onClick={() => setConfirmAction('cancel')}
                className="btn-danger text-sm"
              >
                Batalkan
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setConfirmAction('delete')}
                className="bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 font-medium px-3 py-2 rounded-lg transition-all text-sm"
                title="Hapus permanen (super admin only)"
              >
                🗑 Hapus
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Total" value={stats.total} color="text-stone-700" icon="◇" bg="bg-stone-100" />
        <StatBox
          label="Pending"
          value={stats.pending}
          color="text-stone-700"
          icon="⏳"
          bg="bg-stone-100"
          onClick={() => setFilter('pending')}
          active={filter === 'pending'}
        />
        <StatBox
          label="Terkirim"
          value={stats.sent}
          color="text-emerald-700"
          icon="✓"
          bg="bg-emerald-50"
          onClick={() => setFilter('sent')}
          active={filter === 'sent'}
        />
        <StatBox
          label="Gagal"
          value={stats.failed}
          color="text-red-700"
          icon="✕"
          bg="bg-red-50"
          onClick={() => setFilter('failed')}
          active={filter === 'failed'}
        />
      </div>

      {/* Progress bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-stone-700">Progres Pengiriman</span>
          <span className="text-sm font-semibold text-emerald-600">{progress}%</span>
        </div>
        <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-stone-500">
          {stats.sent + stats.failed} dari {stats.total} pesan diproses
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-stone-200 flex gap-1">
        <TabButton
          active={activeTab === 'detail'}
          onClick={() => setActiveTab('detail')}
          label="Detail Campaign"
        />
        <TabButton
          active={activeTab === 'messages'}
          onClick={() => setActiveTab('messages')}
          label="Daftar Pesan"
          count={stats.total}
        />
      </div>

      {activeTab === 'detail' && (
      <>
      {/* Detail Campaign — read-only view dari form yang dulu diinput */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-100">
          <h2 className="font-semibold text-stone-900">Detail Campaign</h2>
          <p className="text-sm text-stone-500">
            Konfigurasi yang dipakai saat campaign dibuat
          </p>
        </div>
        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <DetailField label="Nama Campaign" value={campaign.name} />
          <DetailField
            label="Akun WhatsApp"
            value={
              usedSession
                ? `${usedSession.label}${
                    usedSession.phone_number ? ` (+${usedSession.phone_number})` : ''
                  }`
                : campaign.session_id
                ? '— Akun sudah dihapus —'
                : '— Belum dipilih —'
            }
          />
          {campaign.scheduled_at && (
            <DetailField
              label="Jadwal Kirim"
              value={new Date(campaign.scheduled_at).toLocaleString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          )}
          <DetailField
            label="Total Penerima"
            value={`${campaign.total_recipients ?? stats.total} nomor`}
          />

          {baseInvitationLink && (
            <div className="md:col-span-2">
              <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                Link Undangan
              </div>
              <div className="space-y-2">
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-sm break-all">
                  <span className="text-stone-500 text-xs block mb-1">
                    Base URL (auto-append nama tamu):
                  </span>
                  <code className="text-violet-700">{baseInvitationLink}</code>
                </div>
                {sampleLinkMsg && (
                  <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 text-xs break-all">
                    <span className="text-violet-700 font-medium">
                      Contoh untuk "{sampleLinkMsg.name}":
                    </span>{' '}
                    <a
                      href={sampleLink || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-900 hover:underline"
                    >
                      {sampleLink}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {campaign.image_url && (
            <div className="md:col-span-2">
              <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                Gambar Undangan
              </div>
              <a
                href={campaign.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block group"
              >
                <img
                  src={campaign.image_url}
                  alt="Gambar undangan"
                  className="max-w-full sm:max-w-xs rounded-lg border border-stone-200 group-hover:opacity-90 transition-opacity"
                />
                <div className="text-xs text-violet-600 group-hover:text-violet-700 mt-1.5">
                  ↗ Buka di tab baru
                </div>
              </a>
            </div>
          )}

          <div className="md:col-span-2">
            <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
              Template Pesan
            </div>
            <pre className="bg-stone-50 border border-stone-200 rounded-lg p-4 text-sm text-stone-800 font-sans whitespace-pre-wrap break-words leading-relaxed">
              {campaign.template_text || '— Tidak ada template —'}
            </pre>
            <p className="text-xs text-stone-400 mt-2">
              Variabel <code className="text-stone-500">{'{nama}'}</code>,{' '}
              <code className="text-stone-500">{'{nama_client}'}</code>, dll
              akan otomatis di-replace per penerima.
            </p>
          </div>

          {campaign.notes && (
            <div className="md:col-span-2">
              <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                Catatan Sistem
              </div>
              <div className="text-sm text-stone-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                {campaign.notes}
              </div>
            </div>
          )}
        </div>
      </div>

      </>
      )}

      {activeTab === 'messages' && (
      <>
      {/* Tip */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <div className="text-2xl shrink-0">💡</div>
        <div className="text-sm">
          <div className="font-medium text-amber-900">Tips Anti-Banned WhatsApp</div>
          <p className="text-amber-800/80 mt-1 leading-relaxed">
            Untuk akun WA baru atau jumlah penerima banyak, kirim manual{' '}
            <strong>satu-per-satu</strong> dengan tombol <em>Kirim</em> di bawah lebih aman daripada blast
            massal sekaligus.
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-semibold text-stone-900">Daftar Pesan</h2>
            <p className="text-sm text-stone-500">
              {filteredMessages.length} {filter !== 'all' ? `pesan ${filter}` : 'pesan total'}
            </p>
          </div>
          <div className="flex gap-1 bg-stone-100 p-1 rounded-lg text-xs sm:text-sm overflow-x-auto">
            {(['all', 'pending', 'sent', 'failed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                  filter === f
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {f === 'all' ? 'Semua' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile: card list */}
        <div className="sm:hidden divide-y divide-stone-100 max-h-[600px] overflow-auto">
          {filteredMessages.map((m: any) => {
            const msgCfg = msgStatusConfig[m.status];
            return (
              <div key={m.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-stone-900 truncate">{m.name || '—'}</div>
                    <div className="font-mono text-xs text-stone-500 mt-0.5">+{m.phone}</div>
                  </div>
                  <span className={`badge ${msgCfg.color} shrink-0`}>{msgCfg.label}</span>
                </div>
                {(m.error || m.sent_at) && (
                  <div className="text-xs text-stone-500">
                    {m.error ? (
                      <span className="text-red-600">⚠ {m.error}</span>
                    ) : (
                      new Date(m.sent_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    )}
                  </div>
                )}
                {m.status !== 'sent' && (
                  <button
                    onClick={() => sendOne(m.id)}
                    disabled={sendingId === m.id}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-2 rounded-md disabled:opacity-50 transition-all"
                  >
                    {sendingId === m.id
                      ? '⏳ Mengirim...'
                      : m.status === 'failed'
                        ? '↻ Coba Lagi'
                        : '➤ Kirim'}
                  </button>
                )}
              </div>
            );
          })}
          {!filteredMessages.length && (
            <div className="p-12 text-center text-stone-400">
              <div className="text-3xl mb-2">📭</div>
              Tidak ada pesan{filter !== 'all' ? ` "${filter}"` : ''}.
            </div>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block max-h-[600px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 sticky top-0 z-10 border-b border-stone-200">
              <tr>
                <th className="text-left p-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">Nama</th>
                <th className="text-left p-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">Nomor</th>
                <th className="text-left p-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left p-3 font-semibold text-stone-600 text-xs uppercase tracking-wide">Info</th>
                <th className="text-right p-3 font-semibold text-stone-600 text-xs uppercase tracking-wide w-32">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredMessages.map((m: any) => {
                const msgCfg = msgStatusConfig[m.status];
                return (
                  <tr key={m.id} className="border-t border-stone-100 hover:bg-stone-50/50 transition-colors">
                    <td className="p-3 font-medium text-stone-800">{m.name || '—'}</td>
                    <td className="p-3 font-mono text-xs text-stone-600">+{m.phone}</td>
                    <td className="p-3">
                      <span className={`badge ${msgCfg.color}`}>{msgCfg.label}</span>
                    </td>
                    <td className="p-3 text-xs text-stone-500">
                      {m.error ? (
                        <span className="text-red-600">⚠ {m.error}</span>
                      ) : m.sent_at ? (
                        new Date(m.sent_at).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {m.status === 'sent' ? (
                        <span className="text-xs text-emerald-600 font-medium">✓ Terkirim</span>
                      ) : (
                        <button
                          onClick={() => sendOne(m.id)}
                          disabled={sendingId === m.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
                        >
                          {sendingId === m.id
                            ? '⏳ Mengirim...'
                            : m.status === 'failed'
                              ? '↻ Coba Lagi'
                              : '➤ Kirim'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredMessages.length && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-stone-400">
                    <div className="text-3xl mb-2">📭</div>
                    Tidak ada pesan{filter !== 'all' ? ` dengan status "${filter}"` : ''}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      <ConfirmDialog
        open={confirmAction === 'run'}
        title="Mulai Blast Massal?"
        itemName={campaign.name}
        variant="info"
        icon="▶"
        description={
          <>
            Akan mengirim ke <strong>{stats.pending} nomor pending</strong> dengan jeda
            random 5-15 detik per pesan untuk hindari banned WhatsApp.
            <br />
            <span className="text-xs text-stone-500 mt-2 inline-block">
              Jangan tutup window saat blast jalan. Anda masih bisa hentikan kapan saja.
            </span>
          </>
        }
        confirmLabel="Ya, mulai blast"
        cancelLabel="Batal"
        loading={actionLoading}
        onConfirm={performRun}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction === 'cancel'}
        title="Batalkan Campaign?"
        itemName={campaign.name}
        variant="warning"
        icon="⏸"
        description={
          <>
            Campaign akan dihentikan. Pesan yang sudah terkirim tetap terkirim, tapi
            sisa pesan tidak akan dilanjutkan. Anda masih bisa kirim manual per nomor
            setelah ini.
          </>
        }
        confirmLabel="Ya, batalkan"
        cancelLabel="Lanjutkan"
        loading={actionLoading}
        onConfirm={performCancel}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction === 'delete'}
        title="Hapus Campaign Permanen?"
        itemName={campaign.name}
        description="Aksi ini tidak bisa dibatalkan."
        consequences={[
          'Semua data campaign (template, gambar, jadwal)',
          'Semua pesan & status pengiriman',
          'History tracking sent/failed/pending',
        ]}
        confirmLabel="Ya, hapus permanen"
        loading={actionLoading}
        onConfirm={performDelete}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
  icon,
  bg,
  onClick,
  active,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
  bg: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Wrapper: any = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`card p-5 text-left transition-all ${
        onClick ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : ''
      } ${active ? 'ring-2 ring-violet-500/40' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center text-lg`}>
          {icon}
        </div>
      </div>
      <div className="text-xs text-stone-500 uppercase tracking-wide font-medium">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
    </Wrapper>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-sm text-stone-800 font-medium">{value}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'text-violet-700'
          : 'text-stone-500 hover:text-stone-700'
      }`}
    >
      <span className="flex items-center gap-2">
        {label}
        {typeof count === 'number' && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full ${
              active ? 'bg-violet-100 text-violet-700' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {count}
          </span>
        )}
      </span>
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600" />
      )}
    </button>
  );
}
