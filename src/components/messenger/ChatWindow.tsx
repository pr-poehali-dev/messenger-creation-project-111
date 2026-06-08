import React, { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';
import { useMessages, ApiMessage, ApiChat } from '@/hooks/useChats';

interface ChatWindowProps {
  chatId: number;
  chat?: ApiChat;
  onCallStart: (type: 'voice' | 'video', chatName: string) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId, chat, onCallStart }) => {
  const { messages, sendMessage } = useMessages(chatId);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    const t = text.trim();
    setText('');
    try {
      await sendMessage(t);
    } catch {
      setText(t);
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const emojis = ['😊', '😂', '🔥', '👍', '❤️', '🚀', '🎉', '✨', '💡', '👀'];

  const chatName = chat?.name || '...';
  const chatAvatar = chat?.avatar || '1';
  const chatOnline = chat?.online || false;
  const chatType = chat?.type || 'direct';
  const chatMembers = chat?.members || 0;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-1)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--glass-border)' }}
      >
        <div className="flex items-center gap-3">
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
          {chatType !== 'channel' && (
            <>
              <HeaderBtn onClick={() => onCallStart('voice', chatName)} icon="Phone" tooltip="Голосовой звонок" />
              <HeaderBtn onClick={() => onCallStart('video', chatName)} icon="Video" tooltip="Видеозвонок" />
            </>
          )}
          <HeaderBtn onClick={() => {}} icon="Search" tooltip="Поиск" />
          <HeaderBtn onClick={() => {}} icon="MoreVertical" tooltip="Ещё" />
        </div>
      </div>

      {/* Messages */}
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
                <div className={`px-4 py-2.5 ${msg.isMe ? 'msg-bubble-out text-white' : 'msg-bubble-in text-white'}`}>
                  <p className="text-sm leading-relaxed" style={{ wordBreak: 'break-word' }}>{msg.text}</p>
                </div>
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

      {/* Input */}
      <div className="px-4 py-3 flex-shrink-0" style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--glass-border)' }}>
        {showEmoji && (
          <div className="flex gap-2 mb-2 p-2 rounded-xl" style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}>
            {emojis.map(e => (
              <button key={e} onClick={() => { setText(prev => prev + e); setShowEmoji(false); }} className="text-lg hover:scale-125 transition-transform">{e}</button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 px-3 py-2 rounded-2xl" style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}>
          <button
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            <Icon name="Paperclip" size={18} />
          </button>
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Написать сообщение..."
            rows={1}
            className="flex-1 bg-transparent outline-none text-white text-sm resize-none placeholder:text-muted-foreground"
            style={{ fontFamily: 'inherit', maxHeight: 120, lineHeight: '1.5' }}
          />
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:scale-105"
            style={{ color: showEmoji ? 'var(--neon-purple)' : 'hsl(var(--muted-foreground))' }}
          >
            <Icon name="Smile" size={18} />
          </button>
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: text.trim() ? 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' : 'var(--surface-4)',
              boxShadow: text.trim() ? '0 0 15px rgba(139,92,246,0.4)' : 'none',
            }}
          >
            <Icon name="Send" size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

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

export default ChatWindow;