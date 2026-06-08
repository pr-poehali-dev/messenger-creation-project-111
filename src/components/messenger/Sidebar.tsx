import React from 'react';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/useAuth';

type Tab = 'chats' | 'contacts' | 'profile';

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  totalUnread?: number;
}

const navItems = [
  { id: 'chats' as Tab, icon: 'MessageCircle', label: 'Чаты' },
  { id: 'contacts' as Tab, icon: 'Users', label: 'Контакты' },
  { id: 'profile' as Tab, icon: 'User', label: 'Профиль' },
];

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, totalUnread = 0 }) => {
  const { user } = useAuth();

  return (
    <>
      {/* Desktop sidebar — vertical left panel */}
      <div
        className="hidden md:flex flex-col items-center py-4 gap-2 h-full"
        style={{
          width: 68,
          background: 'var(--surface-2)',
          borderRight: '1px solid var(--glass-border)',
        }}
      >
        {/* Logo */}
        <div className="mb-4 mt-1">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-sm"
            style={{
              background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))',
              boxShadow: '0 0 20px rgba(139,92,246,0.4)',
              letterSpacing: '-0.5px',
            }}
          >
            P
          </div>
        </div>

        {/* Nav items */}
        <div className="flex flex-col gap-1 w-full px-2 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className="relative flex flex-col items-center gap-1 py-3 rounded-xl transition-all duration-200 w-full"
              style={{
                background: activeTab === item.id
                  ? 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(6,214,245,0.1))'
                  : 'transparent',
                border: activeTab === item.id ? '1px solid rgba(139,92,246,0.35)' : '1px solid transparent',
                color: activeTab === item.id ? 'var(--neon-purple)' : 'hsl(var(--muted-foreground))',
              }}
            >
              <Icon name={item.icon} size={20} style={{ color: 'inherit' }} />
              <span className="text-[10px] font-medium" style={{ color: 'inherit' }}>{item.label}</span>
              {item.id === 'chats' && totalUnread > 0 && activeTab !== 'chats' && (
                <span
                  className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' }}
                >
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* User avatar */}
        <div className="mt-auto pt-4 pb-1">
          <button onClick={() => onTabChange('profile')} className="transition-transform hover:scale-105">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' }}
            >
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </button>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2"
        style={{
          background: 'var(--surface-2)',
          borderTop: '1px solid var(--glass-border)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
          paddingTop: 8,
          height: 64,
        }}
      >
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className="relative flex flex-col items-center gap-1 flex-1 py-1 rounded-xl transition-all duration-200"
            style={{
              color: activeTab === item.id ? 'var(--neon-purple)' : 'hsl(var(--muted-foreground))',
            }}
          >
            <Icon name={item.icon} size={22} style={{ color: 'inherit' }} />
            <span className="text-[10px] font-medium" style={{ color: 'inherit' }}>{item.label}</span>
            {item.id === 'chats' && totalUnread > 0 && (
              <span
                className="absolute top-0 right-4 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))' }}
              >
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
};

export default Sidebar;
