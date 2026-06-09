import React, { useState, useCallback } from 'react';
import { useMessages, ApiChat } from '@/hooks/useChats';
import { useWebRTC } from '@/hooks/useWebRTC';
import { api } from '@/api/client';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput, { ALLOWED_TYPES } from './MessageInput';

interface ChatWindowProps {
  chatId: number;
  chat?: ApiChat;
  webrtc: ReturnType<typeof useWebRTC>;
  onBack?: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId, chat, webrtc, onBack }) => {
  const { messages, sendMessage, sendFileMessage } = useMessages(chatId);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  const chatName = chat?.name || '...';
  const chatAvatar = chat?.avatar || '1';
  const chatType = chat?.type || 'direct';

  const handleCall = async (type: 'voice' | 'video') => {
    const otherUserId = chat?.otherUserId;
    if (!otherUserId) return;
    const callId = `${chatId}-${Date.now()}`;
    await api.sendSignal(callId, otherUserId, 'ring', {
      callType: type,
      fromName: chatName,
      fromAvatar: chatAvatar,
    });
    webrtc.startCall(otherUserId, type, callId);
  };

  const handleSendText = async (text: string) => {
    await sendMessage(text);
  };

  const handleSendFile = async (url: string, name: string, isImage: boolean, type?: string) => {
    await sendFileMessage(url, name, isImage, type);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES[file.type]) return;
    if (file.size > 4 * 1024 * 1024) return;
    setDroppedFile(file);
  }, []);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--surface-1)' }}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      <ChatHeader chat={chat} onBack={onBack} onCall={handleCall} />
      <MessageList
        messages={messages}
        chatId={chatId}
        chatType={chatType}
        onCallback={handleCall}
      />
      <MessageInput
        onSendText={handleSendText}
        onSendFile={handleSendFile}
        externalFile={droppedFile}
        onExternalFileHandled={() => setDroppedFile(null)}
      />
    </div>
  );
};

export default ChatWindow;
