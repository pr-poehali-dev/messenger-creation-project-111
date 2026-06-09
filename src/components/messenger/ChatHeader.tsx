import React from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';
import { ApiChat } from '@/hooks/useChats';

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
  const chatName = chat?.name || '...';
  const chatAvatar = chat?.avatar || '1';
  const chatOnline = chat?.online || false;
  const chatType = chat?.type || 'direct';
  const chatMembers = chat?.members || 0;

  return (
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
        <Avatar seed={chatAvatar} name={chatName} size={40} online={chatOnline} />
        <div>
          <div className="font-semibold text-white text-sm">{chatName}</div>
          <div className="text-xs" style={{ color: 'var(--neon-cyan)' }}>
            {chatType === 'direct' && (chatOnline ? '● онлайн' : 'не в сети')}
            {chatType === 'group' && `${chatMembers} участников`}
            {chatType === 'channel' && 'канал'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {chatType === 'direct' && chat?.otherUserId && (
          <>
            <HeaderBtn onClick={() => onCall('voice')} icon="Phone" tooltip="Голосовой звонок" />
            <HeaderBtn onClick={() => onCall('video')} icon="Video" tooltip="Видеозвонок" />
          </>
        )}
        <HeaderBtn onClick={() => {}} icon="Search" tooltip="Поиск" />
        <HeaderBtn onClick={() => {}} icon="MoreVertical" tooltip="Ещё" />
      </div>
    </div>
  );
};

export default ChatHeader;
