'use client';
import useSWR from 'swr';
import { useState } from 'react';
import Link from 'next/link';
import { api, fetcher } from '@/lib/api';
import { CardGridLoader } from '../components/PageLoader';
import { PasswordReveal } from '../components/PasswordField';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import Select from '../components/Select';
import DatePicker from '../components/DatePicker';
import { useAuth } from '@/lib/auth';

const EVENT_TYPES = [
  { value: 'pernikahan', label: 'Pernikahan' },
  { value: 'ulang_tahun', label: 'Ulang Tahun' },
  { value: 'aqiqah', label: 'Aqiqah' },
  { value: 'lainnya', label: 'Lainnya' },
];

const EMPTY_FORM = {
  name: '',
  event_type: 'pernikahan',
  event_date: '',
  notes: '',
  contact_email: '',
  schedule_enabled: false,
  create_user: true,
  full_name: '',
};

export default function ClientsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const { data, mutate, isLoading } = useSWR('/api/clients', fetcher);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<{
    email: string;
    password: string;
    clientName: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result: any = await api('/api/clients', { method: 'POST', body: form });
      if (result.user) {
        setCredentialsModal({
          email: result.user.email,
          password: result.user.password,
          clientName: result.name,
        });
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      mutate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function performDelete() {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await api(`/api/clients/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      mutate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function performResetPassword() {
    if (!resetTarget) return;
    setActionLoading(true);
    try {
      const result: any = await api(`/api/clients/${resetTarget.id}/reset-password`, {
        method: 'POST',
      });
      const client = data?.find((c: any) => c.id === resetTarget.id);
      setCredentialsModal({
        email: client?.user_email || client?.contact_email || '',
        password: result.password,
        clientName: resetTarget.name,
      });
      setResetTarget(null);
      mutate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">Clients</h1>
          <p className="text-stone-500 mt-1 text-sm sm:text-base">
            Daftar klien yang Anda kelola
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm self-start">
            + Tambah Client
          </button>
        )}
      </div>

      {isLoading ? (
        <CardGridLoader count={6} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data || []).map((c: any) => (
            <Link
              href={`/clients/${c.id}`}
              key={c.id}
              className="card card-hover p-5 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  {c.name?.[0]?.toUpperCase() || 'C'}
                </div>
                <span className="text-stone-300 group-hover:text-violet-500 transition-colors">
                  →
                </span>
              </div>
              <h3 className="font-semibold text-stone-900 truncate">{c.name}</h3>
              <div className="text-xs text-stone-500 mt-1 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                  <span className="capitalize">{c.event_type?.replace('_', ' ')}</span>
                </div>
                {c.event_date && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-300"></span>
                    <span>
                      {new Date(c.event_date).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                {c.user_email && (
                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-stone-100">
                    <span>📧</span>
                    <span className="truncate">{c.user_email}</span>
                  </div>
                )}
                {c.schedule_enabled && (
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <span>⏰</span>
                    <span>Scheduler aktif</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
          {!data?.length && (
            <div className="col-span-full card p-12 text-center text-stone-400">
              <div className="text-5xl mb-3">◉</div>
              <p className="text-stone-500 font-medium">Belum ada client</p>
              <p className="text-sm mt-1">Klik "Tambah Client" untuk mulai.</p>
            </div>
          )}
        </div>
      )}

      {/* Popup Form Tambah Client */}
      <FormDialog
        open={showForm}
        title="Client Baru"
        description="Isi info client & opsional buatkan akun login"
        size="xl"
        onClose={() => !loading && setShowForm(false)}
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Nama Client / Pengantin *</label>
              <input
                required
                placeholder="mis. Andi & Sari"
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
                value={form.event_date}
                onChange={(v) => setForm({ ...form, event_date: v })}
                placeholder="Pilih tanggal acara"
              />
            </div>
            <div>
              <label className="label">Catatan</label>
              <input
                placeholder="Tempat, dll."
                className="input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t border-stone-100 pt-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.create_user}
                onChange={(e) => setForm({ ...form, create_user: e.target.checked })}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-stone-900 text-sm">
                  Buatkan akun login untuk client
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Client bisa login sendiri untuk scan QR & blast undangan. Password ditampilkan
                  sekali setelah disimpan.
                </p>
              </div>
            </label>
          </div>

          {form.create_user && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-violet-50/50 p-4 rounded-lg">
              <div>
                <label className="label">Email Login *</label>
                <input
                  type="email"
                  required
                  placeholder="andi.sari@gmail.com"
                  className="input"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Nama Lengkap (display)</label>
                <input
                  placeholder="(opsional, default: nama client)"
                  className="input"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
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
                      Client bisa atur jadwal blast otomatis. Default: harus jalankan manual.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={loading}
              className="btn-secondary flex-1"
            >
              Batal
            </button>
            <button disabled={loading} className="btn-primary flex-[1.5]">
              {loading ? 'Menyimpan...' : 'Simpan Client'}
            </button>
          </div>
        </form>
      </FormDialog>

      {/* Modal credentials */}
      {credentialsModal && (
        <CredentialsModal {...credentialsModal} onClose={() => setCredentialsModal(null)} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus Client?"
        itemName={deleteTarget?.name}
        description="Aksi ini tidak bisa dibatalkan."
        consequences={[
          'Akun login client (email & password)',
          'Semua akun WhatsApp & session yang terhubung',
          'Semua campaign dan history pengiriman',
        ]}
        confirmLabel="Ya, hapus permanen"
        loading={actionLoading}
        onConfirm={performDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!resetTarget}
        title="Reset Password?"
        itemName={resetTarget?.name}
        variant="warning"
        icon="🔑"
        description={
          <>
            Password lama akan tidak berlaku lagi. Password baru akan ditampilkan setelah reset
            — pastikan Anda copy & share ke client.
          </>
        }
        confirmLabel="Generate password baru"
        loading={actionLoading}
        onConfirm={performResetPassword}
        onCancel={() => setResetTarget(null)}
      />
    </div>
  );
}

function CredentialsModal({
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
          <h2 className="text-xl font-bold text-stone-900">Akun Login Client</h2>
          <p className="text-sm text-stone-500">Untuk: {clientName}</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          ⚠ <strong>Password ditampilkan sekali.</strong> Catat atau copy sekarang — tidak bisa
          dilihat lagi setelah modal ditutup. Kalau hilang, gunakan tombol reset password.
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
              Password
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
