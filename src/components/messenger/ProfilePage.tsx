import React, { useState } from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';
import { currentUser } from '@/data/mockData';

const ProfilePage: React.FC = () => {
  const [notifications, setNotifications] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [preview, setPreview] = useState(true);
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [editing, setEditing] = useState(false);

  const stats = [
    { label: 'Сообщений', value: '2 481' },
    { label: 'Контактов', value: '64' },
    { label: 'Групп', value: '12' },
  ];

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{
        background: 'var(--surface-1)',
        backgroundImage: 'radial-gradient(circle at 70% 10%, rgba(139,92,246,0.08) 0%, transparent 50%)',
      }}
    >
      <div className="max-w-lg mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-white">Личный кабинет</h2>
          <button
            onClick={() => setEditing(!editing)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
            style={{
              background: editing
                ? 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))'
                : 'var(--surface-3)',
              color: 'white',
              border: editing ? 'none' : '1px solid var(--glass-border)',
              boxShadow: editing ? '0 0 15px rgba(139,92,246,0.4)' : 'none',
            }}
          >
            <Icon name={editing ? 'Check' : 'Pencil'} size={14} />
            {editing ? 'Сохранить' : 'Редактировать'}
          </button>
        </div>

        {/* Avatar & name */}
        <div className="flex flex-col items-center mb-8 animate-fade-in">
          <div className="relative mb-4">
            <Avatar seed={currentUser.avatar} name={currentUser.name} size={100} online />
            {editing && (
              <button
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))', boxShadow: '0 0 12px rgba(139,92,246,0.5)' }}
              >
                <Icon name="Camera" size={14} className="text-white" />
              </button>
            )}
          </div>

          {editing ? (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="text-center text-xl font-bold bg-transparent outline-none text-white border-b-2 pb-1 mb-2"
              style={{ borderColor: 'var(--neon-purple)', fontFamily: 'inherit', width: 280 }}
            />
          ) : (
            <h3 className="text-xl font-bold text-white mb-1">{name}</h3>
          )}
          <p className="text-sm" style={{ color: 'var(--neon-cyan)' }}>{currentUser.username}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {stats.map(s => (
            <div
              key={s.label}
              className="flex flex-col items-center py-4 rounded-2xl"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}
            >
              <span className="text-xl font-black text-white mb-0.5">{s.value}</span>
              <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Info */}
        <div
          className="rounded-2xl overflow-hidden mb-4"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}
        >
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
              <p className="text-sm text-white">{bio}</p>
            )}
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Телефон</p>
            <div className="flex items-center gap-2">
              <Icon name="Phone" size={14} style={{ color: 'var(--neon-cyan)' }} />
              <span className="text-sm text-white">{currentUser.phone}</span>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div
          className="rounded-2xl overflow-hidden mb-4"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}
        >
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>Уведомления</p>
            <ToggleRow label="Push-уведомления" icon="Bell" value={notifications} onChange={setNotifications} />
            <ToggleRow label="Звуки" icon="Volume2" value={sounds} onChange={setSounds} />
            <ToggleRow label="Предпросмотр" icon="Eye" value={preview} onChange={setPreview} last />
          </div>
        </div>

        {/* Actions */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}
        >
          <ActionRow icon="Shield" label="Конфиденциальность" />
          <ActionRow icon="Palette" label="Оформление" />
          <ActionRow icon="HelpCircle" label="Помощь" />
          <ActionRow icon="LogOut" label="Выйти из аккаунта" danger last />
        </div>
      </div>
    </div>
  );
};

const ToggleRow: React.FC<{
  label: string; icon: string; value: boolean; onChange: (v: boolean) => void; last?: boolean;
}> = ({ label, icon, value, onChange, last }) => (
  <div
    className="flex items-center justify-between py-2.5"
    style={{ borderBottom: last ? 'none' : '1px solid var(--glass-border)' }}
  >
    <div className="flex items-center gap-3">
      <Icon name={icon} size={16} style={{ color: value ? 'var(--neon-purple)' : 'hsl(var(--muted-foreground))' }} />
      <span className="text-sm text-white">{label}</span>
    </div>
    <button
      onClick={() => onChange(!value)}
      className="relative w-10 h-5 rounded-full transition-all duration-300 flex-shrink-0"
      style={{
        background: value
          ? 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))'
          : 'var(--surface-4)',
        boxShadow: value ? '0 0 10px rgba(139,92,246,0.4)' : 'none',
      }}
    >
      <div
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300"
        style={{ left: value ? 22 : 2 }}
      />
    </button>
  </div>
);

const ActionRow: React.FC<{ icon: string; label: string; danger?: boolean; last?: boolean }> = ({ icon, label, danger, last }) => (
  <div
    className="flex items-center justify-between px-4 py-3 cursor-pointer transition-all hover:brightness-110"
    style={{ borderBottom: last ? 'none' : '1px solid var(--glass-border)' }}
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
