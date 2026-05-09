'use client';
import { useEffect } from 'react';
import { Spinner } from './PageLoader';

type Stats = { total: number; pending: number; sent: number; failed: number };

export default function BlastProgressModal({
  open,
  stats,
  status,
  campaignName,
  onCancel,
  onClose,
}: {
  open: boolean;
  stats: Stats;
  status: string;
  campaignName: string;
  onCancel: () => void;
  onClose: () => void;
}) {
  // Lock scroll & block ESC saat modal open dan masih running
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const blockEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status === 'running') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', blockEscape, { capture: true });

    // Block close via beforeunload (close tab/refresh)
    const blockUnload = (e: BeforeUnloadEvent) => {
      if (status === 'running') {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', blockUnload);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', blockEscape, { capture: true } as any);
      window.removeEventListener('beforeunload', blockUnload);
    };
  }, [open, status]);

  if (!open) return null;

  const processed = stats.sent + stats.failed;
  const progress = stats.total ? Math.round((processed / stats.total) * 100) : 0;
  const isFinished = ['completed', 'cancelled', 'paused_limit'].includes(status);
  const isRunning = status === 'running';

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        // Cegah close saat klik backdrop kalau masih running
        if (isRunning) e.stopPropagation();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-violet-50 mb-1">
            {isRunning ? (
              <Spinner size="lg" />
            ) : status === 'completed' ? (
              <span className="text-3xl">✓</span>
            ) : status === 'cancelled' ? (
              <span className="text-3xl">✕</span>
            ) : (
              <span className="text-3xl">⏸</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-stone-900">
            {isRunning && 'Mengirim Pesan...'}
            {status === 'completed' && 'Blast Selesai!'}
            {status === 'cancelled' && 'Blast Dibatalkan'}
            {status === 'paused_limit' && 'Batas Harian Tercapai'}
          </h2>
          <p className="text-sm text-stone-500 line-clamp-1">{campaignName}</p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-stone-600 font-medium">
              {processed} / {stats.total} pesan
            </span>
            <span className="text-violet-600 font-bold">{progress}%</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-violet-500 to-violet-600 h-full rounded-full transition-all duration-500 relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              {isRunning && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              )}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-stone-50 rounded-lg p-3 text-center">
            <div className="text-xs text-stone-500 uppercase tracking-wide">Pending</div>
            <div className="text-2xl font-bold text-stone-700 mt-0.5">{stats.pending}</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center">
            <div className="text-xs text-emerald-600 uppercase tracking-wide">Terkirim</div>
            <div className="text-2xl font-bold text-emerald-700 mt-0.5">{stats.sent}</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-xs text-red-600 uppercase tracking-wide">Gagal</div>
            <div className="text-2xl font-bold text-red-700 mt-0.5">{stats.failed}</div>
          </div>
        </div>

        {/* Info / warning */}
        {isRunning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 leading-relaxed">
            ⚠️ <strong>Jangan tutup window ini.</strong> Pesan dikirim dengan jeda 5-15 detik per
            nomor untuk hindari banned WhatsApp.
          </div>
        )}

        {status === 'paused_limit' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-800 leading-relaxed">
            ⏸ Limit harian akun WA tercapai. Pesan tersisa akan otomatis lanjut besok, atau Anda
            bisa kirim manual per nomor.
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex gap-2 pt-2">
          {isRunning ? (
            <button onClick={onCancel} className="btn-danger flex-1">
              ⏹ Hentikan Blast
            </button>
          ) : (
            <button onClick={onClose} className="btn-primary flex-1">
              {isFinished ? 'Tutup' : 'OK'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
