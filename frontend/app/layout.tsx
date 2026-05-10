import './globals.css';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth';
import AppShell from './components/AppShell';
import TopProgressBar from './components/TopProgressBar';
import SwrProvider from './components/SwrProvider';

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
        <SwrProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </SwrProvider>
      </body>
    </html>
  );
}
