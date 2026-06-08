import React, { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';
import { chats, messages as allMessages, users, Message } from '@/data/mockData';

interface ChatWindowProps {
  chatId: string;
  onCallStart: (type: 'voice' | 'video', chatName: string) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId, onCallStart }) => {
  const chat = chats.find(c => c.id === chatId);
  const [msgs, setMsgs] = useState<Message[]>(allMessages[chatId] || []);
  const [text, setText] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMsgs(allMessages[chatId] || []);
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const sendMessage = () => {
    if (!text.trim()) return;
    const newMsg: Message = {
      id: 'm' + Date.now(),
      senderId: 'me',
      text: text.trim(),
      time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setMsgs(prev => [...prev, newMsg]);
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const emojis = ['😊', '😂', '🔥', '👍', '❤️', '🚀', '🎉', '✨', '💡', '👀'];

  if (!chat) return null;

  const getSender = (senderId: string) => users.find(u => u.id === senderId);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-1)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--glass-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <Avatar seed={chat.avatar} name={chat.name} size={40} online={chat.online} />
          <div>
            <div className="font-semibold text-white text-sm">{chat.name}</div>
            <div className="text-xs" style={{ color: 'var(--neon-cyan)' }}>
              {chat.type === 'direct' && (chat.online ? '● онлайн' : 'был(а) недавно')}
              {chat.type === 'group' && `${chat.members} участников`}
              {chat.type === 'channel' && `${chat.subscribers?.toLocaleString()} подписчиков`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {chat.type !== 'channel' && (
            <>
              <HeaderBtn onClick={() => onCallStart('voice', chat.name)} icon="Phone" tooltip="Голосовой звонок" />
              <HeaderBtn onClick={() => onCallStart('video', chat.name)} icon="Video" tooltip="Видеозвонок" />
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
        {/* Date separator */}
        <div className="flex items-center justify-center gap-3 my-2">
          <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />
          <span className="text-[11px] px-3 py-1 rounded-full" style={{ color: 'hsl(var(--muted-foreground))', background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}>
            Сегодня
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />
        </div>

        {msgs.map((msg, idx) => {
          const isMe = msg.senderId === 'me';
          const sender = getSender(msg.senderId);
          const showAvatar = !isMe && (idx === 0 || msgs[idx - 1]?.senderId !== msg.senderId);

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 animate-msg ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              style={{ animationDelay: `${idx * 0.02}s` }}
            >
              {!isMe && (
                <div style={{ width: 32 }}>
                  {showAvatar && <Avatar seed={sender?.avatar || '1'} name={sender?.name || '?'} size={32} />}
                </div>
              )}

              <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isMe && showAvatar && chat.type !== 'direct' && (
                  <span className="text-[11px] font-semibold ml-3 mb-0.5" style={{ color: 'var(--neon-cyan)' }}>
                    {sender?.name}
                  </span>
                )}
                <div className={`px-4 py-2.5 ${isMe ? 'msg-bubble-out text-white' : 'msg-bubble-in text-white'}`}>
                  <p className="text-sm leading-relaxed" style={{ wordBreak: 'break-word' }}>{msg.text}</p>
                </div>

                {msg.reactions && msg.reactions.length > 0 && (
                  <div className="flex gap-1 mx-1">
                    {msg.reactions.map((r, ri) => (
                      <div
                        key={ri}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-pointer hover:scale-105 transition-transform"
                        style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}
                      >
                        <span>{r.emoji}</span>
                        <span style={{ color: 'hsl(var(--muted-foreground))' }}>{r.count}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className={`flex items-center gap-1 mx-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{msg.time}</span>
                  {isMe && (
                    <Icon
                      name={msg.read ? 'CheckCheck' : 'Check'}
                      size={12}
                      style={{ color: msg.read ? 'var(--neon-cyan)' : 'hsl(var(--muted-foreground))' }}
                    />
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
        {/* Emoji picker */}
        {showEmoji && (
          <div
            className="flex gap-2 mb-2 p-2 rounded-xl"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}
          >
            {emojis.map(e => (
              <button
                key={e}
                onClick={() => { setText(prev => prev + e); setShowEmoji(false); }}
                className="text-lg hover:scale-125 transition-transform"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <div
          className="flex items-end gap-2 px-3 py-2 rounded-2xl"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}
        >
          <button
            onClick={() => setShowAttach(!showAttach)}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:scale-105"
            style={{ color: showAttach ? 'var(--neon-purple)' : 'hsl(var(--muted-foreground))' }}
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
            style={{
              fontFamily: 'inherit',
              maxHeight: 120,
              lineHeight: '1.5',
            }}
          />

          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:scale-105"
            style={{ color: showEmoji ? 'var(--neon-purple)' : 'hsl(var(--muted-foreground))' }}
          >
            <Icon name="Smile" size={18} />
          </button>

          <button
            onClick={sendMessage}
            disabled={!text.trim()}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: text.trim()
                ? 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))'
                : 'var(--surface-4)',
              boxShadow: text.trim() ? '0 0 15px rgba(139,92,246,0.4)' : 'none',
              transform: text.trim() ? 'scale(1)' : 'scale(0.95)',
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
    style={{
      color: 'hsl(var(--muted-foreground))',
      background: 'transparent',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)';
      (e.currentTarget as HTMLElement).style.color = 'white';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.background = 'transparent';
      (e.currentTarget as HTMLElement).style.color = 'hsl(var(--muted-foreground))';
    }}
  >
    <Icon name={icon} size={18} />
  </button>
);

export default ChatWindow;
