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

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Format datetime-local value: "YYYY-MM-DDTHH:mm"
 */
function fromDateTimeLocal(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toDateTimeLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDisplay(d: Date) {
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type DateTimePickerProps = {
  value: string; // datetime-local format YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** Reject tanggal sebelum sekarang */
  minNow?: boolean;
  className?: string;
};

export default function DateTimePicker({
  value,
  onChange,
  placeholder = 'Pilih tanggal & jam',
  disabled = false,
  required = false,
  minNow = false,
  className = '',
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = fromDateTimeLocal(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());
  const [hour, setHour] = useState(selected?.getHours() ?? 9);
  const [minute, setMinute] = useState(selected?.getMinutes() ?? 0);
  const [pickedDate, setPickedDate] = useState<Date | null>(selected);

  useEffect(() => {
    const d = fromDateTimeLocal(value);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setHour(d.getHours());
      setMinute(d.getMinutes());
      setPickedDate(d);
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
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function commit(date: Date, h: number, mi: number) {
    const final = new Date(date);
    final.setHours(h, mi, 0, 0);
    onChange(toDateTimeLocal(final));
  }

  function selectDate(d: Date) {
    setPickedDate(d);
    commit(d, hour, minute);
  }

  function changeHour(h: number) {
    const newH = Math.max(0, Math.min(23, h));
    setHour(newH);
    if (pickedDate) commit(pickedDate, newH, minute);
  }

  function changeMinute(m: number) {
    const newM = Math.max(0, Math.min(59, m));
    setMinute(newM);
    if (pickedDate) commit(pickedDate, hour, newM);
  }

  function clear() {
    onChange('');
    setPickedDate(null);
    setOpen(false);
  }

  function pickNow() {
    const now = new Date();
    setPickedDate(now);
    setHour(now.getHours());
    setMinute(now.getMinutes());
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    commit(now, now.getHours(), now.getMinutes());
  }

  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

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
        <span className={selected ? 'text-stone-900' : 'text-stone-400'}>
          {selected ? formatDisplay(selected) : placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400 shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <circle cx="12" cy="14" r="3" />
          <path d="M12 12.5v1.5l1 1" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 left-0 bg-white border border-stone-200 rounded-xl shadow-lg p-2.5 sm:p-3 w-[300px] sm:w-[320px] max-w-[calc(100vw-2rem)] animate-fade-in">
          {/* Calendar header */}
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

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-stone-400 uppercase py-1 min-w-0">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} />;
              const isSelected = pickedDate && isSameDay(date, pickedDate);
              const isToday = isSameDay(date, today);
              const isPast = minNow ? date < today : false;

              return (
                <button
                  key={`${date.getTime()}-${i}`}
                  type="button"
                  onClick={() => !isPast && selectDate(date)}
                  disabled={isPast}
                  className={`text-sm py-1.5 rounded-md transition-colors min-w-0 aspect-square flex items-center justify-center ${
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

          {/* Time picker */}
          <div className="mt-3 pt-3 border-t border-stone-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-stone-500 mr-1">⏰ Jam</span>
              <div className="flex items-center gap-1 bg-stone-50 rounded-lg p-1 flex-1">
                <NumStepper
                  value={hour}
                  min={0}
                  max={23}
                  onChange={changeHour}
                  pad
                />
                <span className="text-stone-400 font-bold">:</span>
                <NumStepper
                  value={minute}
                  min={0}
                  max={59}
                  step={5}
                  onChange={changeMinute}
                  pad
                />
              </div>
            </div>

            {/* Quick time presets */}
            <div className="flex gap-1 mt-2 flex-wrap">
              {[
                { label: '09:00', h: 9, m: 0 },
                { label: '12:00', h: 12, m: 0 },
                { label: '15:00', h: 15, m: 0 },
                { label: '18:00', h: 18, m: 0 },
                { label: '20:00', h: 20, m: 0 },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    setHour(t.h);
                    setMinute(t.m);
                    if (pickedDate) commit(pickedDate, t.h, t.m);
                  }}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                    hour === t.h && minute === t.m
                      ? 'bg-violet-50 border-violet-300 text-violet-700 font-medium'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={pickNow}
              className="text-xs text-violet-600 hover:text-violet-700 font-medium"
            >
              Sekarang
            </button>
            {selected && (
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

function NumStepper({
  value,
  min,
  max,
  step = 1,
  pad: doPad = false,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  pad?: boolean;
  onChange: (v: number) => void;
}) {
  function dec() {
    let v = value - step;
    if (v < min) v = max;
    onChange(v);
  }
  function inc() {
    let v = value + step;
    if (v > max) v = min;
    onChange(v);
  }
  return (
    <div className="flex items-center bg-white rounded-md flex-1">
      <button
        type="button"
        onClick={dec}
        className="px-2 py-1 text-stone-500 hover:text-violet-600 hover:bg-violet-50 rounded-md transition-colors"
        aria-label="-"
      >
        −
      </button>
      <input
        type="number"
        value={doPad ? pad(value) : value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        className="flex-1 text-center text-sm font-mono font-semibold text-stone-900 bg-transparent focus:outline-none w-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={inc}
        className="px-2 py-1 text-stone-500 hover:text-violet-600 hover:bg-violet-50 rounded-md transition-colors"
        aria-label="+"
      >
        +
      </button>
    </div>
  );
}
