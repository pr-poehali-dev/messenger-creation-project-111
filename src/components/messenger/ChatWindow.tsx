import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';
import { useMessages, ApiMessage, ApiChat } from '@/hooks/useChats';
import { api } from '@/api/client';

interface ChatWindowProps {
  chatId: number;
  chat?: ApiChat;
  onCallStart: (type: 'voice' | 'video', chatName: string) => void;
  onBack?: () => void;
}

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'application/pdf': 'file',
  'text/plain': 'file',
  'application/zip': 'file',
  'application/x-zip-compressed': 'file',
  'application/msword': 'file',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'file',
  'application/vnd.ms-excel': 'file',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'file',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface FilePreview {
  file: File;
  previewUrl: string | null;
  isImage: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId, chat, onCallStart, onBack }) => {
  const { messages, sendMessage, sendFileMessage } = useMessages(chatId);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (filePreview) {
      await handleSendFile();
      return;
    }
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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadError('');

    if (!ALLOWED_TYPES[file.type]) {
      setUploadError('Тип файла не поддерживается');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setUploadError('Файл слишком большой (макс. 4 МБ)');
      return;
    }

    const isImage = file.type.startsWith('image/');
    let previewUrl: string | null = null;
    if (isImage) {
      previewUrl = URL.createObjectURL(file);
    }
    setFilePreview({ file, previewUrl, isImage });
  }, []);

  const handleSendFile = async () => {
    if (!filePreview) return;
    setUploading(true);
    setUploadError('');
    try {
      const b64 = await fileToBase64(filePreview.file);
      const res = await api.uploadFile(filePreview.file.name, b64, filePreview.file.type);
      await sendFileMessage(
        res.url as string,
        filePreview.file.name,
        res.is_image as boolean
      );
      if (filePreview.previewUrl) URL.revokeObjectURL(filePreview.previewUrl);
      setFilePreview(null);
      setText('');
    } catch (e: unknown) {
      console.error('Upload error:', e);
      setUploadError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const cancelFile = () => {
    if (filePreview?.previewUrl) URL.revokeObjectURL(filePreview.previewUrl);
    setFilePreview(null);
    setUploadError('');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    if (!ALLOWED_TYPES[file.type]) { setUploadError('Тип файла не поддерживается'); return; }
    if (file.size > 4 * 1024 * 1024) { setUploadError('Файл слишком большой (макс. 4 МБ)'); return; }
    setUploadError('');
    setFilePreview({ file, previewUrl: isImage ? URL.createObjectURL(file) : null, isImage });
  }, []);

  const emojis = ['😊', '😂', '🔥', '👍', '❤️', '🚀', '🎉', '✨', '💡', '👀'];

  const chatName = chat?.name || '...';
  const chatAvatar = chat?.avatar || '1';
  const chatOnline = chat?.online || false;
  const chatType = chat?.type || 'direct';
  const chatMembers = chat?.members || 0;

  const canSend = (!!text.trim() || !!filePreview) && !uploading;

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--surface-1)' }}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
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
                <MessageBubble msg={msg} isMe={msg.isMe} />
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

      {/* Input area — extra bottom padding on mobile for nav bar */}
      <div className="px-4 pt-3 pb-3 flex-shrink-0" style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--glass-border)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>

        {/* File preview */}
        {filePreview && (
          <div
            className="mb-2 p-3 rounded-xl flex items-center gap-3"
            style={{ background: 'var(--surface-3)', border: '1px solid rgba(139,92,246,0.3)' }}
          >
            {filePreview.isImage && filePreview.previewUrl ? (
              <img
                src={filePreview.previewUrl}
                alt="preview"
                className="rounded-lg object-cover flex-shrink-0"
                style={{ width: 56, height: 56 }}
              />
            ) : (
              <div
                className="flex-shrink-0 w-14 h-14 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--surface-4)' }}
              >
                <Icon name="FileText" size={24} style={{ color: 'var(--neon-purple)' }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{filePreview.file.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {formatFileSize(filePreview.file.size)}
              </p>
            </div>
            <button
              onClick={cancelFile}
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
            >
              <Icon name="X" size={14} />
            </button>
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <div
            className="mb-2 px-3 py-2 rounded-xl flex items-center gap-2 text-xs"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
          >
            <Icon name="AlertCircle" size={13} />
            {uploadError}
          </div>
        )}

        {/* Emoji picker */}
        {showEmoji && (
          <div className="flex gap-2 mb-2 p-2 rounded-xl" style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}>
            {emojis.map(e => (
              <button key={e} onClick={() => { setText(prev => prev + e); setShowEmoji(false); }} className="text-lg hover:scale-125 transition-transform">{e}</button>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2 px-3 py-2 rounded-2xl" style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}>
          {/* File attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:scale-105"
            style={{ color: filePreview ? 'var(--neon-purple)' : 'hsl(var(--muted-foreground))' }}
            title="Прикрепить файл"
          >
            <Icon name="Paperclip" size={18} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelect}
          />

          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={filePreview ? 'Добавить подпись...' : 'Написать сообщение...'}
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
            disabled={!canSend}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: canSend ? 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' : 'var(--surface-4)',
              boxShadow: canSend ? '0 0 15px rgba(139,92,246,0.4)' : 'none',
            }}
          >
            {uploading
              ? <Icon name="Loader2" size={16} className="text-white animate-spin" />
              : <Icon name="Send" size={16} className="text-white" />
            }
          </button>
        </div>

        {/* Drag hint */}
        <p className="text-center text-[10px] mt-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Перетащите файл или изображение в чат для отправки
        </p>
      </div>
    </div>
  );
};

/* Bubble renders text / image / file differently */
const MessageBubble: React.FC<{ msg: ApiMessage; isMe: boolean }> = ({ msg, isMe }) => {
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

  // fallback for image error
  return (
    <div className={`px-4 py-2.5 ${bubbleClass}`}>
      <p className="text-sm leading-relaxed" style={{ wordBreak: 'break-word' }}>{msg.text}</p>
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