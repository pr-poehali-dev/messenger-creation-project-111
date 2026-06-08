import React, { useState } from 'react';
import Sidebar from '@/components/messenger/Sidebar';
import ChatList from '@/components/messenger/ChatList';
import ChatWindow from '@/components/messenger/ChatWindow';
import ContactsPage from '@/components/messenger/ContactsPage';
import ProfilePage from '@/components/messenger/ProfilePage';
import EmptyState from '@/components/messenger/EmptyState';
import CallOverlay from '@/components/messenger/CallOverlay';
import { useChats } from '@/hooks/useChats';

type Tab = 'chats' | 'contacts' | 'profile';

interface CallState {
  active: boolean;
  type: 'voice' | 'video';
  chatName: string;
}

const Index: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [call, setCall] = useState<CallState>({ active: false, type: 'voice', chatName: '' });
  const { chats, refetch: refetchChats } = useChats();

  const startCall = (type: 'voice' | 'video', chatName: string) => {
    setCall({ active: true, type, chatName });
  };

  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ fontFamily: "'Golos Text', sans-serif", background: 'var(--surface-1)' }}
    >
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'chats' && (
          <>
            <ChatList
              chats={chats}
              activeChat={activeChatId}
              onSelectChat={setActiveChatId}
              onRefresh={refetchChats}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeChatId
                ? <ChatWindow
                    chatId={activeChatId}
                    chat={chats.find(c => c.id === activeChatId)}
                    onCallStart={startCall}
                  />
                : <EmptyState />
              }
            </div>
          </>
        )}

        {activeTab === 'contacts' && (
          <ContactsPage
            onChatCreated={(id) => {
              setActiveChatId(id);
              setActiveTab('chats');
              refetchChats();
            }}
          />
        )}

        {activeTab === 'profile' && <ProfilePage />}
      </div>

      {totalUnread > 0 && activeTab !== 'chats' && (
        <div
          className="fixed top-16 left-12 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white z-10"
          style={{
            background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))',
            boxShadow: '0 0 8px rgba(139,92,246,0.6)',
          }}
        >
          {totalUnread > 9 ? '9+' : totalUnread}
        </div>
      )}

      {call.active && (
        <CallOverlay type={call.type} chatName={call.chatName} onEnd={endCall} />
      )}
    </div>
  );

  function endCall() {
    setCall({ active: false, type: 'voice', chatName: '' });
  }
};

export default Index;