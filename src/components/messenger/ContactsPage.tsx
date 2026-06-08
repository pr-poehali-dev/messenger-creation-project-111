import React, { useState } from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';
import { useUsers } from '@/hooks/useChats';
import { api } from '@/api/client';

interface ContactsPageProps {
  onChatCreated: (chatId: number) => void;
}

interface ApiUser {
  id: number;
  name: string;
  username: string;
  bio: string;
  phone: string;
  avatar_seed: string;
  online: boolean;
  lastSeen: string;
}

const ContactsPage: React.FC<ContactsPageProps> = ({ onChatCreated }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ApiUser | null>(null);
  const [creating, setCreating] = useState(false);
  const users = useUsers(search || undefined);

  const online = users.filter(u => u.online);
  const offline = users.filter(u => !u.online);

  const handleWriteMessage = async () => {
    if (!selected) return;
    setCreating(true);
    try {
      const data = await api.createDirectChat(selected.id);
      onChatCreated(data.chat_id as number);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div
        className="flex flex-col h-full"
        style={{ width: 300, background: 'var(--surface-2)', borderRight: '1px solid var(--glass-border)' }}
      >
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Контакты</h2>
          </div>
          <div className="relative">
            <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--muted-foreground))' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск контактов..."
              className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none text-white placeholder:text-muted-foreground"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {users.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 opacity-40">
              <Icon name="Users" size={28} style={{ color: 'hsl(var(--muted-foreground))' }} />
              <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Никого не найдено</p>
            </div>
          )}

          {online.length > 0 && (
            <>
              <div className="px-2 py-1 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  🟢 Онлайн — {online.length}
                </span>
              </div>
              {online.map(u => (
                <ContactItem key={u.id} user={u} active={selected?.id === u.id} onClick={() => setSelected(u)} />
              ))}
              {offline.length > 0 && <div className="mx-2 my-2" style={{ height: 1, background: 'var(--glass-border)' }} />}
            </>
          )}

          {offline.length > 0 && (
            <>
              <div className="px-2 py-1 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Не в сети
                </span>
              </div>
              {offline.map(u => (
                <ContactItem key={u.id} user={u} active={selected?.id === u.id} onClick={() => setSelected(u)} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Right: contact info */}
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: 'var(--surface-1)' }}>
        {selected ? (
          <div className="flex flex-col items-center animate-fade-in" style={{ maxWidth: 340 }}>
            <div className="relative mb-5">
              <Avatar seed={selected.avatar_seed} name={selected.name} size={96} online={selected.online} />
            </div>

            <h3 className="text-xl font-bold text-white mb-0.5">{selected.name}</h3>
            <p className="text-sm mb-1" style={{ color: 'var(--neon-cyan)' }}>{selected.username}</p>
            <p className="text-xs mb-5" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {selected.online ? '● онлайн' : `был(а) ${selected.lastSeen}`}
            </p>

            {selected.bio && (
              <div className="w-full mb-4 p-3 rounded-2xl text-sm text-center"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)', color: 'hsl(var(--foreground))' }}>
                {selected.bio}
              </div>
            )}

            {selected.phone && (
              <div className="w-full mb-5 p-3 rounded-2xl" style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <Icon name="Phone" size={15} />
                  <span className="text-white">{selected.phone}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 w-full">
              <button
                onClick={handleWriteMessage}
                disabled={creating}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:scale-105 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, var(--neon-purple), #5b21b6)', boxShadow: '0 0 20px rgba(139,92,246,0.4)' }}
              >
                {creating
                  ? <Icon name="Loader2" size={16} className="animate-spin" />
                  : <Icon name="MessageCircle" size={16} />
                }
                Написать
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 opacity-40">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}>
              <Icon name="Users" size={36} style={{ color: 'hsl(var(--muted-foreground))' }} />
            </div>
            <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Выберите контакт</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ContactItem: React.FC<{ user: ApiUser; active: boolean; onClick: () => void }> = ({ user, active, onClick }) => (
  <div
    onClick={onClick}
    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200"
    style={{
      background: active ? 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,214,245,0.08))' : 'transparent',
      border: active ? '1px solid rgba(139,92,246,0.25)' : '1px solid transparent',
    }}
    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
  >
    <Avatar seed={user.avatar_seed} name={user.name} size={40} online={user.online} />
    <div className="flex-1 min-w-0">
      <div className="font-semibold text-sm text-white truncate">{user.name}</div>
      <div className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>{user.username}</div>
    </div>
  </div>
);

export default ContactsPage;
