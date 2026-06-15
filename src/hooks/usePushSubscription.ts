import { useEffect, useRef } from 'react';
import { api } from '@/api/client';

export function usePushSubscription(userId: number | null, permission: NotificationPermission) {
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    if (permission !== 'granted') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (subscribedRef.current) return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;

        const { vapid_public_key } = await api.getPushVapidKey() as { vapid_public_key: string };

        // base64url → Uint8Array
        const b64 = vapid_public_key.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '=='.slice((b64.length + 3) % 4 ? 0 : 2);
        const raw = Uint8Array.from(atob(padded), c => c.charCodeAt(0));

        // Берём существующую подписку или создаём новую
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: raw,
          });
        }

        await api.subscribePush(sub.toJSON() as PushSubscriptionJSON);
        subscribedRef.current = true;
        console.log('[Push] Subscribed successfully');
      } catch (e) {
        console.error('[Push] Subscription error:', e);
      }
    })();
  }, [userId, permission]);
}
