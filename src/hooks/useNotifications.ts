import { useEffect, useRef, useCallback, useState } from 'react';

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  useEffect(() => {
    if (!('Notification' in window)) return;
    // Polling — Notification API не имеет события изменения
    const interval = setInterval(() => {
      if (Notification.permission !== permission) {
        setPermission(Notification.permission);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [permission]);

  const request = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') { setPermission('granted'); return true; }
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }, []);

  return { permission, request };
}

export function useNewMessageNotifications(
  chats: { id: number; name: string; unread: number; lastMessage: string }[],
  activeChatId: number | null
) {
  const prevUnreadMap = useRef<Map<number, number>>(new Map());
  const initialized = useRef(false);

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (chats.length === 0) return;

    // First load — just snapshot, don't notify
    if (!initialized.current) {
      chats.forEach(c => prevUnreadMap.current.set(c.id, c.unread));
      initialized.current = true;
      return;
    }

    chats.forEach(chat => {
      const prev = prevUnreadMap.current.get(chat.id) ?? 0;
      const curr = chat.unread;

      // New unread messages arrived and this chat is not currently open
      if (curr > prev && chat.id !== activeChatId) {
        if (Notification.permission === 'granted' && !document.hasFocus()) {
          const notif = new Notification(`PULSE — ${chat.name}`, {
            body: chat.lastMessage || 'Новое сообщение',
            icon: '/favicon.svg',
            tag: `chat-${chat.id}`,   // collapses multiple from same chat
            renotify: true,
          });

          notif.onclick = () => {
            window.focus();
            notif.close();
          };
        }
      }

      prevUnreadMap.current.set(chat.id, curr);
    });
  }, [chats, activeChatId]);
}