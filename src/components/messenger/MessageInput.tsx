import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { api } from '@/api/client';
import { ReplyTo } from '@/hooks/useChats';

export const ALLOWED_TYPES: Record<string, string> = {
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function fileToBase64(file: File): Promise<string> {
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

export interface FilePreview {
  file: File;
  previewUrl: string | null;
  isImage: boolean;
}

interface MessageInputProps {
  onSendText: (text: string, replyToId?: number) => Promise<void>;
  onSendFile: (url: string, name: string, isImage: boolean, type?: string) => Promise<void>;
  externalFile?: File | null;
  onExternalFileHandled?: () => void;
  isBlocked?: boolean;
  isBlockedByOther?: boolean;
  replyTo?: ReplyTo | null;
  onCancelReply?: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendText, onSendFile, externalFile, onExternalFileHandled, isBlocked, isBlockedByOther, replyTo, onCancelReply }) => {
  const voice = useVoiceRecorder();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Принимаем файл переданный снаружи (drag-and-drop с уровня ChatWindow)
  React.useEffect(() => {
    if (!externalFile) return;
    setUploadError('');
    if (!ALLOWED_TYPES[externalFile.type]) { setUploadError('Тип файла не поддерживается'); onExternalFileHandled?.(); return; }
    if (externalFile.size > 4 * 1024 * 1024) { setUploadError('Файл слишком большой (макс. 4 МБ)'); onExternalFileHandled?.(); return; }
    const isImage = externalFile.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(externalFile) : null;
    setFilePreview({ file: externalFile, previewUrl, isImage });
    onExternalFileHandled?.();
  }, [externalFile, onExternalFileHandled]);

  const emojis = ['😊', '😂', '🔥', '👍', '❤️', '🚀', '🎉', '✨', '💡', '👀'];

  const handleSendFile = async (preview: FilePreview) => {
    setUploading(true);
    setUploadError('');
    try {
      const b64 = await fileToBase64(preview.file);
      const res = await api.uploadFile(preview.file.name, b64, preview.file.type);
      await onSendFile(res.url as string, preview.file.name, res.is_image as boolean);
      if (preview.previewUrl) URL.revokeObjectURL(preview.previewUrl);
      setFilePreview(null);
      setText('');
    } catch (e: unknown) {
      console.error('Upload error:', e);
      setUploadError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (filePreview) {
      await handleSendFile(filePreview);
      onCancelReply?.();
      return;
    }
    if (!text.trim()) return;
    const t = text.trim();
    const replyId = replyTo?.id;
    setText('');
    onCancelReply?.();
    try {
      await onSendText(t, replyId);
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
    if (!ALLOWED_TYPES[file.type]) { setUploadError('Тип файла не поддерживается'); return; }
    if (file.size > 4 * 1024 * 1024) { setUploadError('Файл слишком большой (макс. 4 МБ)'); return; }
    const isImage = file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file) : null;
    setFilePreview({ file, previewUrl, isImage });
  }, []);

  const cancelFile = () => {
    if (filePreview?.previewUrl) URL.revokeObjectURL(filePreview.previewUrl);
    setFilePreview(null);
    setUploadError('');
  };

  const handleSendVoice = async () => {
    if (!voice.recording) return;
    setUploading(true);
    setUploadError('');
    try {
      const { blob, duration, mimeType } = voice.recording;
      const arrayBuffer = await blob.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const fileName = `voice_${duration}s.webm`;
      const res = await api.uploadFile(fileName, b64, mimeType);
      await onSendFile(res.url as string, fileName, false, 'voice');
      voice.clear();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Ошибка отправки');
    } finally {
      setUploading(false);
    }
  };

  const canSend = (!!text.trim() || !!filePreview) && !uploading;

  if (isBlocked || isBlockedByOther) {
    return (
      <div
        className="flex-shrink-0 flex items-center justify-center gap-3 px-5 py-4"
        style={{
          background: 'var(--surface-2)',
          borderTop: '1px solid var(--glass-border)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
        }}
      >
        <div
          className="flex items-center gap-3 px-5 py-3 rounded-2xl w-full max-w-md"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <Icon name="Ban" size={18} style={{ color: '#f87171', flexShrink: 0 }} />
          <p className="text-sm" style={{ color: '#f87171' }}>
            {isBlocked
              ? 'Вы заблокировали этого пользователя. Разблокируйте, чтобы писать.'
              : 'Вы не можете отправлять сообщения этому пользователю.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="px-4 pt-3 pb-3 flex-shrink-0"
      style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--glass-border)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
    >
      {/* Reply preview */}
      {replyTo && (
        <div
          className="mb-2 px-3 py-2 rounded-xl flex items-center gap-2 animate-fade-in"
          style={{ background: 'var(--surface-3)', borderLeft: '3px solid var(--neon-purple)' }}
        >
          <Icon name="CornerUpLeft" size={14} style={{ color: 'var(--neon-purple)', flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--neon-cyan)' }}>{replyTo.senderName}</p>
            <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {replyTo.type === 'image' ? '🖼 Фото' : replyTo.type === 'file' ? '📎 Файл' : replyTo.type === 'voice' ? '🎵 Голосовое' : replyTo.text}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ color: 'hsl(var(--muted-foreground))', background: 'var(--surface-4)' }}
          >
            <Icon name="X" size={12} />
          </button>
        </div>
      )}

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

      {/* Voice recording UI */}
      {(voice.isRecording || voice.recording) && (
        <div className="mb-2 px-3 py-2 rounded-xl flex items-center gap-3"
          style={{ background: 'var(--surface-3)', border: '1px solid rgba(239,68,68,0.3)' }}>
          {voice.isRecording ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <span className="text-sm text-white flex-1">
                {String(Math.floor(voice.duration / 60)).padStart(2,'0')}:{String(voice.duration % 60).padStart(2,'0')}
              </span>
              <button onClick={voice.cancel} className="text-xs px-2 py-1 rounded-lg" style={{ color: 'hsl(var(--muted-foreground))', background: 'var(--surface-4)' }}>
                Отмена
              </button>
              <button onClick={voice.stop}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' }}>
                <Icon name="Square" size={14} className="text-white" />
              </button>
            </>
          ) : voice.recording ? (
            <>
              <Icon name="Mic" size={16} style={{ color: 'var(--neon-cyan)' }} className="flex-shrink-0" />
              <span className="text-sm text-white flex-1">
                Голосовое · {voice.recording.duration}с
              </span>
              <audio src={voice.recording.url} controls className="h-7 flex-1" style={{ maxWidth: 140 }} />
              <button onClick={voice.clear} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                <Icon name="X" size={13} />
              </button>
              <button onClick={handleSendVoice} disabled={uploading}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' }}>
                {uploading
                  ? <Icon name="Loader2" size={14} className="text-white animate-spin" />
                  : <Icon name="Send" size={14} className="text-white" />}
              </button>
            </>
          ) : null}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 px-3 py-2 rounded-2xl" style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}>
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

        {canSend ? (
          <button
            onClick={handleSend}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))', boxShadow: '0 0 15px rgba(139,92,246,0.4)' }}
          >
            {uploading
              ? <Icon name="Loader2" size={16} className="text-white animate-spin" />
              : <Icon name="Send" size={16} className="text-white" />}
          </button>
        ) : (
          <button
            onClick={voice.isRecording ? voice.stop : voice.start}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: voice.isRecording
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'var(--surface-4)',
              boxShadow: voice.isRecording ? '0 0 15px rgba(239,68,68,0.4)' : 'none',
            }}
          >
            <Icon name={voice.isRecording ? 'Square' : 'Mic'} size={16}
              style={{ color: voice.isRecording ? 'white' : 'hsl(var(--muted-foreground))' }} />
          </button>
        )}
      </div>

      {/* Drag hint */}
      <p className="text-center text-[10px] mt-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
        Перетащите файл или изображение в чат для отправки
      </p>
    </div>
  );
};

export default MessageInput;