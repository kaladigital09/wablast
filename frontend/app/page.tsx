'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher } from '@/lib/api';
import PageLoader from './components/PageLoader';

const statusColor: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-700',
  scheduled: 'bg-blue-50 text-blue-700',
  running: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
  paused_limit: 'bg-orange-50 text-orange-700',
};

export default function DashboardPage() {
  const { data: clients, isLoading: l1 } = useSWR('/api/clients', fetcher);
  const { data: campaigns, isLoading: l2 } = useSWR('/api/campaigns', fetcher);
  const { data: sessions, isLoading: l3 } = useSWR('/api/sessions', fetcher);

  if (l1 && l2 && l3) return <PageLoader />;

  const activeAccounts = sessions?.filter((s: any) => s.status === 'connected').length ?? 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">Dashboard</h1>
          <p className="text-stone-500 mt-1 text-sm sm:text-base">
            Ringkasan aktivitas blast WhatsApp Anda
          </p>
        </div>
        <Link href="/campaigns/new" className="btn-primary text-sm self-start">
          + Campaign Baru
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Stat
          label="Total Clients"
          value={clients?.length ?? 0}
          icon="◉"
          color="violet"
          href="/clients"
        />
        <Stat
          label="Akun WA Aktif"
          value={activeAccounts}
          icon="◎"
          color="blue"
          href="/sessions"
          sub={`dari ${sessions?.length ?? 0} terdaftar`}
        />
        <Stat
          label="Total Campaigns"
          value={campaigns?.length ?? 0}
          icon="◇"
          color="amber"
          href="/campaigns"
        />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-stone-900">Campaign Terbaru</h2>
            <p className="text-sm text-stone-500">5 campaign terakhir yang dibuat</p>
          </div>
          <Link href="/campaigns" className="text-sm text-violet-600 hover:text-violet-700 font-medium">
            Lihat semua →
          </Link>
        </div>
        <div className="space-y-2">
          {(campaigns || []).slice(0, 5).map((c: any) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-stone-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center text-sm font-semibold">
                  {c.name?.[0]?.toUpperCase() || 'C'}
                </div>
                <div>
                  <div className="font-medium text-stone-900 group-hover:text-violet-700 transition-colors">
                    {c.name}
                  </div>
                  <div className="text-xs text-stone-500">
                    {c.total_recipients} penerima ·{' '}
                    {new Date(c.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>
              <span className={`badge ${statusColor[c.status] || 'bg-stone-100'}`}>
                {c.status}
              </span>
            </Link>
          ))}
          {!campaigns?.length && (
            <div className="text-center py-12 text-stone-400">
              <div className="text-4xl mb-2">◇</div>
              <p className="text-sm">Belum ada campaign. Mulai buat campaign pertama Anda!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  color,
  href,
  sub,
}: {
  label: string;
  value: number | string;
  icon: string;
  color: 'violet' | 'blue' | 'amber';
  href: string;
  sub?: string;
}) {
  const colors = {
    violet: 'from-violet-500 to-violet-600 text-violet-600 bg-violet-50',
    blue: 'from-blue-500 to-blue-600 text-blue-600 bg-blue-50',
    amber: 'from-amber-500 to-amber-600 text-amber-600 bg-amber-50',
  };
  const [, , textCol, bgCol] = colors[color].split(' ');

  return (
    <Link href={href} className="card card-hover p-6 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl ${bgCol} ${textCol} flex items-center justify-center text-xl`}>
          {icon}
        </div>
        <span className="text-stone-300 group-hover:text-stone-500 transition-colors">→</span>
      </div>
      <div className="text-xs text-stone-500 uppercase tracking-wide font-medium">{label}</div>
      <div className="text-3xl font-bold text-stone-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-stone-400 mt-1">{sub}</div>}
    </Link>
  );
}
