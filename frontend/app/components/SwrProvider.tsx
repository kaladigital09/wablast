'use client';
import { SWRConfig } from 'swr';
import { ReactNode } from 'react';

export default function SwrProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Jangan polling saat tab tidak aktif — hindari backlog request menumpuk
        // saat user balik ke tab Vercel setelah lama di tab lain.
        refreshWhenHidden: false,
        refreshWhenOffline: false,
        // Pause revalidate saat offline supaya tidak antri saat koneksi balik
        revalidateOnReconnect: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
