import React, { useEffect, useState, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';
import { api } from '@/api/client';

interface UserInfo {
  id: number;
  name: string;
  username: string;
  bio: string;
  phone: string;
  avatar_seed: string;
  online: boolean;
  lastSeen: string;
}

interface UserProfileSheetProps {
  userId: number;
  open: boolean;
  onClose: () => void;
  onWriteMessage?: () => void;
  onRelationChange?: () => void;
}

const UserProfileSheet: React.FC<UserProfileSheetProps> = ({
  userId, open, onClose, onWriteMessage, onRelationChange,
}) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isContact, setIsContact] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await api.getUserRelation(userId);
      setUser(data.user as UserInfo);
      setIsContact(!!data.is_contact);
      setIsBlocked(!!data.is_blocked);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const act = async (name: string, fn: () => Promise<unknown>) => {
    setActionLoading(name);
    try { await fn(); await load(); onRelationChange?.(); }
    catch { /* ignore */ }
    finally { setActionLoading(null); }
  };

  const handleAddContact = () => act('add', () => api.addContact(userId));
  const handleRemoveContact = () => act('remove', () => api.removeContact(userId));
  const handleBlock = () => act('block', () => api.blockUser(userId));
  const handleUnblock = () => act('unblock', () => api.unblockUser(userId));

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-y-auto"
        style={{
          width: 'min(360px, 100vw)',
          background: 'var(--surface-2)',
          borderLeft: '1px solid var(--glass-border)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
          animation: 'slideInRight 0.22s ease',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--glass-border)' }}
        >
          <span className="font-semibold text-white text-sm">Профиль</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
            style={{ background: 'var(--surface-3)', color: 'hsl(var(--muted-foreground))' }}
          >
            <Icon name="X" size={16} />
          </button>
        </div>

        {loading || !user ? (
          <div className="flex-1 flex items-center justify-center">
            <Icon name="Loader2" size={28} className="animate-spin" style={{ color: 'var(--neon-purple)' }} />
          </div>
        ) : (
          <div className="flex flex-col px-6 py-6 gap-5">
            {/* Avatar + name */}
            <div className="flex flex-col items-center gap-3">
              <Avatar seed={user.avatar_seed} name={user.name} size={88} online={user.online} />
              <div className="text-center">
                <h3 className="text-xl font-bold text-white">{user.name}</h3>
                <p className="text-sm mt-0.5" style={{ color: 'var(--neon-cyan)' }}>{user.username}</p>
                <p className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {user.online ? '● онлайн' : user.lastSeen ? `был(а) ${user.lastSeen}` : 'не в сети'}
                </p>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex gap-2 justify-center flex-wrap">
              {isContact && !isBlocked && (
                <span
                  className="flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium"
                  style={{ background: 'rgba(6,214,245,0.12)', color: 'var(--neon-cyan)', border: '1px solid rgba(6,214,245,0.25)' }}
                >
                  <Icon name="UserCheck" size={12} />
                  В контактах
                </span>
              )}
              {isBlocked && (
                <span
                  className="flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  <Icon name="Ban" size={12} />
                  Заблокирован
                </span>
              )}
            </div>

            {/* Bio */}
            {user.bio && (
              <div
                className="p-3 rounded-2xl text-sm text-center"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)', color: 'hsl(var(--foreground))' }}
              >
                {user.bio}
              </div>
            )}

            {/* Phone */}
            {user.phone && (
              <div className="p-3 rounded-2xl" style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <Icon name="Phone" size={15} />
                  <span className="text-white">{user.phone}</span>
                </div>
              </div>
            )}

            {/* Write message */}
            {!isBlocked && onWriteMessage && (
              <button
                onClick={() => { onWriteMessage(); onClose(); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, var(--neon-purple), #5b21b6)', boxShadow: '0 0 20px rgba(139,92,246,0.35)' }}
              >
                <Icon name="MessageCircle" size={16} />
                Написать сообщение
              </button>
            )}

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--glass-border)' }} />

            {/* Relation actions */}
            <div className="flex flex-col gap-2">
              {!isBlocked && (
                isContact ? (
                  <ActionBtn
                    icon="UserMinus"
                    label="Удалить из контактов"
                    loading={actionLoading === 'remove'}
                    onClick={handleRemoveContact}
                  />
                ) : (
                  <ActionBtn
                    icon="UserPlus"
                    label="Добавить в контакты"
                    loading={actionLoading === 'add'}
                    onClick={handleAddContact}
                    accent
                  />
                )
              )}

              {isBlocked ? (
                <ActionBtn
                  icon="ShieldOff"
                  label="Разблокировать"
                  loading={actionLoading === 'unblock'}
                  onClick={handleUnblock}
                />
              ) : (
                <ActionBtn
                  icon="Ban"
                  label="Заблокировать"
                  loading={actionLoading === 'block'}
                  onClick={handleBlock}
                  danger
                />
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
};

const ActionBtn: React.FC<{
  icon: string;
  label: string;
  loading?: boolean;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
}> = ({ icon, label, loading, onClick, accent, danger }) => {
  const color = danger ? '#f87171' : accent ? 'var(--neon-cyan)' : 'hsl(var(--foreground))';
  const bg = danger ? 'rgba(239,68,68,0.08)' : accent ? 'rgba(6,214,245,0.08)' : 'var(--surface-3)';
  const border = danger ? 'rgba(239,68,68,0.2)' : accent ? 'rgba(6,214,245,0.2)' : 'var(--glass-border)';
  return (
    <button
      onClick={onClick}
      disabled={!!loading}
      className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      {loading
        ? <Icon name="Loader2" size={16} className="animate-spin flex-shrink-0" />
        : <Icon name={icon} size={16} className="flex-shrink-0" />
      }
      {label}
    </button>
  );
};

export default UserProfileSheet;
