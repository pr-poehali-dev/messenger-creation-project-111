import React from 'react';
import Icon from '@/components/ui/icon';

const EmptyState: React.FC = () => (
  <div
    className="flex-1 flex flex-col items-center justify-center gap-4"
    style={{
      background: 'var(--surface-1)',
      backgroundImage: 'radial-gradient(circle at 50% 40%, rgba(139,92,246,0.07) 0%, transparent 60%)',
    }}
  >
    <div
      className="w-24 h-24 rounded-3xl flex items-center justify-center mb-2"
      style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,214,245,0.08))',
        border: '1px solid rgba(139,92,246,0.2)',
        boxShadow: '0 0 40px rgba(139,92,246,0.1)',
      }}
    >
      <Icon name="MessageCircle" size={44} style={{ color: 'var(--neon-purple)' }} />
    </div>

    <div className="text-center">
      <h3 className="text-lg font-bold text-white mb-1">Выберите чат</h3>
      <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
        Откройте диалог или начните новый
      </p>
    </div>

    <div className="flex gap-2 mt-2">
      {['💬', '👥', '📡'].map((emoji, i) => (
        <div
          key={i}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}
        >
          {emoji}
        </div>
      ))}
    </div>
  </div>
);

export default EmptyState;
