'use client';
import { useEffect, useRef, useState } from 'react';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDisplay(d: Date) {
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export type DatePickerProps = {
  value: string; // ISO format YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** Min date (ISO YYYY-MM-DD) */
  min?: string;
  className?: string;
};

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Pilih tanggal',
  disabled = false,
  required = false,
  min,
  className = '',
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = parseISODate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = min ? parseISODate(min) : null;

  // View month state — apa yg sedang ditampilkan di calendar
  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());

  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [value]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function navigateMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    while (m < 0) {
      m += 12;
      y -= 1;
    }
    while (m > 11) {
      m -= 12;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  function selectDate(d: Date) {
    onChange(toISODate(d));
    setOpen(false);
  }

  function clear() {
    onChange('');
    setOpen(false);
  }

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay(); // 0=Sun

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {required && (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{
            opacity: 0,
            width: '100%',
            height: 0,
            position: 'absolute',
            pointerEvents: 'none',
          }}
          value={value || ''}
          onChange={() => {}}
          required
        />
      )}

      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 border rounded-lg px-3.5 py-2.5 text-sm bg-white transition-all text-left ${
          disabled
            ? 'bg-stone-50 text-stone-500 cursor-not-allowed border-stone-200'
            : open
              ? 'border-violet-500 ring-2 ring-violet-500/20'
              : 'border-stone-200 hover:border-stone-300 cursor-pointer'
        }`}
      >
        <span className={selectedDate ? 'text-stone-900' : 'text-stone-400'}>
          {selectedDate ? formatDisplay(selectedDate) : placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-stone-400 shrink-0"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 left-0 bg-white border border-stone-200 rounded-xl shadow-lg p-2.5 sm:p-3 w-[280px] sm:w-[300px] max-w-[calc(100vw-2rem)] animate-fade-in">
          {/* Header: month nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className="p-1.5 rounded-md hover:bg-stone-100 text-stone-600"
              aria-label="Bulan sebelumnya"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="text-sm font-semibold text-stone-900">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="p-1.5 rounded-md hover:bg-stone-100 text-stone-600"
              aria-label="Bulan berikutnya"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DAY_LABELS.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-medium text-stone-400 uppercase py-1 min-w-0"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} />;
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              const isToday = isSameDay(date, today);
              const isPast = minDate ? date < minDate : false;

              return (
                <button
                  key={toISODate(date)}
                  type="button"
                  onClick={() => !isPast && selectDate(date)}
                  disabled={isPast}
                  className={`text-sm py-1.5 rounded-md transition-colors relative min-w-0 aspect-square flex items-center justify-center ${
                    isPast
                      ? 'text-stone-300 cursor-not-allowed'
                      : isSelected
                        ? 'bg-violet-600 text-white font-semibold shadow-sm'
                        : isToday
                          ? 'bg-violet-50 text-violet-700 font-semibold hover:bg-violet-100'
                          : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => {
                const t = new Date();
                if (minDate && t < minDate) return;
                selectDate(t);
              }}
              className="text-xs text-violet-600 hover:text-violet-700 font-medium"
            >
              Hari ini
            </button>
            {selectedDate && (
              <button
                type="button"
                onClick={clear}
                className="text-xs text-stone-500 hover:text-red-600 font-medium"
              >
                Hapus
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
