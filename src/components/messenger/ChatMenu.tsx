import React, { useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';

interface ChatMenuItem {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ChatMenuProps {
  open: boolean;
  onClose: () => void;
  items: ChatMenuItem[];
}

const ChatMenu: React.FC<ChatMenuProps> = ({ open, onClose, items }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-1 z-50 py-1 rounded-2xl min-w-[200px]"
      style={{
        background: 'var(--surface-3)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        animation: 'fadeInScale 0.15s ease',
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all text-left hover:opacity-80"
          style={{
            color: item.danger ? '#f87171' : 'hsl(var(--foreground))',
            background: 'transparent',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-4)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <Icon name={item.icon} size={15} className="flex-shrink-0" />
          {item.label}
        </button>
      ))}
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.92) translateY(-4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ChatMenu;
