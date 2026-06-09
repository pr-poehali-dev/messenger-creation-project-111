import { useEffect } from 'react';
import { api } from '@/api/client';

const INTERVAL_MS = 30_000;

export function useHeartbeat(userId: number | null) {
  useEffect(() => {
    if (!userId) return;

    const ping = () => api.heartbeat().catch(() => {});

    // Пингуем сразу при монтировании
    ping();

    const timer = setInterval(ping, INTERVAL_MS);

    // Пингуем при возвращении на вкладку
    const onVisibility = () => { if (document.visibilityState === 'visible') ping(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId]);
}
