'use client';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Sidebar from './Sidebar';
import { InlineLoader } from './PageLoader';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Login page → render plain (no sidebar)
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Sebelum auth selesai dicek
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <InlineLoader label="Memuat..." />
      </div>
    );
  }

  // Belum login & bukan halaman public — AuthProvider akan redirect
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="lg:ml-64 pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
