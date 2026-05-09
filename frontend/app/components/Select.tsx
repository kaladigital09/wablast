'use client';
import { useEffect, useRef, useState } from 'react';

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  className?: string;
  id?: string;
  name?: string;
};

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Pilih...',
  disabled = false,
  required = false,
  searchable = false,
  className = '',
  id,
  name,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = searchable && search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.description?.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  // Click outside to close
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Reset highlight saat search berubah
  useEffect(() => {
    setHighlightIdx(0);
  }, [search]);

  // Focus search input saat open
  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open, searchable]);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setOpen(true);
      return;
    }

    if (!open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlightIdx];
      if (opt && !opt.disabled) {
        onChange(opt.value);
        setOpen(false);
        setSearch('');
      }
    }
  }

  function handleSelect(opt: SelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setSearch('');
  }

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      {/* Hidden native input untuk required validation */}
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
          name={name}
          id={id}
        />
      )}

      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 border rounded-lg px-3.5 py-2.5 text-sm bg-white transition-all text-left ${
          disabled
            ? 'bg-stone-50 text-stone-500 cursor-not-allowed border-stone-200'
            : open
              ? 'border-violet-500 ring-2 ring-violet-500/20'
              : 'border-stone-200 hover:border-stone-300 cursor-pointer'
        }`}
      >
        <span className={`flex-1 truncate ${selected ? 'text-stone-900' : 'text-stone-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-stone-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1.5 left-0 right-0 bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden animate-fade-in"
          role="listbox"
        >
          {searchable && (
            <div className="p-2 border-b border-stone-100">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari..."
                className="w-full px-3 py-1.5 text-sm bg-stone-50 rounded-md border border-stone-200 focus:outline-none focus:border-violet-500"
              />
            </div>
          )}

          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3.5 py-3 text-sm text-stone-400 text-center">
                Tidak ada pilihan
              </div>
            ) : (
              filtered.map((opt, i) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHighlightIdx(i)}
                  disabled={opt.disabled}
                  className={`w-full text-left px-3.5 py-2 text-sm flex items-start gap-2 transition-colors ${
                    opt.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : i === highlightIdx
                        ? 'bg-violet-50 text-violet-700'
                        : 'text-stone-700 hover:bg-stone-50'
                  } ${opt.value === value ? 'font-medium' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{opt.label}</div>
                    {opt.description && (
                      <div className="text-xs text-stone-500 truncate mt-0.5">
                        {opt.description}
                      </div>
                    )}
                  </div>
                  {opt.value === value && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-violet-600 shrink-0 mt-0.5"
                    >
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
