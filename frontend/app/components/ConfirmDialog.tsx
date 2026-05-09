'use client';
import { useEffect, useState, ReactNode } from 'react';
import { Spinner } from './PageLoader';

type Variant = 'danger' | 'warning' | 'info';

const variantConfig: Record<
  Variant,
  { iconBg: string; iconColor: string; btnClass: string; defaultIcon: string }
> = {
  danger: {
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    btnClass: 'bg-red-600 hover:bg-red-700 text-white',
    defaultIcon: '🗑',
  },
  warning: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    btnClass: 'bg-amber-600 hover:bg-amber-700 text-white',
    defaultIcon: '⚠',
  },
  info: {
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    btnClass: 'bg-violet-600 hover:bg-violet-700 text-white',
    defaultIcon: 'ⓘ',
  },
};

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** Nama item yang akan dihapus (akan ditampilkan dalam quote) */
  itemName?: string;
  /** Daftar konsekuensi (bullet list) */
  consequences?: string[];
  variant?: Variant;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Kalau true, user harus ketik ulang itemName untuk confirm. Anti-misclick untuk aksi destruktif. */
  requireTypeToConfirm?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  itemName,
  consequences,
  variant = 'danger',
  icon,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  requireTypeToConfirm = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cfg = variantConfig[variant];
  const [typed, setTyped] = useState('');

  // Reset state saat modal dibuka/ditutup
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  // Lock scroll & ESC = cancel
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  const canConfirm = !loading && (!requireTypeToConfirm || typed === itemName);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + judul */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div
            className={`inline-flex items-center justify-center w-14 h-14 rounded-full ${cfg.iconBg} ${cfg.iconColor} text-2xl`}
          >
            {icon || cfg.defaultIcon}
          </div>
          <h2 className="text-xl font-bold text-stone-900">{title}</h2>
          {itemName && (
            <p className="text-sm text-stone-500">
              <span className="font-semibold text-stone-700">"{itemName}"</span>
            </p>
          )}
        </div>

        {/* Deskripsi */}
        {description && (
          <div className="text-sm text-stone-600 leading-relaxed text-center">
            {description}
          </div>
        )}

        {/* Daftar konsekuensi */}
        {consequences && consequences.length > 0 && (
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 text-sm text-stone-700 space-y-1.5">
            <div className="font-medium text-stone-900 mb-1">Yang akan dihapus:</div>
            <ul className="space-y-1">
              {consequences.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Type to confirm (anti-misclick untuk aksi sangat destruktif) */}
        {requireTypeToConfirm && itemName && (
          <div>
            <label className="text-xs text-stone-600 block mb-1.5">
              Ketik ulang <span className="font-mono font-semibold">{itemName}</span> untuk konfirmasi:
            </label>
            <input
              type="text"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="input"
              placeholder={itemName}
              disabled={loading}
            />
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary flex-1 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => canConfirm && onConfirm()}
            disabled={!canConfirm}
            className={`flex-[1.2] inline-flex items-center justify-center gap-2 font-medium px-4 py-2 rounded-lg transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed ${cfg.btnClass}`}
          >
            {loading ? (
              <>
                <Spinner size="sm" />
                <span>Memproses...</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
