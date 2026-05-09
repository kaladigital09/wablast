export default function PageLoader() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-64 bg-stone-200 rounded-lg" />
        <div className="h-4 w-80 bg-stone-100 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6 space-y-3">
            <div className="w-11 h-11 rounded-xl bg-stone-100" />
            <div className="h-3 w-20 bg-stone-100 rounded" />
            <div className="h-8 w-16 bg-stone-200 rounded" />
          </div>
        ))}
      </div>
      <div className="card p-6 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-stone-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-stone-200 rounded" />
              <div className="h-3 w-1/4 bg-stone-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridLoader({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-stone-100" />
          <div className="h-5 w-3/4 bg-stone-200 rounded" />
          <div className="h-3 w-1/2 bg-stone-100 rounded" />
          <div className="flex gap-2 pt-3 border-t border-stone-100">
            <div className="flex-1 h-8 bg-stone-100 rounded-md" />
            <div className="flex-1 h-8 bg-stone-100 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableLoader({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="p-4 bg-stone-50 border-b border-stone-200">
        <div className="h-4 w-32 bg-stone-200 rounded" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 border-t border-stone-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-stone-100" />
          <div className="flex-1 h-4 bg-stone-200 rounded max-w-xs" />
          <div className="w-20 h-6 bg-stone-100 rounded-full" />
          <div className="w-16 h-4 bg-stone-100 rounded" />
        </div>
      ))}
    </div>
  );
}

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-[3px]',
  };
  return (
    <div
      className={`${sizes[size]} border-stone-200 border-t-violet-600 rounded-full animate-spin`}
    />
  );
}

export function InlineLoader({ label = 'Memuat...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-stone-500">
      <Spinner size="md" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
