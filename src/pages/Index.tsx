import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '@/components/messenger/Sidebar';
import ChatList from '@/components/messenger/ChatList';
import ChatWindow from '@/components/messenger/ChatWindow';
import ContactsPage from '@/components/messenger/ContactsPage';
import ProfilePage from '@/components/messenger/ProfilePage';
import EmptyState from '@/components/messenger/EmptyState';
import CallOverlay, { IncomingCallScreen } from '@/components/messenger/CallOverlay';
import Icon from '@/components/ui/icon';
import { useChats } from '@/hooks/useChats';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useAuth } from '@/context/useAuth';
import { useNotificationPermission, useNewMessageNotifications } from '@/hooks/useNotifications';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { CallEndInfo } from '@/hooks/useWebRTC';
import { api } from '@/api/client';

type Tab = 'chats' | 'contacts' | 'profile';

const Index: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const { chats, refetch: refetchChats } = useChats();
  const { permission, request: requestPermission } = useNotificationPermission();
  const { user } = useAuth();

  const activeChatIdRef = useRef<number | null>(null);

  const handleCallEnd = useCallback(async (info: CallEndInfo) => {
    const chatId = activeChatIdRef.current;
    if (!chatId) return;
    const icon = info.type === 'video' ? '📹' : '📞';
    let text: string;
    if (info.missed) {
      text = `${icon} Пропущенный ${info.type === 'video' ? 'видеозвонок' : 'звонок'}`;
    } else if (info.duration === 0) {
      text = `${icon} ${info.type === 'video' ? 'Видеозвонок' : 'Звонок'} не состоялся`;
    } else {
      const m = Math.floor(info.duration / 60);
      const s = info.duration % 60;
      const dur = m > 0 ? `${m} мин ${s} сек` : `${s} сек`;
      text = `${icon} ${info.type === 'video' ? 'Видеозвонок' : 'Звонок'} · ${dur}`;
    }
    try {
      await api.sendMessage(chatId, text, 'call');
      refetchChats();
    } catch { /* ignore */ }
  }, [refetchChats]);

  const webrtc = useWebRTC(user?.id ?? null, handleCallEnd);

  useNewMessageNotifications(chats, activeChatId);
  usePushSubscription(user?.id ?? null, permission);
  useHeartbeat(user?.id ?? null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setTimeout(() => setShowInstallBanner(true), 3000);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
    setShowInstallBanner(false);
  };

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (permission === 'default') {
      const timer = setTimeout(() => setShowNotifBanner(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [permission]);

  const handleAllowNotifications = async () => {
    const granted = await requestPermission();
    setShowNotifBanner(false);
    if (granted) {
      new Notification('PULSE', {
        body: 'Уведомления включены! Вы будете в курсе новых сообщений.',
        icon: '/pwa-icon.svg',
      });
    }
  };

  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0);

  const handleSelectChat = (id: number) => {
    setActiveChatId(id);
    activeChatIdRef.current = id;
  };
  const handleBackToList = () => {
    setActiveChatId(null);
    activeChatIdRef.current = null;
  };

  const isChatOpen = activeTab === 'chats' && activeChatId !== null;

  // Активный чат для передачи в звонок
  const activeChat = chats.find(c => c.id === activeChatId);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ fontFamily: "'Golos Text', sans-serif", background: 'var(--surface-1)' }}
    >
      <div className={isChatOpen ? 'hidden md:flex' : 'flex'}>
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => { setActiveTab(tab); if (tab !== 'chats') setActiveChatId(null); }}
          totalUnread={totalUnread}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'chats' && (
          <>
            <div className={`${isChatOpen ? 'hidden md:flex' : 'flex'} w-full md:w-auto`}>
              <ChatList
                chats={chats}
                activeChat={activeChatId}
                onSelectChat={handleSelectChat}
                onRefresh={refetchChats}
              />
            </div>
            <div className={`${isChatOpen ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}>
              {activeChatId
                ? <ChatWindow
                    chatId={activeChatId}
                    chat={activeChat}
                    webrtc={webrtc}
                    onBack={handleBackToList}
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

      {/* Unread badge */}
      {totalUnread > 0 && activeTab !== 'chats' && (
        <div
          className="hidden md:flex fixed top-16 left-12 w-4 h-4 rounded-full items-center justify-center text-[9px] font-bold text-white z-10"
          style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))', boxShadow: '0 0 8px rgba(139,92,246,0.6)' }}
        >
          {totalUnread > 9 ? '9+' : totalUnread}
        </div>
      )}

      {/* Notification banner */}
      {showNotifBanner && (
        <div
          className="fixed z-50 flex items-center gap-3 px-4 py-3 rounded-2xl animate-fade-in-up"
          style={{
            background: 'var(--surface-3)',
            border: '1px solid rgba(139,92,246,0.35)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(139,92,246,0.15)',
            left: '1rem', right: '1rem', maxWidth: 420, margin: '0 auto',
            bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)',
          }}
        >
          <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' }}>
            <Icon name="Bell" size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Включить уведомления?</p>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Узнавайте о новых сообщениях мгновенно</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleAllowNotifications}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, var(--neon-purple), #5b21b6)' }}>
              Включить
            </button>
            <button onClick={() => setShowNotifBanner(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ color: 'hsl(var(--muted-foreground))', background: 'var(--surface-4)' }}>
              <Icon name="X" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Install PWA banner */}
      {showInstallBanner && installPrompt && (
        <div
          className="fixed z-50 flex items-center gap-3 px-4 py-3 rounded-2xl animate-fade-in-up"
          style={{
            background: 'var(--surface-3)',
            border: '1px solid rgba(6,214,245,0.35)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(6,214,245,0.15)',
            left: '1rem', right: '1rem', maxWidth: 420, margin: '0 auto',
            bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)',
          }}
        >
          <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm"
            style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' }}>
            P
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Установить PULSE</p>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Добавьте приложение на экран телефона</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleInstall}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, var(--neon-cyan), #0891b2)' }}>
              Установить
            </button>
            <button onClick={() => setShowInstallBanner(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ color: 'hsl(var(--muted-foreground))', background: 'var(--surface-4)' }}>
              <Icon name="X" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Входящий звонок */}
      {webrtc.incomingCall && webrtc.status === 'idle' && (
        <IncomingCallScreen
          incoming={webrtc.incomingCall}
          onAccept={() => webrtc.acceptCall(webrtc.incomingCall!)}
          onReject={() => webrtc.rejectCall(webrtc.incomingCall!)}
        />
      )}

      {/* Активный / исходящий звонок */}
      <CallOverlay webrtc={webrtc} chatName={activeChat?.name} callType={webrtc.callType} />
    </div>
  );
};

export default Index;