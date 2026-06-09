import { useEffect, useRef } from 'react';
import { api } from '@/api/client';

export function usePushSubscription(userId: number | null) {
  const doneRef = useRef(false);

  useEffect(() => {
    if (!userId || doneRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission !== 'granted') return;

    doneRef.current = true;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;

        // Получаем публичный VAPID ключ
        const { vapid_public_key } = await api.getPushVapidKey() as { vapid_public_key: string };

        // Конвертируем base64url → Uint8Array
        const key = vapid_public_key.replace(/-/g, '+').replace(/_/g, '/');
        const raw = Uint8Array.from(atob(key + '=='.slice((key.length + 3) % 4 ? 0 : 2)), c => c.charCodeAt(0));

        // Подписываемся (или получаем существующую подписку)
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: raw,
        });

        // Отправляем подписку на бэкенд
        await api.subscribePush(sub.toJSON() as PushSubscriptionJSON);
      } catch (e) {
        console.error('Push subscription error:', e);
        doneRef.current = false;
      }
    })();
  }, [userId]);

  // Переподписываемся если разрешение только что выдано
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      if (Notification.permission === 'granted' && !doneRef.current) {
        doneRef.current = false; // сбросим чтобы useEffect выше перезапустился
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [userId]);
}
