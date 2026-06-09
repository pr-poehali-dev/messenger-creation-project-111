import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';
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
  const [contacts, setContacts] = useState<ApiUser[]>([]);
  const [selected, setSelected] = useState<ApiUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Поиск по @username для добавления
  const [addQuery, setAddQuery] = useState('');
  const [searchResult, setSearchResult] = useState<ApiUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);

  const loadContacts = useCallback(async () => {
    try {
      const data = await api.getContacts();
      setContacts((data.contacts as ApiUser[]) || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const handleSearch = async () => {
    const q = addQuery.trim().replace(/^@+/, '');
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    try {
      const data = await api.getUsers(q);
      const users = (data.users as ApiUser[]) || [];
      if (users.length === 0) {
        setSearchError('Пользователь не найден');
      } else {
        setSearchResult(users[0]);
      }
    } catch {
      setSearchError('Ошибка поиска');
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (user: ApiUser) => {
    setAdding(true);
    try {
      await api.addContact(user.id);
      await loadContacts();
      setSearchResult(null);
      setAddQuery('');
      setShowAddPanel(false);
    } catch { /* ignore */ }
    finally { setAdding(false); }
  };

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

  const handleRemove = async () => {
    if (!selected) return;
    setRemoving(true);
    try {
      await api.removeContact(selected.id);
      setContacts(prev => prev.filter(c => c.id !== selected.id));
      setSelected(null);
    } catch { /* ignore */ }
    finally { setRemoving(false); }
  };

  const handleBack = () => setSelected(null);

  const online = contacts.filter(u => u.online);
  const offline = contacts.filter(u => !u.online);

  const isContact = (id: number) => contacts.some(c => c.id === id);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel */}
      <div
        className={`${selected ? 'hidden md:flex' : 'flex'} flex-col h-full w-full md:w-[300px] flex-shrink-0`}
        style={{
          background: 'var(--surface-2)',
          borderRight: '1px solid var(--glass-border)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 64px)',
        }}
      >
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Контакты</h2>
            <button
              onClick={() => { setShowAddPanel(p => !p); setSearchResult(null); setAddQuery(''); setSearchError(''); }}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
              style={{ background: showAddPanel ? 'var(--neon-purple)' : 'var(--surface-3)', color: 'white' }}
              title="Добавить контакт"
            >
              <Icon name={showAddPanel ? 'X' : 'UserPlus'} size={16} />
            </button>
          </div>

          {/* Панель добавления */}
          {showAddPanel && (
            <div
              className="mb-3 p-3 rounded-2xl animate-fade-in"
              style={{ background: 'var(--surface-3)', border: '1px solid rgba(139,92,246,0.3)' }}
            >
              <p className="text-xs mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Введите точный @username
              </p>
              <div className="flex gap-2">
                <input
                  value={addQuery}
                  onChange={e => { setAddQuery(e.target.value); setSearchError(''); setSearchResult(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                  placeholder="@username"
                  className="flex-1 px-3 py-1.5 rounded-xl text-sm outline-none text-white placeholder:text-muted-foreground"
                  style={{ background: 'var(--surface-4)', border: '1px solid var(--glass-border)', fontFamily: 'inherit' }}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !addQuery.trim()}
                  className="px-3 py-1.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' }}
                >
                  {searching ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Search" size={14} />}
                </button>
              </div>
              {searchError && (
                <p className="text-xs mt-2" style={{ color: '#f87171' }}>{searchError}</p>
              )}
              {searchResult && (
                <div className="mt-2 flex items-center gap-2 p-2 rounded-xl" style={{ background: 'var(--surface-4)' }}>
                  <Avatar seed={searchResult.avatar_seed} name={searchResult.name} size={36} online={searchResult.online} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{searchResult.name}</div>
                    <div className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>{searchResult.username}</div>
                  </div>
                  {isContact(searchResult.id) ? (
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ color: 'var(--neon-cyan)', background: 'rgba(6,214,245,0.1)' }}>
                      Добавлен
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAdd(searchResult)}
                      disabled={adding}
                      className="px-2 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' }}
                    >
                      {adding ? <Icon name="Loader2" size={12} className="animate-spin" /> : 'Добавить'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {contacts.length === 0 && !showAddPanel && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 opacity-40">
              <Icon name="Users" size={28} style={{ color: 'hsl(var(--muted-foreground))' }} />
              <p className="text-xs text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Контактов пока нет.<br />Добавьте по @username
              </p>
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

      {/* Right panel — contact details */}
      <div
        className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-y-auto`}
        style={{ background: 'var(--surface-1)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 64px)' }}
      >
        {selected ? (
          <>
            <div className="md:hidden flex items-center px-4 pt-4 pb-2">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--neon-cyan)' }}
              >
                <Icon name="ChevronLeft" size={18} />
                Назад
              </button>
            </div>

            <div className="flex flex-col items-center px-6 py-6 animate-fade-in" style={{ maxWidth: 340, margin: '0 auto', width: '100%' }}>
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
                  {creating ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="MessageCircle" size={16} />}
                  Написать
                </button>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="w-10 flex items-center justify-center rounded-xl transition-all hover:scale-105 disabled:opacity-60"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                  title="Удалить контакт"
                >
                  {removing ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="UserMinus" size={16} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40">
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