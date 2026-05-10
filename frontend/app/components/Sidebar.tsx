'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';

const allItems = [
  { href: '/', label: 'Dashboard', icon: '◈', roles: ['super_admin'] },
  { href: '/clients', label: 'Clients', icon: '◉', roles: ['super_admin'] },
  { href: '/sessions', label: 'Akun WA', icon: '◎', roles: ['super_admin', 'client_user'] },
  { href: '/campaigns', label: 'Campaigns', icon: '◇', roles: ['super_admin', 'client_user'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  }

  const items = allItems.filter((item) => item.roles.includes(user?.role || ''));

  const userInitial = (user?.full_name || user?.email || '?')[0]?.toUpperCase();

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-sm border-b border-stone-200 px-4 h-14 flex items-center justify-between">
        <Link
          href={user?.role === 'client_user' ? '/sessions' : '/'}
          className="flex items-center gap-2"
        >
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-xs font-bold">
            K
          </div>
          <span className="font-bold text-stone-900 text-sm">Kala Blast</span>
        </Link>

        <ProfileMenu />
      </header>

      {/* Desktop sidebar — fixed, tidak ikut scroll */}
      <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-stone-200 p-6 flex-col shrink-0 z-30">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white font-bold shadow-sm">
            K
          </div>
          <div>
            <h1 className="font-bold text-stone-900 leading-tight">Kala Blast</h1>
            <p className="text-xs text-stone-500">Undangan Digital</p>
          </div>
        </div>

        {/* User badge */}
        <div className="bg-stone-50 rounded-lg p-3 mb-6 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-semibold text-sm shrink-0">
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-stone-900 truncate">
              {user?.full_name || user?.email}
            </div>
            <div className="text-[10px] text-stone-500 truncate">
              {user?.role === 'super_admin' ? '👑 Super Admin' : `Client: ${user?.client?.name || ''}`}
            </div>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-violet-50 text-violet-700 shadow-sm'
                    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                }`}
              >
                <span className={active ? 'text-violet-600' : 'text-stone-400'}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-stone-100 space-y-3">
          <button
            onClick={logout}
            className="w-full text-left text-sm text-stone-600 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-stone-400">↪</span> Keluar
          </button>
          <div className="text-[10px] text-stone-400 px-3">
            <p className="font-medium text-stone-500 mb-0.5">💡 Tips Anti-Banned</p>
            <p className="leading-relaxed">
              Kirim manual 10-20 nomor dulu saat akun WA baru.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className={`grid grid-cols-${items.length}`} style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors relative ${
                  active ? 'text-violet-600' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-violet-600 rounded-b" />
                )}
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const initial = (user?.full_name || user?.email || '?')[0]?.toUpperCase();
  const displayName = user?.full_name || user?.client?.name || user?.email?.split('@')[0] || 'User';
  const roleLabel =
    user?.role === 'super_admin' ? '👑 Super Admin' : `Client: ${user?.client?.name || ''}`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
          open
            ? 'bg-violet-600 text-white shadow-md'
            : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
        }`}
        aria-label="Profile menu"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-stone-200 overflow-hidden animate-fade-in z-50">
          {/* Header */}
          <div className="p-4 bg-gradient-to-br from-violet-50 to-white border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white font-bold flex items-center justify-center shadow-sm">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-stone-900 text-sm truncate">
                  {displayName}
                </div>
                <div className="text-xs text-stone-500 truncate">{user?.email}</div>
              </div>
            </div>
            <div className="mt-2.5 inline-block bg-white border border-stone-200 px-2 py-0.5 rounded-md text-[10px] font-medium text-stone-600">
              {roleLabel}
            </div>
          </div>

          {/* Menu items */}
          <div className="p-1.5">
            {user?.role === 'client_user' && user?.client_id && (
              <Link
                href={`/clients/${user.client_id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Profil saya
              </Link>
            )}
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
