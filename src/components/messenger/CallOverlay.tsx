import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { useWebRTC, IncomingCall } from '@/hooks/useWebRTC';

interface CallOverlayProps {
  webrtc: ReturnType<typeof useWebRTC>;
  chatName?: string;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

const CallOverlay: React.FC<CallOverlayProps> = ({ webrtc, chatName = '' }) => {
  const {
    status, isMuted, isCameraOff,
    localVideoRef, remoteVideoRef,
    hangUp, toggleMute, toggleCamera,
    localStream,
  } = webrtc;

  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (status !== 'active') { setSeconds(0); return; }
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  const duration = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
  const isVideo = (localStream.current?.getVideoTracks().length ?? 0) > 0;

  if (status === 'idle' || status === 'ended') return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0a0a12' }}>
      {/* Remote video */}
      {isVideo ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: status === 'active' ? 1 : 0.3 }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center text-5xl font-black text-white"
            style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' }}
          >
            {chatName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 35%, transparent 55%, rgba(0,0,0,0.75) 100%)' }} />

      {/* Top info */}
      <div className="relative z-10 px-5 pt-12">
        <p className="text-white font-bold text-xl">{chatName}</p>
        <p className="text-sm mt-1" style={{ color: status === 'active' ? 'var(--neon-cyan)' : 'hsl(var(--muted-foreground))' }}>
          {status === 'active' ? duration : status === 'outgoing' ? 'Вызов...' : 'Соединение...'}
        </p>
      </div>

      {/* Local video PiP */}
      {isVideo && (
        <div
          className="absolute top-24 right-4 z-20 rounded-2xl overflow-hidden"
          style={{ width: 90, height: 130, border: '2px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {isCameraOff && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
              <Icon name="VideoOff" size={20} className="text-white" />
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-6 pb-12">
        <div className="flex items-center justify-center gap-5">
          <CallBtn icon={isMuted ? 'MicOff' : 'Mic'} label={isMuted ? 'Включить' : 'Микрофон'} active={isMuted} onClick={toggleMute} />
          {isVideo && (
            <CallBtn icon={isCameraOff ? 'VideoOff' : 'Video'} label={isCameraOff ? 'Включить' : 'Камера'} active={isCameraOff} onClick={toggleCamera} />
          )}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={hangUp}
              className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95"
              style={{ background: '#ef4444', boxShadow: '0 0 24px rgba(239,68,68,0.5)' }}
            >
              <Icon name="PhoneOff" size={26} className="text-white" />
            </button>
            <span className="text-xs text-white opacity-70">Завершить</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Экран входящего звонка
interface IncomingCallScreenProps {
  incoming: IncomingCall;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallScreen: React.FC<IncomingCallScreenProps> = ({ incoming, onAccept, onReject }) => (
  <div
    className="fixed inset-0 z-50 flex flex-col items-center justify-between py-16 px-6"
    style={{ background: 'linear-gradient(160deg, #1a0533 0%, #0a0a12 100%)' }}
  >
    <div className="flex flex-col items-center gap-4 mt-10">
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center text-5xl font-black text-white"
        style={{
          background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))',
          boxShadow: '0 0 40px rgba(139,92,246,0.5)',
          animation: 'pulse 2s infinite',
        }}
      >
        {incoming.fromName.charAt(0).toUpperCase()}
      </div>
      <h2 className="text-2xl font-bold text-white">{incoming.fromName}</h2>
      <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
        Входящий {incoming.type === 'video' ? 'видеозвонок' : 'голосовой звонок'}
      </p>
    </div>

    <div className="flex items-center gap-16">
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onReject}
          className="w-16 h-16 rounded-full flex items-center justify-center active:scale-95"
          style={{ background: '#ef4444', boxShadow: '0 0 20px rgba(239,68,68,0.4)' }}
        >
          <Icon name="PhoneOff" size={26} className="text-white" />
        </button>
        <span className="text-xs text-white opacity-70">Отклонить</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onAccept}
          className="w-16 h-16 rounded-full flex items-center justify-center active:scale-95"
          style={{ background: '#22c55e', boxShadow: '0 0 20px rgba(34,197,94,0.4)' }}
        >
          <Icon name={incoming.type === 'video' ? 'Video' : 'Phone'} size={26} className="text-white" />
        </button>
        <span className="text-xs text-white opacity-70">Принять</span>
      </div>
    </div>
  </div>
);

const CallBtn: React.FC<{ icon: string; label: string; active: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <div className="flex flex-col items-center gap-2">
    <button
      onClick={onClick}
      className="w-14 h-14 rounded-full flex items-center justify-center active:scale-95"
      style={{ background: active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
    >
      <Icon name={icon} size={22} className="text-white" />
    </button>
    <span className="text-xs text-white opacity-70">{label}</span>
  </div>
);

export default CallOverlay;
