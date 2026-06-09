import { useState, useEffect, useCallback } from 'react';
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
}

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
    fetchChats();
    const interval = setInterval(fetchChats, 5000);
    return () => clearInterval(interval);
  }, [fetchChats]);

  // Update browser tab title with unread count
  useEffect(() => {
    const total = chats.reduce((sum, c) => sum + c.unread, 0);
    document.title = total > 0 ? `(${total}) PULSE — Мессенджер` : 'PULSE — Мессенджер';
  }, [chats]);

  return { chats, loading, error, refetch: fetchChats };
}

export function useMessages(chatId: number | null) {
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    try {
      const data = await api.getMessages(chatId);
      setMessages(data.messages as ApiMessage[]);
      await api.markRead(chatId);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    setMessages([]);
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

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

  return { messages, loading, sendMessage, sendFileMessage, refetch: fetchMessages };
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