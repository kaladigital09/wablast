'use client';
import useSWR from 'swr';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, fetcher } from '@/lib/api';
import { CardGridLoader, InlineLoader } from '../components/PageLoader';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import Select from '../components/Select';
import { useAuth } from '@/lib/auth';

function SessionsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const clientId = params.get('client_id');

  const { data: clients } = useSWR('/api/clients', fetcher);
  const { data: sessions, mutate, isLoading } = useSWR(
    clientId ? `/api/sessions?client_id=${clientId}` : '/api/sessions',
    fetcher,
    { refreshInterval: 3000 }
  );

  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState(clientId || '');
  const [label, setLabel] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string; status: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = user?.role === 'super_admin';

  async function performDeleteSession() {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await api(`/api/sessions/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      mutate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    if (clientId) setSelectedClient(clientId);
  }, [clientId]);

  // Auto-buka form kalau user datang dari halaman client (pasti mau tambah akun)
  useEffect(() => {
    if (clientId && (sessions?.length === 0 || !sessions?.some((s: any) => s.status === 'connected'))) {
      setShowForm(true);
    }
  }, [clientId, sessions]);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();

    // Untuk client_user: backend akan auto-isi client_id dari token
    // Untuk super_admin: wajib pilih client di dropdown
    const targetClientId =
      user?.role === 'client_user' ? user.client_id : selectedClient;

    if (user?.role === 'super_admin' && !selectedClient) {
      return alert('Pilih client dulu');
    }
    if (!label) return alert('Isi label akun (mis. "Nomor Utama")');

    try {
      const body: any = { label };
      if (targetClientId) body.client_id = targetClientId;

      const newSession: any = await api('/api/sessions', {
        method: 'POST',
        body,
      });
      setLabel('');
      setShowForm(false);
      mutate();
      // Auto-trigger start agar QR langsung muncul
      if (newSession?.id) {
        await api(`/api/sessions/${newSession.id}/start`, { method: 'POST' });
        mutate();
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function startSession(id: string) {
    await api(`/api/sessions/${id}/start`, { method: 'POST' });
    mutate();
  }

  async function stopSession(id: string) {
    if (!confirm('Logout akun WA ini?')) return;
    await api(`/api/sessions/${id}/stop`, { method: 'POST' });
    mutate();
  }

  const activeClient = clients?.find((c: any) => c.id === clientId);

  // Group sessions berdasarkan client (untuk view "Semua")
  const groupedByClient = !clientId
    ? (sessions || []).reduce((acc: any, s: any) => {
        const cid = s.client_id || '_orphan';
        const cname = s.clients?.name || 'Tanpa Client';
        if (!acc[cid]) acc[cid] = { name: cname, items: [], event_type: s.clients?.event_type };
        acc[cid].items.push(s);
        return acc;
      }, {})
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">Akun WhatsApp</h1>
          <p className="text-stone-500 mt-1 text-sm sm:text-base">
            {activeClient
              ? `Akun WA untuk: ${activeClient.name}`
              : 'Kelola akun WA yang dipakai untuk blast'}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm self-start">
          + Tambah Akun WA
        </button>
      </div>

      {/* Filter chip kalau lagi di-filter by client */}
      {activeClient && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-stone-500">Filter aktif:</span>
          <span className="inline-flex items-center gap-2 bg-violet-50 text-violet-700 text-sm font-medium px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
            {activeClient.name}
            <button
              onClick={() => router.push('/sessions')}
              className="hover:bg-violet-100 rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none"
              aria-label="Hapus filter"
            >
              ×
            </button>
          </span>
        </div>
      )}

      <FormDialog
        open={showForm}
        title="Tambah Akun WA"
        description="Setiap akun WA wajib terhubung ke 1 client"
        size="lg"
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={createSession} className="space-y-4">
          {(!clients || clients.length === 0) && user?.role === 'super_admin' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              ⚠ Belum ada client. Buat client dulu di menu{' '}
              <Link href="/clients" className="underline font-medium">
                Clients
              </Link>{' '}
              sebelum tambah akun WA.
            </div>
          )}

          {user?.role === 'super_admin' ? (
            <div>
              <label className="label">
                Pilih Client <span className="text-red-500">*</span>
              </label>
              <Select
                required
                value={selectedClient}
                onChange={setSelectedClient}
                disabled={!!clientId}
                searchable={(clients?.length ?? 0) > 5}
                placeholder="-- Pilih client --"
                options={(clients || []).map((c: any) => ({
                  value: c.id,
                  label: c.name,
                  description: c.event_type ? c.event_type.replace('_', ' ') : undefined,
                }))}
              />
              {clientId && (
                <p className="text-xs text-stone-500 mt-1">Pre-selected dari halaman client.</p>
              )}
            </div>
          ) : (
            <div className="bg-violet-50/50 border border-violet-100 rounded-lg p-3 text-sm">
              <span className="text-stone-500">Client: </span>
              <strong className="text-violet-700">
                {user?.client?.name || activeClient?.name || user?.full_name || 'Akun Anda'}
              </strong>
            </div>
          )}

          <div>
            <label className="label">
              Label Akun <span className="text-red-500">*</span>
            </label>
            <input
              required
              placeholder="mis. Nomor Utama, Nomor Backup"
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <p className="text-xs text-stone-500 mt-1">
              Buat penanda agar mudah dibedakan jika ada banyak akun.
            </p>
          </div>

          <div className="flex gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-secondary flex-1"
            >
              Batal
            </button>
            <button
              className="btn-primary flex-[1.5]"
              disabled={
                (user?.role === 'super_admin' && !selectedClient) || !label
              }
            >
              Tambah & Tampilkan QR
            </button>
          </div>
        </form>
      </FormDialog>

      {isLoading ? (
        <CardGridLoader count={3} />
      ) : (
        <>
          {!sessions?.length ? (
            <div className="card p-12 text-center">
              <div className="text-5xl mb-3 text-stone-300">◎</div>
              <p className="text-stone-500 font-medium">Belum ada akun WA</p>
              <p className="text-sm mt-1 text-stone-400">
                {activeClient
                  ? `Tambah akun WA untuk client "${activeClient.name}".`
                  : 'Tambah akun, lalu scan QR untuk login WhatsApp.'}
              </p>
            </div>
          ) : clientId ? (
            // Filter mode: flat grid
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sessions.map((s: any) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onStart={startSession}
                  onStop={stopSession}
                  onDelete={isAdmin ? (s: any) => setDeleteTarget({ id: s.id, label: s.label, status: s.status }) : undefined}
                />
              ))}
            </div>
          ) : (
            // All mode: grouped by client
            <div className="space-y-8">
              {Object.entries(groupedByClient || {}).map(([cid, group]: [string, any]) => (
                <div key={cid}>
                  <div className="flex items-center gap-3 mb-3">
                    <Link
                      href={cid !== '_orphan' ? `/sessions?client_id=${cid}` : '#'}
                      className="flex items-center gap-2 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                        {group.name?.[0]?.toUpperCase() || 'C'}
                      </div>
                      <div>
                        <h2 className="font-semibold text-stone-900 group-hover:text-violet-700 transition-colors text-sm">
                          {group.name}
                        </h2>
                        <p className="text-xs text-stone-500">
                          {group.items.length} akun
                          {group.event_type ? ` · ${group.event_type.replace('_', ' ')}` : ''}
                        </p>
                      </div>
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {group.items.map((s: any) => (
                      <SessionCard
                        key={s.id}
                        session={s}
                        onStart={startSession}
                        onStop={stopSession}
                        onDelete={
                          isAdmin
                            ? (s: any) =>
                                setDeleteTarget({
                                  id: s.id,
                                  label: s.label,
                                  status: s.status,
                                })
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus Akun WA?"
        itemName={deleteTarget?.label}
        description={
          deleteTarget?.status === 'connected'
            ? 'Akun akan otomatis logout dari WhatsApp dulu, lalu dihapus permanen.'
            : 'Akun akan dihapus permanen.'
        }
        consequences={[
          'Session login WhatsApp & token auth',
          'History koneksi (scan QR & logout)',
          'Akun ini tidak bisa dipakai untuk campaign baru',
        ]}
        confirmLabel="Ya, hapus akun"
        loading={actionLoading}
        onConfirm={performDeleteSession}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<InlineLoader />}>
      <SessionsContent />
    </Suspense>
  );
}

function SessionCard({ session, onStart, onStop, onDelete }: any) {
  const { data } = useSWR(`/api/sessions/${session.id}/qr`, fetcher, { refreshInterval: 2000 });

  const status = data?.status || session.status;
  const statusConfig: Record<string, { color: string; label: string; dot: string }> = {
    connected: { color: 'bg-emerald-50 text-emerald-700', label: 'Terhubung', dot: 'bg-emerald-500' },
    qr: { color: 'bg-amber-50 text-amber-700', label: 'Scan QR', dot: 'bg-amber-500 animate-pulse' },
    connecting: { color: 'bg-blue-50 text-blue-700', label: 'Menghubungkan', dot: 'bg-blue-500 animate-pulse' },
    disconnected: { color: 'bg-stone-100 text-stone-600', label: 'Terputus', dot: 'bg-stone-400' },
    logged_out: { color: 'bg-red-50 text-red-700', label: 'Logout', dot: 'bg-red-500' },
  };
  const cfg = statusConfig[status] || statusConfig.disconnected;

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white text-lg shadow-sm shrink-0">
            ◎
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-stone-900 truncate">{session.label}</div>
            <div className="text-xs text-stone-500 truncate">
              {session.phone_number ? `+${session.phone_number}` : 'Belum login'}
            </div>
          </div>
        </div>
        <span className={`badge ${cfg.color} shrink-0`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
          {cfg.label}
        </span>
      </div>

      {/* Client info — bukti session terhubung ke client */}
      {session.clients && (
        <Link
          href={`/sessions?client_id=${session.client_id}`}
          className="flex items-center gap-2 text-xs bg-stone-50 hover:bg-violet-50 px-3 py-2 rounded-lg transition-colors group"
        >
          <span className="text-stone-400">Client:</span>
          <span className="font-medium text-stone-700 group-hover:text-violet-700 truncate">
            {session.clients.name}
          </span>
          {session.clients.event_type && (
            <span className="ml-auto text-stone-400 capitalize">
              {session.clients.event_type.replace('_', ' ')}
            </span>
          )}
        </Link>
      )}

      {data?.qr && (
        <div className="bg-stone-50 rounded-lg p-4 text-center">
          <p className="text-xs text-stone-600 mb-3 leading-relaxed">
            Buka <strong>WhatsApp</strong> di HP →{' '}
            <strong>Settings → Linked Devices → Link a Device</strong>
          </p>
          <img src={data.qr} alt="QR" className="mx-auto w-48 h-48 rounded-lg bg-white p-2" />
        </div>
      )}

      <div className="flex gap-2">
        {status !== 'connected' && (
          <button onClick={() => onStart(session.id)} className="btn-primary flex-1 text-sm">
            {status === 'qr' ? '↻ Refresh QR' : '▶ Login'}
          </button>
        )}
        {status === 'connected' && (
          <button onClick={() => onStop(session.id)} className="btn-danger flex-1 text-sm">
            Logout
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(session)}
            className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Hapus akun WA"
            aria-label="Hapus"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
