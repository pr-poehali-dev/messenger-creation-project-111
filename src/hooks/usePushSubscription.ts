import { useEffect, useRef } from 'react';
import { api } from '@/api/client';

export function usePushSubscription(userId: number | null) {
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const trySubscribe = async () => {
      if (Notification.permission !== 'granted') return;
      if (subscribedRef.current) return;

      try {
        const reg = await navigator.serviceWorker.ready;

        const { vapid_public_key } = await api.getPushVapidKey() as { vapid_public_key: string };

        // base64url → Uint8Array
        const b64 = vapid_public_key.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '=='.slice((b64.length + 3) % 4 ? 0 : 2);
        const raw = Uint8Array.from(atob(padded), c => c.charCodeAt(0));

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: raw,
        });

        await api.subscribePush(sub.toJSON() as PushSubscriptionJSON);
        subscribedRef.current = true;
        console.log('[Push] Subscribed successfully');
      } catch (e) {
        console.error('[Push] Subscription error:', e);
      }
    };

    // Сразу пробуем
    trySubscribe();

    // Повторяем каждые 5 сек пока не подпишемся (ждём выдачи разрешения)
    const interval = setInterval(() => {
      if (!subscribedRef.current) trySubscribe();
      else clearInterval(interval);
    }, 5000);

    return () => clearInterval(interval);
  }, [userId]);
}
