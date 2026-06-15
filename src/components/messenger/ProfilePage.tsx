import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';
import { useAuth } from '@/context/useAuth';
import { api } from '@/api/client';

const ProfilePage: React.FC = () => {
  const { user, updateUser, logout } = useAuth();
  const [sounds, setSounds] = useState(true);
  const [preview, setPreview] = useState(true);
  const [name, setName] = useState(user?.name || '');

  // Реальный статус push-уведомлений
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof Notification !== 'undefined' && Notification.permission !== pushPermission) {
        setPushPermission(Notification.permission);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [pushPermission]);

  const handleTogglePush = async () => {
    if (pushPermission === 'denied') return; // браузер заблокировал — ничего не сделать
    if (pushPermission === 'granted') {
      // Отписываемся
      setPushLoading(true);
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
        }
        await api.unsubscribePush?.();
      } catch { /* ignore */ }
      finally { setPushLoading(false); }
      return;
    }
    // Запрашиваем разрешение и подписываемся
    setPushLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPushPermission(result);
      if (result === 'granted') {
        const reg = await navigator.serviceWorker.ready;
        const { vapid_public_key } = await api.getPushVapidKey() as { vapid_public_key: string };
        const b64 = vapid_public_key.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '=='.slice((b64.length + 3) % 4 ? 0 : 2);
        const raw = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
        await api.subscribePush(sub.toJSON() as PushSubscriptionJSON);
      }
    } catch { /* ignore */ }
    finally { setPushLoading(false); }
  };
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser({ name, bio, phone });
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{
        background: 'var(--surface-1)',
        backgroundImage: 'radial-gradient(circle at 70% 10%, rgba(139,92,246,0.08) 0%, transparent 50%)',
      }}
    >
      <div className="max-w-lg mx-auto px-6 py-8" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 80px)' }}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-white">Личный кабинет</h2>
          <button
            onClick={editing ? handleSave : () => setEditing(true)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 disabled:opacity-60"
            style={{
              background: editing ? 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' : 'var(--surface-3)',
              color: 'white',
              border: editing ? 'none' : '1px solid var(--glass-border)',
              boxShadow: editing ? '0 0 15px rgba(139,92,246,0.4)' : 'none',
            }}
          >
            {saving
              ? <Icon name="Loader2" size={14} className="animate-spin" />
              : <Icon name={editing ? 'Check' : 'Pencil'} size={14} />
            }
            {editing ? 'Сохранить' : 'Редактировать'}
          </button>
        </div>

        <div className="flex flex-col items-center mb-8 animate-fade-in">
          <div className="relative mb-4">
            <Avatar seed={user.avatar_seed} name={user.name} size={100} online />
          </div>
          {editing ? (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="text-center text-xl font-bold bg-transparent outline-none text-white border-b-2 pb-1 mb-2"
              style={{ borderColor: 'var(--neon-purple)', fontFamily: 'inherit', width: 280 }}
            />
          ) : (
            <h3 className="text-xl font-bold text-white mb-1">{user.name}</h3>
          )}
          <p className="text-sm" style={{ color: 'var(--neon-cyan)' }}>{user.username}</p>
        </div>

        {/* Info card */}
        <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>О себе</p>
            {editing ? (
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={2}
                className="w-full bg-transparent outline-none text-sm text-white resize-none"
                style={{ fontFamily: 'inherit' }}
              />
            ) : (
              <p className="text-sm text-white">{bio || 'Не указано'}</p>
            )}
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Телефон</p>
            {editing ? (
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="bg-transparent outline-none text-sm text-white w-full"
                style={{ fontFamily: 'inherit' }}
                placeholder="Введите телефон"
              />
            ) : (
              <div className="flex items-center gap-2">
                <Icon name="Phone" size={14} style={{ color: 'var(--neon-cyan)' }} />
                <span className="text-sm text-white">{phone || 'Не указан'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}>
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>Уведомления</p>

            {/* Push row */}
            <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <Icon name="Bell" size={16} style={{ color: pushPermission === 'granted' ? 'var(--neon-purple)' : 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
                <div className="min-w-0">
                  <span className="text-sm text-white">Push-уведомления</span>
                  {pushPermission === 'denied' && (
                    <p className="text-xs mt-0.5" style={{ color: '#f87171' }}>Заблокированы в браузере</p>
                  )}
                  {pushPermission === 'default' && (
                    <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Нажмите чтобы включить</p>
                  )}
                </div>
              </div>
              {pushPermission === 'denied' ? (
                <span className="text-xs px-2 py-1 rounded-lg flex-shrink-0" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}>
                  Блок
                </span>
              ) : (
                <button
                  onClick={handleTogglePush}
                  disabled={pushLoading}
                  className="relative w-10 h-5 rounded-full transition-all duration-300 flex-shrink-0 disabled:opacity-60"
                  style={{
                    background: pushPermission === 'granted' ? 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' : 'var(--surface-4)',
                    boxShadow: pushPermission === 'granted' ? '0 0 10px rgba(139,92,246,0.4)' : 'none',
                  }}
                >
                  {pushLoading
                    ? <div className="absolute inset-0 flex items-center justify-center"><Icon name="Loader2" size={12} className="animate-spin text-white" /></div>
                    : <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300" style={{ left: pushPermission === 'granted' ? 22 : 2 }} />
                  }
                </button>
              )}
            </div>

            <ToggleRow label="Звуки" icon="Volume2" value={sounds} onChange={setSounds} />
            <ToggleRow label="Предпросмотр" icon="Eye" value={preview} onChange={setPreview} last />
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}>
          <ActionRow icon="Shield" label="Конфиденциальность" onClick={() => {}} />
          <ActionRow icon="Palette" label="Оформление" onClick={() => {}} />
          <ActionRow icon="HelpCircle" label="Помощь" onClick={() => {}} />
          <ActionRow icon="LogOut" label="Выйти из аккаунта" onClick={logout} danger last />
        </div>
      </div>
    </div>
  );
};

const ToggleRow: React.FC<{ label: string; icon: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }> = ({
  label, icon, value, onChange, last
}) => (
  <div className="flex items-center justify-between py-2.5" style={{ borderBottom: last ? 'none' : '1px solid var(--glass-border)' }}>
    <div className="flex items-center gap-3">
      <Icon name={icon} size={16} style={{ color: value ? 'var(--neon-purple)' : 'hsl(var(--muted-foreground))' }} />
      <span className="text-sm text-white">{label}</span>
    </div>
    <button
      onClick={() => onChange(!value)}
      className="relative w-10 h-5 rounded-full transition-all duration-300 flex-shrink-0"
      style={{
        background: value ? 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' : 'var(--surface-4)',
        boxShadow: value ? '0 0 10px rgba(139,92,246,0.4)' : 'none',
      }}
    >
      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300" style={{ left: value ? 22 : 2 }} />
    </button>
  </div>
);

const ActionRow: React.FC<{ icon: string; label: string; onClick: () => void; danger?: boolean; last?: boolean }> = ({
  icon, label, onClick, danger, last
}) => (
  <div
    className="flex items-center justify-between px-4 py-3 cursor-pointer transition-all"
    style={{ borderBottom: last ? 'none' : '1px solid var(--glass-border)' }}
    onClick={onClick}
    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
  >
    <div className="flex items-center gap-3">
      <Icon name={icon} size={16} style={{ color: danger ? '#ef4444' : 'hsl(var(--muted-foreground))' }} />
      <span className="text-sm" style={{ color: danger ? '#ef4444' : 'white' }}>{label}</span>
    </div>
    <Icon name="ChevronRight" size={15} style={{ color: 'hsl(var(--muted-foreground))' }} />
  </div>
);

export default ProfilePage;