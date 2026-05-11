'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, fetcher } from '@/lib/api';
import { TableLoader, InlineLoader } from '../components/PageLoader';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '@/lib/auth';

const statusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: 'bg-stone-100 text-stone-700', label: 'Draft' },
  scheduled: { color: 'bg-blue-50 text-blue-700', label: 'Terjadwal' },
  queued: { color: 'bg-purple-50 text-purple-700', label: 'Antri' },
  running: { color: 'bg-amber-50 text-amber-700', label: 'Berjalan' },
  completed: { color: 'bg-emerald-50 text-emerald-700', label: 'Selesai' },
  cancelled: { color: 'bg-red-50 text-red-700', label: 'Dibatalkan' },
  paused_limit: { color: 'bg-orange-50 text-orange-700', label: 'Limit harian' },
};

function CampaignsContent() {
  const params = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';
  const clientId = params.get('client_id');
  const url = clientId ? `/api/campaigns?client_id=${clientId}` : '/api/campaigns';
  const { data, isLoading, mutate } = useSWR(url, fetcher, {
    // Polling cuma saat ada campaign yang aktif (running/scheduled/queued).
    // Status final (draft/completed/cancelled/paused_limit) tidak perlu polling.
    refreshInterval: (latest) =>
      latest?.some((c: any) =>
        ['running', 'scheduled', 'queued'].includes(c.status)
      )
        ? 5000
        : 0,
  });

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  function askDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget({ id, name });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/campaigns/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      mutate();
    } catch (err: any) {
      alert('Gagal hapus: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">Campaigns</h1>
          <p className="text-stone-500 mt-1 text-sm sm:text-base">
            Daftar campaign blast undangan
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/templates/template-tamu.csv"
            download="template-tamu.csv"
            className="btn-secondary text-sm"
          >
            ⬇ Template CSV
          </a>
          <Link
            href={`/campaigns/new${clientId ? `?client_id=${clientId}` : ''}`}
            className="btn-primary text-sm"
          >
            + Buat Campaign
          </Link>
        </div>
      </div>

      {isLoading ? (
        <TableLoader rows={5} />
      ) : (
      <>
      {/* Mobile: card list */}
      <div className="space-y-3 sm:hidden">
        {(data || []).map((c: any) => {
          const cfg = statusConfig[c.status] || statusConfig.draft;
          return (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="card p-4 flex items-center gap-3 active:bg-stone-50"
            >
              <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center font-semibold text-sm shrink-0">
                {c.name?.[0]?.toUpperCase() || 'C'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-stone-900 truncate">{c.name}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`badge ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-xs text-stone-500">
                    {c.total_recipients} penerima
                  </span>
                </div>
              </div>
              {isAdmin ? (
                <button
                  onClick={(e) => askDelete(e, c.id, c.name)}
                  className="text-stone-400 hover:text-red-600 p-2 -m-2"
                  title="Hapus"
                  aria-label="Hapus"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
                  </svg>
                </button>
              ) : (
                <svg className="text-violet-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </Link>
          );
        })}
        {!data?.length && (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-3 text-stone-300">◇</div>
            <p className="text-stone-500 font-medium">Belum ada campaign</p>
            <p className="text-sm text-stone-400 mt-1">
              Klik "+ Buat Campaign" untuk mulai blast.
            </p>
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="card overflow-hidden hidden sm:block">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="text-left p-4 font-semibold text-stone-600 text-xs uppercase tracking-wide">Nama</th>
              <th className="text-left p-4 font-semibold text-stone-600 text-xs uppercase tracking-wide">Status</th>
              <th className="text-left p-4 font-semibold text-stone-600 text-xs uppercase tracking-wide">Penerima</th>
              {isAdmin && (
                <th className="text-left p-4 font-semibold text-stone-600 text-xs uppercase tracking-wide">Jadwal</th>
              )}
              <th className="text-right p-4 font-semibold text-stone-600 text-xs uppercase tracking-wide">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((c: any) => {
              const cfg = statusConfig[c.status] || statusConfig.draft;
              return (
                <tr key={c.id} className="border-t border-stone-100 hover:bg-stone-50/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center font-semibold text-sm">
                        {c.name?.[0]?.toUpperCase() || 'C'}
                      </div>
                      <div className="font-medium text-stone-900">{c.name}</div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`badge ${cfg.color}`}>{cfg.label}</span>
                  </td>
                  <td className="p-4 text-stone-600">{c.total_recipients}</td>
                  {isAdmin && (
                    <td className="p-4 text-stone-500 text-xs">
                      {c.scheduled_at
                        ? new Date(c.scheduled_at).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  )}
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="p-2 text-violet-600 hover:text-violet-700 hover:bg-violet-50 rounded-md transition-colors"
                        title="Lihat detail"
                        aria-label="Detail"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </Link>
                      {isAdmin && (
                        <button
                          onClick={(e) => askDelete(e, c.id, c.name)}
                          className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Hapus"
                          aria-label="Hapus"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!data?.length && (
              <tr>
                <td colSpan={5} className="p-12 text-center">
                  <div className="text-5xl mb-3 text-stone-300">◇</div>
                  <p className="text-stone-500 font-medium">Belum ada campaign</p>
                  <p className="text-sm text-stone-400 mt-1">
                    Klik "+ Buat Campaign" untuk mulai blast undangan.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus Campaign"
        itemName={deleteTarget?.name}
        description="Aksi ini tidak bisa dibatalkan."
        consequences={[
          'Semua data campaign (template, gambar, jadwal)',
          'Semua pesan & status pengiriman',
          'History tracking sent/failed',
        ]}
        confirmLabel="Ya, hapus permanen"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<InlineLoader />}>
      <CampaignsContent />
    </Suspense>
  );
}
