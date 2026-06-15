import React, { useRef, useEffect, useState, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';
import { ApiMessage, MessageReaction, ReplyTo } from '@/hooks/useChats';
import { api } from '@/api/client';

interface MessageListProps {
  messages: ApiMessage[];
  chatId: number;
  chatType: string;
  onCallback: (type: 'voice' | 'video') => void;
  onReactionUpdate: (messageId: number, reactions: MessageReaction[]) => void;
  onReply: (msg: ReplyTo) => void;
}

const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

const EmojiPicker: React.FC<{
  onSelect: (emoji: string) => void;
  onClose: () => void;
  isMe: boolean;
}> = ({ onSelect, onClose, isMe }) => (
  <>
    <div className="fixed inset-0 z-40" onClick={onClose} />
    <div
      className="absolute z-50 flex gap-1 p-1.5 rounded-2xl animate-fade-in"
      style={{
        background: 'var(--surface-3)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        bottom: '100%',
        marginBottom: 6,
        ...(isMe ? { right: 0 } : { left: 0 }),
      }}
    >
      {QUICK_EMOJIS.map(e => (
        <button
          key={e}
          onClick={() => { onSelect(e); onClose(); }}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-lg transition-all hover:scale-125 active:scale-95"
        >
          {e}
        </button>
      ))}
    </div>
  </>
);

const ReactionsBar: React.FC<{
  reactions: MessageReaction[];
  messageId: number;
  isMe: boolean;
  onUpdate: (reactions: MessageReaction[]) => void;
}> = ({ reactions, messageId, isMe, onUpdate }) => {
  if (reactions.length === 0) return null;
  const handleClick = async (r: MessageReaction) => {
    try {
      const res = r.me
        ? await api.removeReaction(messageId, r.emoji)
        : await api.addReaction(messageId, r.emoji);
      onUpdate((res as { reactions: MessageReaction[] }).reactions);
    } catch { /* ignore */ }
  };
  return (
    <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
      {reactions.map(r => (
        <button
          key={r.emoji}
          onClick={() => handleClick(r)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all hover:scale-105 active:scale-95"
          style={{
            background: r.me ? 'rgba(139,92,246,0.25)' : 'var(--surface-3)',
            border: `1px solid ${r.me ? 'rgba(139,92,246,0.5)' : 'var(--glass-border)'}`,
            color: 'white',
          }}
        >
          <span>{r.emoji}</span>
          <span style={{ color: r.me ? 'var(--neon-cyan)' : 'hsl(var(--muted-foreground))' }}>{r.count}</span>
        </button>
      ))}
    </div>
  );
};

// Блок цитаты внутри пузыря
const ReplyBlock: React.FC<{ replyTo: ReplyTo; isMe: boolean }> = ({ replyTo, isMe }) => (
  <div
    className="flex items-start gap-1.5 mb-1.5 px-2 py-1.5 rounded-xl text-xs"
    style={{
      background: isMe ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.08)',
      borderLeft: '2px solid var(--neon-cyan)',
    }}
  >
    <div className="min-w-0">
      <p className="font-semibold truncate mb-0.5" style={{ color: 'var(--neon-cyan)' }}>{replyTo.senderName}</p>
      <p className="truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>
        {replyTo.type === 'image' ? '🖼 Фото' : replyTo.type === 'file' ? '📎 Файл' : replyTo.type === 'voice' ? '🎵 Голосовое' : replyTo.text}
      </p>
    </div>
  </div>
);

const MessageBubble: React.FC<{
  msg: ApiMessage;
  isMe: boolean;
  onCallback?: (type: 'voice' | 'video') => void;
  onReactionUpdate: (messageId: number, reactions: MessageReaction[]) => void;
  onReply: (msg: ReplyTo) => void;
}> = ({ msg, isMe, onCallback, onReactionUpdate, onReply }) => {
  const [imgError, setImgError] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bubbleClass = isMe ? 'msg-bubble-out text-white' : 'msg-bubble-in text-white';

  const handleAddReaction = useCallback(async (emoji: string) => {
    try {
      const existing = msg.reactions?.find(r => r.emoji === emoji);
      const res = existing?.me
        ? await api.removeReaction(msg.id, emoji)
        : await api.addReaction(msg.id, emoji);
      onReactionUpdate(msg.id, (res as { reactions: MessageReaction[] }).reactions);
    } catch { /* ignore */ }
  }, [msg.id, msg.reactions, onReactionUpdate]);

  const onTouchStart = () => {
    longPressRef.current = setTimeout(() => setShowPicker(true), 500);
  };
  const onTouchEnd = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  const handleReply = () => {
    onReply({
      id: msg.id,
      senderName: msg.senderName || 'Вы',
      text: msg.text,
      type: msg.type,
    });
  };

  const replyBlock = msg.replyTo ? <ReplyBlock replyTo={msg.replyTo} isMe={isMe} /> : null;

  const bubbleContent = (() => {
    if (msg.type === 'image' && msg.fileUrl && !imgError) {
      return (
        <div className={`overflow-hidden ${isMe ? 'rounded-[18px_18px_4px_18px]' : 'rounded-[18px_18px_18px_4px]'}`} style={{ maxWidth: 260 }}>
          {replyBlock && <div className="px-2 pt-2">{replyBlock}</div>}
          <img
            src={msg.fileUrl} alt={msg.fileName || 'изображение'}
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
        <div className={`flex items-center gap-2.5 px-3 py-2 ${bubbleClass}`} style={{ minWidth: 180 }}>
          <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: isMissed ? 'rgba(239,68,68,0.25)' : isMe ? 'rgba(255,255,255,0.2)' : 'var(--surface-4)' }}>
            <Icon name={isVideo ? 'Video' : 'Phone'} size={13} style={{ color: isMissed ? '#f87171' : 'white' }} />
          </div>
          <span className="text-sm flex-1" style={{ color: isMissed ? (isMe ? '#fca5a5' : '#f87171') : 'white' }}>{msg.text}</span>
          {onCallback && (
            <button onClick={() => onCallback(isVideo ? 'video' : 'voice')}
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Icon name={isVideo ? 'Video' : 'Phone'} size={11} className="text-white" />
            </button>
          )}
        </div>
      );
    }

    if (msg.type === 'voice' && msg.fileUrl) {
      return (
        <div className={`flex flex-col px-3 py-2.5 ${bubbleClass}`} style={{ minWidth: 200, maxWidth: 280 }}>
          {replyBlock}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: isMe ? 'rgba(255,255,255,0.2)' : 'var(--surface-4)' }}>
              <Icon name="Mic" size={15} className="text-white" />
            </div>
            <audio src={msg.fileUrl} controls className="flex-1 h-7" style={{ minWidth: 0 }} />
          </div>
        </div>
      );
    }

    if (msg.type === 'file' && msg.fileUrl) {
      return (
        <div className={`flex flex-col px-4 py-3 ${bubbleClass}`} style={{ minWidth: 200, maxWidth: 280 }}>
          {replyBlock}
          <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 no-underline">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: isMe ? 'rgba(255,255,255,0.15)' : 'var(--surface-4)' }}>
              <Icon name="FileText" size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{msg.fileName || msg.text}</p>
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <Icon name="Download" size={11} />Скачать
              </p>
            </div>
          </a>
        </div>
      );
    }

    return (
      <div className={`px-4 py-2.5 ${bubbleClass}`}>
        {replyBlock}
        <p className="text-sm leading-relaxed" style={{ wordBreak: 'break-word' }}>{msg.text}</p>
      </div>
    );
  })();

  return (
    <div className="relative group"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchEnd}
    >
      {bubbleContent}

      {/* Кнопки hover: реакция + ответить */}
      <div
        className={`absolute -top-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1
          ${isMe ? 'left-0 -translate-x-full -ml-1' : 'right-0 translate-x-full ml-1'}`}
      >
        <button
          onClick={handleReply}
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}
          title="Ответить"
        >
          <Icon name="CornerUpLeft" size={11} style={{ color: 'hsl(var(--muted-foreground))' }} />
        </button>
        <button
          onClick={() => setShowPicker(p => !p)}
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}
          title="Реакция"
        >
          😊
        </button>
      </div>

      {showPicker && (
        <EmojiPicker
          onSelect={handleAddReaction}
          onClose={() => setShowPicker(false)}
          isMe={isMe}
        />
      )}
    </div>
  );
};

const MessageList: React.FC<MessageListProps> = ({ messages, chatId, chatType, onCallback, onReactionUpdate, onReply }) => {
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
      if (lastMsg?.isMe) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        <span className="text-[11px] px-3 py-1 rounded-full"
          style={{ color: 'hsl(var(--muted-foreground))', background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}>
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
              <MessageBubble
                msg={msg}
                isMe={msg.isMe}
                onCallback={onCallback}
                onReactionUpdate={onReactionUpdate}
                onReply={onReply}
              />
              <ReactionsBar
                reactions={msg.reactions || []}
                messageId={msg.id}
                isMe={msg.isMe}
                onUpdate={(r) => onReactionUpdate(msg.id, r)}
              />
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
