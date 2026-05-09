'use client';
import { use, useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, fetcher } from '@/lib/api';
import PageLoader from '../../components/PageLoader';
import ConfirmDialog from '../../components/ConfirmDialog';
import { PasswordReveal } from '../../components/PasswordField';
import Select from '../../components/Select';
import DatePicker from '../../components/DatePicker';
import { useAuth } from '@/lib/auth';

const EVENT_TYPES = [
  { value: 'pernikahan', label: 'Pernikahan' },
  { value: 'ulang_tahun', label: 'Ulang Tahun' },
  { value: 'aqiqah', label: 'Aqiqah' },
  { value: 'lainnya', label: 'Lainnya' },
];

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const { data, mutate, isLoading } = useSWR(`/api/clients/${id}/full`, fetcher);

  const [form, setForm] = useState({
    name: '',
    event_type: 'pernikahan',
    event_date: '',
    notes: '',
    contact_email: '',
    schedule_enabled: false,
    full_name: '',
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<{
    email: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name || '',
      event_type: data.event_type || 'pernikahan',
      event_date: data.event_date || '',
      notes: data.notes || '',
      contact_email: data.user_email || data.contact_email || '',
      schedule_enabled: !!data.schedule_enabled,
      full_name: data.user_full_name || data.full_name || '',
    });
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/api/clients/${id}`, { method: 'PATCH', body: form });
      setSavedAt(Date.now());
      // Optimistic update — set user_full_name di cache supaya langsung tampil
      // tanpa nunggu re-fetch (yang bisa miss kalau view DB belum ke-update)
      mutate(
        (current: any) => ({
          ...current,
          ...form,
          user_full_name: form.full_name,
        }),
        { revalidate: true }
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function performReset() {
    setActionLoading(true);
    try {
      const result: any = await api(`/api/clients/${id}/reset-password`, { method: 'POST' });
      setCredentialsModal({
        email: form.contact_email,
        password: result.password,
      });
      setResetOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function performDelete() {
    setActionLoading(true);
    try {
      await api(`/api/clients/${id}`, { method: 'DELETE' });
      router.push('/clients');
    } catch (err: any) {
      alert(err.message);
      setActionLoading(false);
    }
  }

  if (isLoading || !data) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/clients"
          className="text-sm text-stone-500 hover:text-stone-700 inline-flex items-center gap-1 mb-3"
        >
          ← Kembali ke Clients
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white font-bold text-xl shadow-sm">
              {data.name?.[0]?.toUpperCase() || 'C'}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 truncate">
                {data.name}
              </h1>
              <p className="text-stone-500 text-sm">
                {data.user_email ? (
                  <>
                    {data.user_full_name && (
                      <span className="font-medium text-stone-700">{data.user_full_name}</span>
                    )}
                    {data.user_full_name && ' · '}
                    <span>{data.user_email}</span>
                  </>
                ) : (
                  'Tidak ada akun login terhubung'
                )}
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link href={`/sessions?client_id=${id}`} className="btn-secondary text-sm">
              Akun WA
            </Link>
            <Link href={`/campaigns?client_id=${id}`} className="btn-secondary text-sm">
              Campaigns
            </Link>
          </div>
        </div>
      </div>

      <form onSubmit={save} className="card p-5 sm:p-6 space-y-5">
        <h2 className="font-semibold text-stone-900 pb-3 border-b border-stone-100">
          Info Client
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Nama Client / Pengantin *</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Jenis Event</label>
            <Select
              value={form.event_type}
              onChange={(v) => setForm({ ...form, event_type: v })}
              options={EVENT_TYPES}
            />
          </div>
          <div>
            <label className="label">Tanggal Acara</label>
            <DatePicker
              value={form.event_date || ''}
              onChange={(v) => setForm({ ...form, event_date: v })}
              placeholder="Pilih tanggal acara"
            />
          </div>
          <div>
            <label className="label">Catatan</label>
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        {/* Section akun login — hanya kalau ada user_id atau admin */}
        {(data.user_id || isAdmin) && (
          <div className="border-t border-stone-100 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-stone-900 text-sm">Akun Login</h3>
              {data.user_id && (
                <span className="badge bg-emerald-50 text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Aktif
                </span>
              )}
            </div>

            {data.user_id ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">
                      Email Login {isAdmin && '*'}
                    </label>
                    <input
                      type="email"
                      required={isAdmin}
                      disabled={!isAdmin}
                      className="input disabled:bg-stone-50 disabled:text-stone-500"
                      value={form.contact_email}
                      onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    />
                    {!isAdmin && (
                      <p className="text-xs text-stone-500 mt-1">
                        Email tidak bisa diubah. Hubungi admin untuk ganti email.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">Nama Lengkap</label>
                    <input
                      className="input"
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    />
                  </div>
                </div>

                {isAdmin && (
                  <div className="bg-violet-50/50 border border-violet-100 rounded-lg p-4 space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.schedule_enabled}
                        onChange={(e) => setForm({ ...form, schedule_enabled: e.target.checked })}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-stone-900 text-sm">
                          Izinkan fitur scheduler
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">
                          Client bisa atur jadwal blast otomatis. Default: jalankan manual saja.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                Client ini belum punya akun login. Anda perlu hapus & buat ulang via halaman
                Clients dengan opsi "Buatkan akun login".
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            ⚠ {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-stone-100">
          <div className="text-xs text-stone-500">
            {savedAt && Date.now() - savedAt < 3000 ? '✓ Tersimpan' : ''}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push('/clients')}
              className="btn-secondary"
            >
              Batal
            </button>
            <button disabled={saving} className="btn-primary">
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </form>

      {/* Danger zone — admin only */}
      {isAdmin && (
        <div className="card p-5 sm:p-6 border-red-100 space-y-4">
          <h2 className="font-semibold text-red-900">⚠ Zona Berbahaya</h2>

          {data.user_id && (
            <div className="flex items-center justify-between gap-3 flex-wrap p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="min-w-0">
                <div className="font-medium text-stone-900 text-sm">Reset Password Client</div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Generate password baru. Password lama tidak bisa dipakai lagi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 rounded-lg text-sm shrink-0"
              >
                🔑 Reset Password
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="min-w-0">
              <div className="font-medium text-stone-900 text-sm">Hapus Client Permanen</div>
              <p className="text-xs text-stone-500 mt-0.5">
                Akun login, sessions WA, & semua campaign akan ikut terhapus.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg text-sm shrink-0"
            >
              🗑 Hapus
            </button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={resetOpen}
        title="Reset Password?"
        itemName={data.name}
        variant="warning"
        icon="🔑"
        description="Password lama akan tidak berlaku. Password baru ditampilkan sekali setelah reset — pastikan copy & share ke client."
        confirmLabel="Generate password baru"
        loading={actionLoading}
        onConfirm={performReset}
        onCancel={() => setResetOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Hapus Client Permanen?"
        itemName={data.name}
        description="Aksi ini tidak bisa dibatalkan."
        consequences={[
          'Akun login client (email & password)',
          'Semua akun WhatsApp & session yang terhubung',
          'Semua campaign dan history pengiriman',
        ]}
        confirmLabel="Ya, hapus permanen"
        loading={actionLoading}
        onConfirm={performDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      {credentialsModal && (
        <ResetCredsModal
          {...credentialsModal}
          clientName={data.name}
          onClose={() => setCredentialsModal(null)}
        />
      )}
    </div>
  );
}

function ResetCredsModal({
  email,
  password,
  clientName,
  onClose,
}: {
  email: string;
  password: string;
  clientName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const text = `Kala Blast — Akun untuk ${clientName}\n\nEmail: ${email}\nPassword: ${password}\n\nLogin di: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-violet-50 mb-2">
            <span className="text-3xl">🔐</span>
          </div>
          <h2 className="text-xl font-bold text-stone-900">Password Baru Dibuat</h2>
          <p className="text-sm text-stone-500">Untuk: {clientName}</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          ⚠ <strong>Ditampilkan sekali.</strong> Copy sekarang sebelum tutup modal.
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Email
            </label>
            <div className="font-mono text-sm bg-stone-50 px-3 py-2.5 rounded-lg border border-stone-200 mt-1">
              {email}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Password Baru
            </label>
            <div className="mt-1">
              <PasswordReveal value={password} />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={copy} className="btn-secondary flex-1">
            {copied ? '✓ Tersalin!' : '📋 Copy semua'}
          </button>
          <button onClick={onClose} className="btn-primary flex-1">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
