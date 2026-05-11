'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import PageLoader from '../components/PageLoader';

export default function PanduanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== 'client_user') {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading || !user) return <PageLoader />;
  if (user.role !== 'client_user') return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-white text-2xl shadow-lg">
          📖
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-stone-900">
          Selamat Datang di Kala Blast
        </h1>
        <p className="text-stone-600 max-w-xl mx-auto leading-relaxed">
          Panduan singkat agar Anda bisa kirim undangan WhatsApp ke ratusan tamu
          dengan rapi & otomatis. Ikuti 4 langkah mudah di bawah ini.
        </p>
      </div>

      {/* Quick Start Steps */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-stone-900">Mulai Cepat</h2>
          <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-medium">
            4 Langkah
          </span>
        </div>

        <Step
          number={1}
          title="Hubungkan Akun WhatsApp"
          description="Login WhatsApp Anda ke sistem dengan scan QR — cukup sekali."
          actionLabel="Buka Akun WA"
          actionHref="/sessions"
        >
          <ol className="text-sm text-stone-700 space-y-2 list-decimal list-inside">
            <li>
              Buka menu <strong>Akun WA</strong> di sidebar.
            </li>
            <li>
              Klik tombol <strong>+ Tambah Akun WA</strong>.
            </li>
            <li>
              Beri label, mis. <em>"Nomor Utama"</em>, lalu klik{' '}
              <strong>Tambah &amp; Tampilkan QR</strong>.
            </li>
            <li>
              Di HP, buka WhatsApp →{' '}
              <strong>Perangkat Tertaut → Tautkan Perangkat</strong> → scan QR di layar.
            </li>
            <li>
              Tunggu status berubah jadi <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Terhubung</span>.
            </li>
          </ol>
          <Tip>
            Pakai nomor WhatsApp yang <strong>tidak terlalu aktif untuk chat
            personal</strong>. Nomor baru atau jarang dipakai lebih rentan
            di-banned WhatsApp.
          </Tip>
        </Step>

        <Step
          number={2}
          title="Siapkan Data Tamu (file CSV)"
          description="Buat daftar nomor & nama tamu yang akan dikirimi undangan."
        >
          <ol className="text-sm text-stone-700 space-y-2 list-decimal list-inside">
            <li>
              Di menu <strong>Campaigns</strong>, klik tombol{' '}
              <strong>⬇ Template CSV</strong> untuk download contoh file.
            </li>
            <li>
              Buka file CSV di Excel / Google Sheets. Isi 2 kolom utama:{' '}
              <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">phone</code>{' '}
              dan{' '}
              <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">name</code>.
            </li>
            <li>
              Format nomor:{' '}
              <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">081234567890</code>{' '}
              atau{' '}
              <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">6281234567890</code>.
              Sistem akan otomatis rapikan.
            </li>
            <li>
              Save file dengan format <strong>CSV (Comma delimited)</strong>.
            </li>
            <li>
              Maksimal <strong>20 tamu per campaign</strong> (anti-banned).
              Punya 100 tamu? Bagi jadi 5 campaign.
            </li>
          </ol>
          <Tip>
            Kolom tambahan boleh ditambah (mis. <code>link</code>), nanti bisa
            dipakai di template pesan dengan <code>{'{nama_kolom}'}</code>.
          </Tip>
        </Step>

        <Step
          number={3}
          title="Buat & Jalankan Campaign Blast"
          description="Tulis template pesan, upload CSV, lalu kirim."
          actionLabel="Buat Campaign"
          actionHref="/campaigns/new"
        >
          <ol className="text-sm text-stone-700 space-y-2 list-decimal list-inside">
            <li>
              Menu <strong>Campaigns</strong> → klik{' '}
              <strong>+ Buat Campaign</strong>.
            </li>
            <li>Pilih akun WhatsApp yang sudah terhubung.</li>
            <li>
              Tulis template pesan. Gunakan variabel berikut yang akan
              auto-diisi:
              <ul className="ml-5 mt-1.5 space-y-1 list-disc text-stone-600">
                <li>
                  <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">
                    {'{nama}'}
                  </code>{' '}
                  → nama tamu dari CSV
                </li>
                <li>
                  <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">
                    {'{nama_client}'}
                  </code>{' '}
                  → nama event Anda
                </li>
                <li>
                  <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">
                    {'{link}'}
                  </code>{' '}
                  → link undangan (jika ada di CSV)
                </li>
              </ul>
            </li>
            <li>
              Upload <strong>foto undangan</strong> (opsional, akan dikirim
              bersama pesan).
            </li>
            <li>
              Upload <strong>file CSV</strong> data tamu yang sudah disiapkan.
            </li>
            <li>
              Klik <strong>Simpan</strong>, lalu pilih:
              <ul className="ml-5 mt-1.5 space-y-1 list-disc text-stone-600">
                <li>
                  <strong>Jalankan Massal</strong> → kirim semua langsung
                </li>
                <li>
                  <strong>Jadwalkan</strong> → atur tanggal & jam pengiriman
                </li>
              </ul>
            </li>
          </ol>
          <Tip>
            Contoh template:{' '}
            <em>
              "Halo {'{nama}'}, kami {'{nama_client}'} mengundang Anda di acara
              pernikahan kami. Detail: {'{link}'}. Mohon doa &amp; kehadirannya
              🙏"
            </em>
          </Tip>
        </Step>

        <Step
          number={4}
          title="Pantau Hasil Blast"
          description="Lihat progres real-time & retry pesan yang gagal."
          actionLabel="Lihat Campaigns"
          actionHref="/campaigns"
        >
          <ol className="text-sm text-stone-700 space-y-2 list-decimal list-inside">
            <li>
              Klik nama campaign untuk masuk ke halaman detail.
            </li>
            <li>
              Lihat <strong>statistik</strong>: total terkirim, pending, gagal.
            </li>
            <li>
              Tabel pesan per tamu — status update otomatis:
              <ul className="ml-5 mt-1.5 space-y-1 text-stone-600">
                <li>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-stone-100 rounded text-xs font-medium">
                    Pending
                  </span>{' '}
                  → menunggu dikirim
                </li>
                <li>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">
                    Terkirim
                  </span>{' '}
                  → sudah berhasil sampai
                </li>
                <li>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-xs font-medium">
                    Gagal
                  </span>{' '}
                  → ada masalah (nomor salah, dll)
                </li>
              </ul>
            </li>
            <li>
              Pesan gagal bisa <strong>dikirim ulang manual</strong> (klik
              tombol per baris).
            </li>
          </ol>
        </Step>
      </section>

      {/* Anti-Banned Tips */}
      <section className="card p-6 bg-gradient-to-br from-amber-50 to-white border-amber-200">
        <div className="flex items-start gap-3 mb-3">
          <div className="text-2xl">🛡️</div>
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              Tips Anti-Banned WhatsApp
            </h2>
            <p className="text-sm text-stone-600">
              WhatsApp tidak suka spam — ikuti tips ini agar akun aman.
            </p>
          </div>
        </div>
        <ul className="space-y-2 text-sm text-stone-700">
          <BulletTip>
            Pakai nomor WA yang <strong>sudah aktif minimal 3 bulan</strong>,
            bukan nomor baru bikin.
          </BulletTip>
          <BulletTip>
            Sebelum blast pertama, kirim manual ke <strong>10-20 nomor</strong>{' '}
            dulu (warm up). Bisa kirim ke nomor teman/keluarga.
          </BulletTip>
          <BulletTip>
            Sistem otomatis batasi maksimal <strong>300 pesan per hari per akun</strong>.
            Jangan paksakan lebih.
          </BulletTip>
          <BulletTip>
            Antar pesan ada <strong>jeda acak 5-15 detik</strong> — supaya tidak
            terdeteksi bot.
          </BulletTip>
          <BulletTip>
            Variasikan template pesan untuk batch berbeda. Pesan plek-ketiplek
            ke ribuan nomor = red flag.
          </BulletTip>
          <BulletTip>
            Hindari konten provokatif, judi, penipuan — auto-banned WhatsApp.
          </BulletTip>
        </ul>
      </section>

      {/* Troubleshoot */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
          🔧 Troubleshoot Cepat
        </h2>
        <div className="space-y-2">
          <Faq
            q="QR tidak muncul saat tambah akun WA"
            a="Tutup modal, klik tombol Mulai di card akun WA tersebut. Tunggu 5-10 detik. Kalau masih tidak muncul, refresh halaman."
          />
          <Faq
            q="Akun WA tiba-tiba Terputus / Logout"
            a="Klik tombol Mulai di card akun WA — biasanya auto-reconnect. Kalau tetap putus, hapus & tambah ulang akun WA (perlu scan QR baru)."
          />
          <Faq
            q="Pesan banyak yang Gagal"
            a="Cek format nomor di CSV — pastikan tidak ada spasi/karakter aneh. Pastikan nomor aktif di WhatsApp. Coba kirim ulang manual lewat tombol di tabel."
          />
          <Faq
            q="Campaign jalan tapi pesan tidak terkirim"
            a="Cek status akun WA — pastikan Terhubung (hijau). Kalau Terputus, klik Mulai dulu. Pesan akan otomatis dilanjutkan."
          />
          <Faq
            q="Lupa password login"
            a="Hubungi admin Kala Blast di kontak di bawah halaman ini — admin akan reset password Anda."
          />
        </div>
      </section>

      {/* Contact Admin */}
      <section className="card p-6 bg-gradient-to-br from-violet-50 to-white border-violet-200 text-center space-y-2">
        <div className="text-2xl">💬</div>
        <h2 className="font-bold text-stone-900">Butuh Bantuan Lebih Lanjut?</h2>
        <p className="text-sm text-stone-600">
          Hubungi admin Kala Blast — kami siap bantu.
        </p>
        <a
          href="mailto:cskaladigital@gmail.com"
          className="inline-block mt-2 text-violet-700 hover:text-violet-800 font-medium text-sm underline"
        >
          cskaladigital@gmail.com
        </a>
      </section>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  actionLabel,
  actionHref,
  children,
}: {
  number: number;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white font-bold shadow-sm">
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-stone-900 leading-tight">
            {title}
          </h3>
          <p className="text-sm text-stone-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="pl-0 sm:pl-14 space-y-3">{children}</div>
      {actionLabel && actionHref && (
        <div className="pl-0 sm:pl-14">
          <Link
            href={actionHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:text-violet-800"
          >
            {actionLabel} →
          </Link>
        </div>
      )}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-violet-50/60 border border-violet-100 rounded-lg p-3 text-xs text-stone-700 leading-relaxed">
      <strong className="text-violet-700">💡 Tips:</strong> {children}
    </div>
  );
}

function BulletTip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-amber-600 mt-0.5">✓</span>
      <span>{children}</span>
    </li>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="card p-4 group">
      <summary className="font-medium text-stone-900 cursor-pointer flex items-center justify-between gap-2 list-none">
        <span>{q}</span>
        <span className="text-stone-400 group-open:rotate-180 transition-transform">
          ▾
        </span>
      </summary>
      <p className="text-sm text-stone-600 mt-3 leading-relaxed">{a}</p>
    </details>
  );
}
