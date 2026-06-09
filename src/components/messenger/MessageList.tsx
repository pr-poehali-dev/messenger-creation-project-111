import React, { useRef, useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';
import { ApiMessage } from '@/hooks/useChats';

interface MessageListProps {
  messages: ApiMessage[];
  chatId: number;
  chatType: string;
  onCallback: (type: 'voice' | 'video') => void;
}

const MessageBubble: React.FC<{
  msg: ApiMessage;
  isMe: boolean;
  onCallback?: (type: 'voice' | 'video') => void;
}> = ({ msg, isMe, onCallback }) => {
  const [imgError, setImgError] = useState(false);

  const bubbleClass = isMe ? 'msg-bubble-out text-white' : 'msg-bubble-in text-white';

  if (msg.type === 'image' && msg.fileUrl && !imgError) {
    return (
      <div className={`overflow-hidden ${isMe ? 'rounded-[18px_18px_4px_18px]' : 'rounded-[18px_18px_18px_4px]'}`}
        style={{ maxWidth: 260 }}>
        <img
          src={msg.fileUrl}
          alt={msg.fileName || 'изображение'}
          className="block w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
          style={{ maxHeight: 300 }}
          onError={() => setImgError(true)}
          onClick={() => window.open(msg.fileUrl!, '_blank')}
        />
        {msg.text && msg.text !== msg.fileName && (
          <div className="px-3 py-2" style={{ background: isMe ? 'rgba(0,0,0,0.2)' : 'var(--surface-4)' }}>
            <p className="text-xs text-white" style={{ wordBreak: 'break-word' }}>{msg.text}</p>
          </div>
        )}
      </div>
    );
  }

  if (msg.type === 'call') {
    const isVideo = msg.text?.includes('📹') || msg.text?.includes('идео');
    const isMissed = msg.text?.includes('Пропущенный') || msg.text?.includes('не состоялся');
    return (
      <div
        className={`flex items-center gap-2.5 px-3 py-2 ${bubbleClass}`}
        style={{ minWidth: 180 }}
      >
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: isMissed ? 'rgba(239,68,68,0.25)' : isMe ? 'rgba(255,255,255,0.2)' : 'var(--surface-4)' }}
        >
          <Icon
            name={isVideo ? 'Video' : 'Phone'}
            size={13}
            style={{ color: isMissed ? '#f87171' : 'white' }}
          />
        </div>
        <span className="text-sm flex-1" style={{ color: isMissed ? (isMe ? '#fca5a5' : '#f87171') : 'white' }}>
          {msg.text}
        </span>
        {onCallback && (
          <button
            onClick={() => onCallback(isVideo ? 'video' : 'voice')}
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            style={{ background: 'rgba(255,255,255,0.15)' }}
            title="Перезвонить"
          >
            <Icon name={isVideo ? 'Video' : 'Phone'} size={11} className="text-white" />
          </button>
        )}
      </div>
    );
  }

  if (msg.type === 'voice' && msg.fileUrl) {
    return (
      <div className={`flex items-center gap-3 px-3 py-2.5 ${bubbleClass}`} style={{ minWidth: 200, maxWidth: 280 }}>
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: isMe ? 'rgba(255,255,255,0.2)' : 'var(--surface-4)' }}>
          <Icon name="Mic" size={15} className="text-white" />
        </div>
        <audio src={msg.fileUrl} controls
          className="flex-1 h-7"
          style={{ minWidth: 0 }}
        />
      </div>
    );
  }

  if (msg.type === 'file' && msg.fileUrl) {
    return (
      <a
        href={msg.fileUrl}
        target="_blank"
        rel="noreferrer"
        className={`flex items-center gap-3 px-4 py-3 no-underline ${bubbleClass}`}
        style={{ minWidth: 200, maxWidth: 280 }}
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: isMe ? 'rgba(255,255,255,0.15)' : 'var(--surface-4)' }}
        >
          <Icon name="FileText" size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{msg.fileName || msg.text}</p>
          <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <Icon name="Download" size={11} />
            Скачать
          </p>
        </div>
      </a>
    );
  }

  return (
    <div className={`px-4 py-2.5 ${bubbleClass}`}>
      <p className="text-sm leading-relaxed" style={{ wordBreak: 'break-word' }}>{msg.text}</p>
    </div>
  );
};

const MessageList: React.FC<MessageListProps> = ({ messages, chatId, chatType, onCallback }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(0);
  const isInitialRef = useRef<boolean>(true);

  useEffect(() => {
    const count = messages.length;
    if (count === 0) return;

    if (isInitialRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
      isInitialRef.current = false;
      prevCountRef.current = count;
      return;
    }

    if (count > prevCountRef.current) {
      const lastMsg = messages[count - 1];
      if (lastMsg?.isMe) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevCountRef.current = count;
  }, [messages]);

  useEffect(() => {
    isInitialRef.current = true;
    prevCountRef.current = 0;
  }, [chatId]);

  return (
    <div
      className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
      style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(139,92,246,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(6,214,245,0.05) 0%, transparent 50%)' }}
    >
      <div className="flex items-center justify-center gap-3 my-2">
        <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />
        <span className="text-[11px] px-3 py-1 rounded-full" style={{ color: 'hsl(var(--muted-foreground))', background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}>
          Сегодня
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />
      </div>

      {messages.length === 0 && (
        <div className="flex items-center justify-center h-32 opacity-40">
          <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Нет сообщений. Начните диалог!</p>
        </div>
      )}

      {messages.map((msg: ApiMessage, idx: number) => {
        const showAvatar = !msg.isMe && (idx === 0 || messages[idx - 1]?.senderId !== msg.senderId);
        return (
          <div
            key={msg.id}
            className={`flex items-end gap-2 animate-msg ${msg.isMe ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {!msg.isMe && (
              <div style={{ width: 32 }}>
                {showAvatar && <Avatar seed={msg.senderAvatar} name={msg.senderName} size={32} />}
              </div>
            )}
            <div className={`max-w-[70%] flex flex-col gap-0.5 ${msg.isMe ? 'items-end' : 'items-start'}`}>
              {!msg.isMe && showAvatar && chatType !== 'direct' && (
                <span className="text-[11px] font-semibold ml-3 mb-0.5" style={{ color: 'var(--neon-cyan)' }}>
                  {msg.senderName}
                </span>
              )}
              <MessageBubble msg={msg} isMe={msg.isMe} onCallback={onCallback} />
              <div className={`flex items-center gap-1 mx-1 ${msg.isMe ? 'flex-row-reverse' : ''}`}>
                <span className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{msg.time}</span>
                {msg.isMe && (
                  <Icon name={msg.read ? 'CheckCheck' : 'Check'} size={12}
                    style={{ color: msg.read ? 'var(--neon-cyan)' : 'hsl(var(--muted-foreground))' }} />
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
