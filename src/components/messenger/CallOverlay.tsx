import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';

interface CallOverlayProps {
  type: 'voice' | 'video';
  chatName: string;
  onEnd: () => void;
}

const CallOverlay: React.FC<CallOverlayProps> = ({ type, chatName, onEnd }) => {
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [phase, setPhase] = useState<'calling' | 'connected'>('calling');

  useEffect(() => {
    const connectTimer = setTimeout(() => setPhase('connected'), 2500);
    return () => clearTimeout(connectTimer);
  }, []);

  useEffect(() => {
    if (phase !== 'connected') return;
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Animated bg */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-96 h-96 rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, var(--neon-purple), transparent)',
            top: '10%', left: '20%',
            animation: 'pulse 3s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-64 h-64 rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, var(--neon-cyan), transparent)',
            bottom: '20%', right: '15%',
            animation: 'pulse 4s ease-in-out infinite 1s',
          }}
        />
      </div>

      <div className="flex flex-col items-center gap-6 animate-scale-in relative z-10">
        {/* Avatar with rings */}
        <div className="relative flex items-center justify-center">
          {phase === 'calling' && (
            <>
              <div
                className="absolute rounded-full animate-ping"
                style={{ width: 140, height: 140, border: '2px solid rgba(139,92,246,0.3)' }}
              />
              <div
                className="absolute rounded-full animate-ping"
                style={{ width: 170, height: 170, border: '1px solid rgba(139,92,246,0.15)', animationDelay: '0.5s' }}
              />
            </>
          )}
          <Avatar seed="2" name={chatName} size={100} online />
        </div>

        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-1">{chatName}</h3>
          <p className="text-sm" style={{ color: phase === 'connected' ? 'var(--neon-green)' : 'hsl(var(--muted-foreground))' }}>
            {phase === 'calling'
              ? type === 'voice' ? '📞 Вызов...' : '🎥 Видеозвонок...'
              : `● Соединено · ${formatTime(duration)}`
            }
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mt-2">
          <CallBtn
            icon={muted ? 'MicOff' : 'Mic'}
            label={muted ? 'Вкл микрофон' : 'Выкл микрофон'}
            active={muted}
            onClick={() => setMuted(!muted)}
          />
          {type === 'video' && (
            <CallBtn
              icon={cameraOff ? 'VideoOff' : 'Video'}
              label={cameraOff ? 'Вкл камеру' : 'Выкл камеру'}
              active={cameraOff}
              onClick={() => setCameraOff(!cameraOff)}
            />
          )}
          <CallBtn
            icon={speakerOff ? 'VolumeX' : 'Volume2'}
            label="Динамик"
            active={speakerOff}
            onClick={() => setSpeakerOff(!speakerOff)}
          />
          <CallBtn icon="MoreHorizontal" label="Ещё" onClick={() => {}} />

          {/* End call */}
          <button
            onClick={onEnd}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              boxShadow: '0 0 25px rgba(239,68,68,0.5)',
            }}
          >
            <Icon name="PhoneOff" size={24} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

const CallBtn: React.FC<{ icon: string; label: string; active?: boolean; onClick: () => void }> = ({
  icon, label, active, onClick
}) => (
  <button
    onClick={onClick}
    title={label}
    className="w-14 h-14 rounded-full flex items-center justify-center flex-col gap-0.5 transition-all hover:scale-110"
    style={{
      background: active ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)',
      border: active ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
      color: active ? 'var(--neon-purple)' : 'white',
    }}
  >
    <Icon name={icon} size={20} />
  </button>
);

export default CallOverlay;
