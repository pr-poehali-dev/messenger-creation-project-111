import React, { useState } from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';
import { ApiChat } from '@/hooks/useChats';

interface ChatListProps {
  chats: ApiChat[];
  activeChat: number | null;
  onSelectChat: (id: number) => void;
  onRefresh: () => void;
}

const typeFilter = ['Все', 'Личные', 'Группы', 'Каналы'];

const ChatList: React.FC<ChatListProps> = ({ chats, activeChat, onSelectChat, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Все');

  const filtered = chats.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'Все' ||
      (filter === 'Личные' && c.type === 'direct') ||
      (filter === 'Группы' && c.type === 'group') ||
      (filter === 'Каналы' && c.type === 'channel');
    return matchSearch && matchFilter;
  });

  return (
    <div
      className="flex flex-col h-full"
      style={{ width: 300, background: 'var(--surface-2)', borderRight: '1px solid var(--glass-border)' }}
    >
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Сообщения</h2>
          <button
            onClick={onRefresh}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))', boxShadow: '0 0 12px rgba(139,92,246,0.4)' }}
          >
            <Icon name="RefreshCw" size={14} className="text-white" />
          </button>
        </div>

        <div className="relative">
          <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--muted-foreground))' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none text-white placeholder:text-muted-foreground transition-all"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)', fontFamily: 'inherit' }}
            onFocus={e => (e.target.style.borderColor = 'rgba(139,92,246,0.5)')}
            onBlur={e => (e.target.style.borderColor = 'var(--glass-border)')}
          />
        </div>
      </div>

      <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {typeFilter.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
            style={{
              background: filter === f ? 'var(--neon-purple)' : 'var(--surface-3)',
              color: filter === f ? 'white' : 'hsl(var(--muted-foreground))',
              border: filter === f ? '1px solid rgba(139,92,246,0.5)' : '1px solid transparent',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 opacity-40">
            <Icon name="MessageCircle" size={32} style={{ color: 'hsl(var(--muted-foreground))' }} />
            <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {chats.length === 0 ? 'Нет чатов. Найдите контакт!' : 'Ничего не найдено'}
            </p>
          </div>
        )}
        {filtered.map(chat => (
          <ChatItem
            key={chat.id}
            chat={chat}
            active={activeChat === chat.id}
            onClick={() => onSelectChat(chat.id)}
          />
        ))}
      </div>
    </div>
  );
};

const ChatItem: React.FC<{ chat: ApiChat; active: boolean; onClick: () => void }> = ({ chat, active, onClick }) => (
  <div
    onClick={onClick}
    className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200"
    style={{
      background: active ? 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,214,245,0.08))' : 'transparent',
      border: active ? '1px solid rgba(139,92,246,0.25)' : '1px solid transparent',
    }}
    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
  >
    <Avatar seed={chat.avatar} name={chat.name} size={46} online={chat.online} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-semibold text-sm text-white truncate">
          {chat.type === 'channel' && <span className="mr-1">📡</span>}
          {chat.type === 'group' && <span className="mr-1">👥</span>}
          {chat.name}
        </span>
        <span className="text-[11px] ml-2 flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {chat.lastTime}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {chat.lastMessage || 'Нет сообщений'}
        </span>
        {chat.unread > 0 && (
          <div
            className="ml-2 flex-shrink-0 min-w-[20px] h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1.5"
            style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))', boxShadow: '0 0 8px rgba(139,92,246,0.5)' }}
          >
            {chat.unread > 99 ? '99+' : chat.unread}
          </div>
        )}
      </div>
    </div>
  </div>
);

export default ChatList;
