'use client';
import { useEffect, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finishRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (finishRef.current) clearTimeout(finishRef.current);

    setVisible(true);
    setProgress(15);

    // Naikkan progress secara bertahap (asymptotic ke 90%)
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        const increment = (90 - prev) * 0.1;
        return prev + Math.max(increment, 0.5);
      });
    }, 100);

    // Selesaikan dalam waktu singkat (page sudah render karena ini client component)
    const completeTimer = setTimeout(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      setProgress(100);
      finishRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }, 400);

    return () => {
      clearTimeout(completeTimer);
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishRef.current) clearTimeout(finishRef.current);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
      <div
        className="h-0.5 bg-gradient-to-r from-violet-500 via-violet-400 to-violet-600 transition-all duration-200 ease-out shadow-[0_0_10px_rgba(139,92,246,0.7)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition:
            progress === 100
              ? 'opacity 300ms ease-out, width 200ms ease-out'
              : 'width 200ms ease-out',
        }}
      />
    </div>
  );
}
