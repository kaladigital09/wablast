'use client';
import useSWR from 'swr';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, fetcher } from '@/lib/api';
import { InlineLoader } from '../../components/PageLoader';
import Select from '../../components/Select';
import DateTimePicker from '../../components/DateTimePicker';
import { Spinner } from '../../components/PageLoader';
import { useAuth } from '@/lib/auth';

const DEFAULT_TEMPLATE = `Assalamualaikum Warahmatullahi Wabarakatuh

Tanpa mengurangi rasa hormat, perkenankan kami mengundang Bapak/Ibu/Saudara/i untuk menghadiri acara pernikahan kami.

Berikut link undangan kami, untuk info lengkap dari acara bisa kunjungi :

{link}

Merupakan suatu kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan untuk hadir dan memberikan doa restu.

Mohon maaf perihal undangan hanya di bagikan melalui pesan ini.

Terima kasih banyak atas perhatiannya.

Wassalamualaikum Warahmatullahi Wabarakatuh

Kami Yang Berbahagia,
{nama_client}`;

function NewCampaignContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const initialClient = params.get('client_id') || (user?.role === 'client_user' ? user.client_id || '' : '');

  const { data: clients } = useSWR('/api/clients', fetcher);
  const { data: config } = useSWR('/api/campaigns/config', fetcher);
  const maxRecipients = config?.max_recipients_per_campaign ?? 20;

  const [clientId, setClientId] = useState(initialClient);
  const { data: sessions } = useSWR(
    clientId ? `/api/sessions?client_id=${clientId}` : null,
    fetcher
  );

  const [form, setForm] = useState({
    name: '',
    session_id: '',
    base_url: '',
    query_param: 'to',
    template_text: DEFAULT_TEMPLATE,
    image_url: '',
    scheduled_at: '',
  });
  const [csv, setCsv] = useState<File | null>(null);
  const [csvRowCount, setCsvRowCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCsvChange(file: File | null) {
    setCsv(file);
    setCsvRowCount(null);
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((l) => l.trim());
      // Anggap baris pertama header
      const dataRows = Math.max(0, lines.length - 1);
      setCsvRowCount(dataRows);
    } catch {
      setCsvRowCount(null);
    }
  }

  const selectedClient = clients?.find((c: any) => c.id === clientId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !form.session_id || !csv) {
      return alert('Lengkapi client, akun WA, dan file CSV');
    }
    if (csvRowCount !== null && csvRowCount > maxRecipients) {
      return alert(
        `Maksimal ${maxRecipients} nomor per campaign untuk hindari banned WA.\n\nCSV Anda berisi ${csvRowCount} nomor — silakan pecah jadi beberapa batch.`
      );
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('client_id', clientId);
      fd.append('session_id', form.session_id);
      fd.append('name', form.name);
      fd.append('template_text', form.template_text);
      if (form.base_url) {
        const sep = form.base_url.includes('?') ? '&' : '?';
        const fullLink = `${form.base_url}${sep}${form.query_param || 'to'}=`;
        fd.append('invitation_link', fullLink);
      }
      if (form.image_url) fd.append('image_url', form.image_url);
      if (form.scheduled_at) fd.append('scheduled_at', new Date(form.scheduled_at).toISOString());
      fd.append('csv', csv);

      const result = await api('/api/campaigns', { method: 'POST', body: fd });
      // Sukses: TIDAK reset loading. Biarkan overlay tetap tampil sampai page berganti.
      router.push(`/campaigns/${result.id}`);
    } catch (err: any) {
      alert(err.message);
      setLoading(false); // Reset hanya saat error
    }
  }

  // Live preview
  const previewName = 'Budi Santoso';
  const previewLink = form.base_url
    ? `${form.base_url}${form.base_url.includes('?') ? '&' : '?'}${form.query_param || 'to'}=${encodeURIComponent(previewName)}`
    : '[link undangan]';
  const previewText = form.template_text
    .replace(/{nama}/g, previewName)
    .replace(/{nama_client}/g, selectedClient?.name || '[Nama Client]')
    .replace(/{link}/g, previewLink);

  return (
    <div className="space-y-6">
      {loading && <SaveOverlay />}
      <div>
        <button onClick={() => router.back()} className="text-sm text-stone-500 hover:text-stone-700 mb-2">
          ← Kembali
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">Buat Campaign Baru</h1>
        <p className="text-stone-500 mt-1 text-sm sm:text-base">
          Setup blast undangan untuk client Anda
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={submit} className="lg:col-span-2 space-y-5 order-2 lg:order-1">
          <div className="card p-4 sm:p-6 space-y-5">
            <SectionTitle num="1" title="Pilih Client & Akun WA" />

            <Field label="Client">
              <Select
                required
                value={clientId}
                onChange={setClientId}
                disabled={user?.role === 'client_user'}
                searchable={(clients?.length ?? 0) > 5}
                placeholder="Pilih client..."
                options={(clients || []).map((c: any) => ({
                  value: c.id,
                  label: c.name,
                }))}
              />
              {user?.role === 'client_user' && (
                <p className="text-xs text-stone-500 mt-1">
                  Campaign otomatis terhubung ke akun Anda.
                </p>
              )}
            </Field>

            <Field label="Akun WA Pengirim">
              <Select
                required
                value={form.session_id}
                onChange={(v) => setForm({ ...form, session_id: v })}
                disabled={!clientId}
                placeholder="Pilih akun..."
                options={(sessions || [])
                  .filter((s: any) => s.status === 'connected')
                  .map((s: any) => ({
                    value: s.id,
                    label: s.label,
                    description: s.phone_number ? `+${s.phone_number}` : undefined,
                  }))}
              />
              {clientId && !(sessions || []).some((s: any) => s.status === 'connected') && (
                <p className="text-xs text-amber-600 mt-1.5">
                  ⚠ Belum ada akun WA terhubung. Tambahkan & login akun dulu di menu Akun WA.
                </p>
              )}
            </Field>
          </div>

          <div className="card p-4 sm:p-6 space-y-5">
            <SectionTitle num="2" title="Detail Campaign" />

            <Field label="Nama Campaign">
              <input
                required
                className="input"
                placeholder="mis. Undangan Andi & Sari — Batch 1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>

            <Field label="Link Undangan">
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="url"
                  placeholder="https://undangan.com/andi-sari"
                  className="input flex-1 min-w-[200px]"
                  value={form.base_url}
                  onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <span className="text-stone-400 font-mono">?</span>
                  <input
                    type="text"
                    disabled
                    className="input w-16 bg-stone-100 text-stone-500 cursor-not-allowed text-center"
                    value={form.query_param}
                  />
                  <span className="text-stone-400 font-mono">=</span>
                  <span className="text-stone-400 italic text-xs whitespace-nowrap">[nama]</span>
                </div>
              </div>
              {form.base_url && (
                <div className="mt-2 bg-violet-50 border border-violet-100 rounded-lg p-2.5 text-xs">
                  <span className="text-violet-700 font-medium">Preview:</span>{' '}
                  <code className="text-violet-900 break-all">{previewLink}</code>
                </div>
              )}
            </Field>

            <Field label="URL Gambar Undangan (opsional)">
              <input
                type="url"
                placeholder="https://..."
                className="input"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
            </Field>

            {user?.role !== 'client_user' && (
              <Field label="Jadwal Kirim (opsional)">
                <DateTimePicker
                  value={form.scheduled_at}
                  onChange={(v) => setForm({ ...form, scheduled_at: v })}
                  placeholder="Pilih tanggal & jam kirim"
                  minNow
                />
                <p className="text-xs text-stone-500 mt-1">
                  Kosongkan untuk simpan sebagai draft, lalu kirim manual.
                </p>
              </Field>
            )}
          </div>

          <div className="card p-4 sm:p-6 space-y-5">
            <SectionTitle num="3" title="Template Pesan" />

            <Field label="Pesan WhatsApp">
              <textarea
                required
                rows={12}
                className="input font-mono text-sm leading-relaxed"
                value={form.template_text}
                onChange={(e) => setForm({ ...form, template_text: e.target.value })}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                <VarChip label="{nama}" desc="Nama tamu" />
                <VarChip label="{link}" desc="Link undangan + nama" />
                <VarChip label="{nama_client}" desc="Nama client/pengantin" />
              </div>
            </Field>
          </div>

          <div className="card p-4 sm:p-6 space-y-5">
            <SectionTitle num="4" title="Daftar Tamu (CSV)" />

            <div className="flex items-center gap-3 p-4 bg-stone-50 rounded-lg border border-stone-200">
              <div className="text-2xl">📄</div>
              <div className="flex-1">
                <div className="font-medium text-stone-900 text-sm">Belum punya format?</div>
                <div className="text-xs text-stone-500">
                  Download template CSV dengan kolom phone & name siap pakai.
                </div>
              </div>
              <a
                href="/templates/template-tamu.csv"
                download="template-tamu.csv"
                className="btn-secondary text-sm"
              >
                ⬇ Download
              </a>
            </div>

            <Field label="Upload File CSV">
              <input
                required
                type="file"
                accept=".csv"
                onChange={(e) => handleCsvChange(e.target.files?.[0] || null)}
                className="block w-full text-sm text-stone-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 file:cursor-pointer cursor-pointer"
              />
              <div className="mt-1.5 text-xs text-stone-500 flex items-center gap-1.5">
                <span>
                  Kolom <code className="bg-stone-100 px-1 rounded">phone</code> (wajib) &{' '}
                  <code className="bg-stone-100 px-1 rounded">name</code>.
                </span>
                <span className="text-amber-600 font-medium">
                  Maksimal {maxRecipients} nomor per campaign.
                </span>
              </div>
              {csv && csvRowCount !== null && (
                <div
                  className={`mt-2 text-xs px-3 py-2 rounded-lg flex items-start gap-2 ${
                    csvRowCount > maxRecipients
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}
                >
                  {csvRowCount > maxRecipients ? (
                    <>
                      <span className="text-base leading-none">⚠</span>
                      <div>
                        <div className="font-semibold">
                          Terlalu banyak nomor: {csvRowCount} / {maxRecipients}
                        </div>
                        <div className="mt-0.5">
                          Pecah CSV jadi beberapa batch (maks {maxRecipients} per file). Ini untuk
                          melindungi akun WA dari banned.
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-base leading-none">✓</span>
                      <div>
                        File: <strong>{csv.name}</strong> · <strong>{csvRowCount}</strong> nomor
                        terdeteksi · {(csv.size / 1024).toFixed(1)} KB
                      </div>
                    </>
                  )}
                </div>
              )}
            </Field>
          </div>

          {/* Spacer untuk mobile agar konten terakhir tidak ketutup fixed save bar */}
          <div className="h-32 lg:hidden" />

          {/* Save bar — fixed di atas bottom nav (mobile), sticky di desktop */}
          <div className="fixed bottom-16 left-0 right-0 z-20 bg-white border-t border-stone-200 p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:static lg:bottom-auto lg:border lg:rounded-xl lg:shadow-lg lg:p-4 lg:sticky lg:bottom-4">
            <div className="flex gap-3 max-w-7xl mx-auto">
              <button
                type="button"
                onClick={() => router.back()}
                className="btn-secondary flex-1"
              >
                Batal
              </button>
              <button
                disabled={loading || (csvRowCount !== null && csvRowCount > maxRecipients)}
                className="btn-primary flex-[2]"
              >
                {loading
                  ? 'Menyimpan...'
                  : csvRowCount !== null && csvRowCount > maxRecipients
                    ? `⚠ Maksimal ${maxRecipients} nomor`
                    : '💾 Simpan Campaign'}
              </button>
            </div>
          </div>
        </form>

        {/* Live Preview */}
        <aside className="lg:col-span-1 order-1 lg:order-2">
          <div className="lg:sticky lg:top-4 space-y-3">
            <div className="text-sm font-semibold text-stone-700 px-1">📱 Preview Pesan</div>
            <div className="rounded-2xl bg-gradient-to-b from-emerald-100 to-emerald-50 p-3 border border-emerald-200/50">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 pb-3 border-b border-stone-100 mb-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                    {selectedClient?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-stone-900">
                      {selectedClient?.name || 'Pilih client dulu'}
                    </div>
                    <div className="text-[10px] text-stone-400">via Kala Blast</div>
                  </div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-xs whitespace-pre-wrap leading-relaxed text-stone-800 max-h-[500px] overflow-y-auto">
                  {previewText}
                </div>
                <div className="text-[10px] text-stone-400 mt-2 text-right">
                  Pratinjau untuk <strong>{previewName}</strong>
                </div>
              </div>
            </div>
            <p className="text-xs text-stone-400 px-1 leading-relaxed">
              Pratinjau diperbarui otomatis. Pesan akan dikirim sesuai data tiap tamu di CSV.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<InlineLoader />}>
      <NewCampaignContent />
    </Suspense>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function SectionTitle({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-stone-100">
      <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm">
        {num}
      </div>
      <h2 className="font-semibold text-stone-900">{title}</h2>
    </div>
  );
}

function VarChip({ label, desc }: { label: string; desc: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs px-2.5 py-1 rounded-md transition-colors cursor-help"
      title={desc}
    >
      <code className="font-mono">{label}</code>
      <span className="text-stone-400 text-[10px]">{desc}</span>
    </span>
  );
}

function SaveOverlay() {
  // Lock body scroll & block ESC selama save
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const blockEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const blockUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('keydown', blockEscape, { capture: true });
    window.addEventListener('beforeunload', blockUnload);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', blockEscape, { capture: true } as any);
      window.removeEventListener('beforeunload', blockUnload);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-[calc(100%-2rem)] text-center space-y-4 animate-fade-in">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-violet-50 mb-1">
          <Spinner size="lg" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-stone-900">Menyimpan campaign...</h3>
          <p className="text-sm text-stone-500 mt-1">
            Mengupload CSV & menyimpan data. Mohon tunggu, jangan tutup halaman.
          </p>
        </div>
        <div className="bg-stone-50 rounded-lg px-3 py-2 text-xs text-stone-600">
          ⏳ Anda akan otomatis diarahkan ke halaman campaign setelah selesai.
        </div>
      </div>
    </div>
  );
}
