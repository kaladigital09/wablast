import './globals.css';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth';
import AppShell from './components/AppShell';
import TopProgressBar from './components/TopProgressBar';

export const metadata: Metadata = {
  title: 'Kala Blast — Undangan Digital',
  description: 'Sistem blast WhatsApp untuk undangan digital',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
