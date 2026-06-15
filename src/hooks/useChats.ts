import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/api/client';

export interface ApiChat {
  id: number;
  type: 'direct' | 'group' | 'channel';
  name: string;
  avatar: string;
  members: number;
  lastMessage: string;
  lastTime: string;
  unread: number;
  online: boolean;
  otherUserId?: number;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  me: boolean;
}

export interface ApiMessage {
  id: number;
  senderId: number;
  isMe: boolean;
  senderName: string;
  senderAvatar: string;
  text: string;
  type: string;
  fileUrl: string | null;
  fileName: string | null;
  time: string;
  read: boolean;
  reactions: MessageReaction[];
}

// Глобальный polling — один на всё приложение
// Подписчики регистрируются через useEffect и получают уведомления об изменениях
export type OnlineMap = Record<number, boolean>;
type Listener = (chatVersion: string, msgVersion: string | null, onlineMap: OnlineMap | null) => void;

class PollingManager {
  private listeners = new Map<string, Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chatId: number | null = null;
  private lastChatVersion = '';
  private lastMsgVersion = '';
  private lastOnlineSnapshot = '';
  private running = false;

  setActiveChatId(id: number | null) {
    this.chatId = id;
    this.lastMsgVersion = '';
  }

  subscribe(key: string, fn: Listener) {
    this.listeners.set(key, fn);
    if (!this.running) this.start();
  }

  unsubscribe(key: string) {
    this.listeners.delete(key);
    if (this.listeners.size === 0) this.stop();
  }

  private start() {
    this.running = true;
    this.tick();
  }

  private stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  private async tick() {
    if (!this.running) return;
    try {
      if (localStorage.getItem('session_id')) {
        const data = await api.checkUpdates(this.chatId ?? undefined) as {
          chat_version: string;
          msg_version: string | null;
          online_map?: OnlineMap;
        };

        const chatChanged = data.chat_version !== this.lastChatVersion;
        const msgChanged = data.msg_version !== null && data.msg_version !== this.lastMsgVersion;
        const newOnlineSnapshot = data.chat_version.split(':')[2] ?? '';
        const onlineChanged = newOnlineSnapshot !== this.lastOnlineSnapshot;

        if (chatChanged) this.lastChatVersion = data.chat_version;
        if (msgChanged) this.lastMsgVersion = data.msg_version!;
        if (onlineChanged) this.lastOnlineSnapshot = newOnlineSnapshot;

        if (chatChanged || msgChanged || onlineChanged) {
          const onlineMap = (onlineChanged && data.online_map) ? data.online_map : null;
          this.listeners.forEach(fn => fn(
            chatChanged ? data.chat_version : '',
            msgChanged ? data.msg_version : null,
            onlineMap,
          ));
        }
      }
    } catch { /* ignore */ }

    this.timer = setTimeout(() => this.tick(), 2000);
  }
}

const polling = new PollingManager();

export function useChats() {
  const [chats, setChats] = useState<ApiChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchChats = useCallback(async () => {
    if (!localStorage.getItem('session_id')) return;
    try {
      const data = await api.getChats();
      setChats(data.chats as ApiChat[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Первая загрузка
    fetchChats();

    // Подписываемся на polling — грузим чаты при изменении, онлайн патчим без перезагрузки
    polling.subscribe('chats', (chatVersion, _msgVersion, onlineMap) => {
      if (chatVersion) {
        fetchChats();
      } else if (onlineMap) {
        setChats(prev => prev.map(c =>
          c.otherUserId !== undefined && c.otherUserId in onlineMap
            ? { ...c, online: onlineMap[c.otherUserId] }
            : c
        ));
      }
    });

    return () => polling.unsubscribe('chats');
  }, [fetchChats]);

  useEffect(() => {
    const total = chats.reduce((sum, c) => sum + c.unread, 0);
    document.title = total > 0 ? `(${total}) PULSE — Мессенджер` : 'PULSE — Мессенджер';
  }, [chats]);

  return { chats, loading, error, refetch: fetchChats };
}

export function useMessages(chatId: number | null) {
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;

  const fetchMessages = useCallback(async () => {
    if (!chatIdRef.current) return;
    setLoading(true);
    try {
      const data = await api.getMessages(chatIdRef.current);
      setMessages(data.messages as ApiMessage[]);
      await api.markRead(chatIdRef.current);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setMessages([]);
    if (!chatId) return;

    polling.setActiveChatId(chatId);
    fetchMessages();

    // Подписываемся — грузим сообщения только при изменении msg_version
    polling.subscribe('messages', (_cv, msgVersion) => {
      if (msgVersion) fetchMessages();
    });

    return () => {
      polling.unsubscribe('messages');
      polling.setActiveChatId(null);
    };
  }, [chatId, fetchMessages]);

  const sendMessage = async (text: string) => {
    if (!chatId) return;
    const data = await api.sendMessage(chatId, text);
    const msg = data.message as ApiMessage;
    setMessages(prev => [...prev, msg]);
  };

  const sendFileMessage = async (fileUrl: string, fileName: string, isImage: boolean, forceType?: string) => {
    if (!chatId) return;
    const type = forceType ?? (isImage ? 'image' : 'file');
    const data = await api.sendFileMessage(chatId, '', fileUrl, fileName, type);
    const msg = data.message as ApiMessage;
    setMessages(prev => [...prev, msg]);
  };

  const updateMessageReactions = useCallback((messageId: number, reactions: MessageReaction[]) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
  }, []);

  return { messages, loading, sendMessage, sendFileMessage, updateMessageReactions, refetch: fetchMessages };
}

export function useUsers(q?: string) {
  const [users, setUsers] = useState<{
    id: number; name: string; username: string;
    bio: string; phone: string; avatar_seed: string;
    online: boolean; lastSeen: string;
  }[]>([]);

  useEffect(() => {
    api.getUsers(q)
      .then(data => setUsers(data.users as typeof users))
      .catch(() => {});
  }, [q]);

  return users;
}