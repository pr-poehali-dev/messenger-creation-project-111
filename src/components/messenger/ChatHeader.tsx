import React, { useState, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';
import { ApiChat } from '@/hooks/useChats';
import { api } from '@/api/client';
import UserProfileSheet from './UserProfileSheet';
import ChatMenu from './ChatMenu';

interface ChatHeaderProps {
  chat?: ApiChat;
  onBack?: () => void;
  onCall: (type: 'voice' | 'video') => void;
}

const HeaderBtn: React.FC<{ onClick: () => void; icon: string; tooltip: string }> = ({ onClick, icon, tooltip }) => (
  <button
    onClick={onClick}
    title={tooltip}
    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
    style={{ color: 'hsl(var(--muted-foreground))' }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'hsl(var(--muted-foreground))'; }}
  >
    <Icon name={icon} size={18} />
  </button>
);

const ChatHeader: React.FC<ChatHeaderProps> = ({ chat, onBack, onCall }) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const chatName = chat?.name || '...';
  const chatAvatar = chat?.avatar || '1';
  const chatOnline = chat?.online || false;
  const chatType = chat?.type || 'direct';
  const chatMembers = chat?.members || 0;
  const otherUserId = chat?.otherUserId;

  const handleWriteMessage = useCallback(async () => {
    if (!otherUserId) return;
    try {
      await api.createDirectChat(otherUserId);
    } catch { /* chat already exists */ }
  }, [otherUserId]);

  // Пункты меню для direct-чата
  const menuItems = otherUserId ? [
    {
      icon: 'User',
      label: 'Профиль',
      onClick: () => setProfileOpen(true),
    },
    {
      icon: 'Phone',
      label: 'Голосовой звонок',
      onClick: () => onCall('voice'),
    },
    {
      icon: 'Video',
      label: 'Видеозвонок',
      onClick: () => onCall('video'),
    },
    {
      icon: 'Ban',
      label: 'Заблокировать',
      onClick: () => setProfileOpen(true),
      danger: true,
    },
  ] : [
    {
      icon: 'Users',
      label: 'Участники',
      onClick: () => {},
    },
  ];

  return (
    <>
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--glass-border)' }}
      >
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-xl transition-all hover:scale-105 flex-shrink-0"
              style={{ background: 'var(--surface-3)', color: 'hsl(var(--muted-foreground))' }}
            >
              <Icon name="ChevronLeft" size={20} />
            </button>
          )}

          {/* Кликабельный аватар + имя → открывает профиль */}
          <button
            className="flex items-center gap-3 rounded-xl transition-all hover:opacity-80"
            style={{ background: 'transparent', cursor: otherUserId ? 'pointer' : 'default' }}
            onClick={() => otherUserId && setProfileOpen(true)}
          >
            <Avatar seed={chatAvatar} name={chatName} size={40} online={chatOnline} />
            <div className="text-left">
              <div className="font-semibold text-white text-sm">{chatName}</div>
              <div className="text-xs" style={{ color: 'var(--neon-cyan)' }}>
                {chatType === 'direct' && (chatOnline ? '● онлайн' : 'не в сети')}
                {chatType === 'group' && `${chatMembers} участников`}
                {chatType === 'channel' && 'канал'}
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {chatType === 'direct' && otherUserId && (
            <>
              <HeaderBtn onClick={() => onCall('voice')} icon="Phone" tooltip="Голосовой звонок" />
              <HeaderBtn onClick={() => onCall('video')} icon="Video" tooltip="Видеозвонок" />
            </>
          )}
          <HeaderBtn onClick={() => {}} icon="Search" tooltip="Поиск" />

          {/* Кнопка трёх точек с меню */}
          <div className="relative">
            <HeaderBtn onClick={() => setMenuOpen(p => !p)} icon="MoreVertical" tooltip="Ещё" />
            <ChatMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              items={menuItems}
            />
          </div>
        </div>
      </div>

      {/* Шторка профиля */}
      {otherUserId && (
        <UserProfileSheet
          userId={otherUserId}
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onWriteMessage={handleWriteMessage}
        />
      )}
    </>
  );
};

export default ChatHeader;
