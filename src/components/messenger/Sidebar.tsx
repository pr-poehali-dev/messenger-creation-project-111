import React from 'react';
import Icon from '@/components/ui/icon';
import Avatar from './Avatar';
import { currentUser } from '@/data/mockData';

type Tab = 'chats' | 'contacts' | 'profile';

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const navItems = [
  { id: 'chats' as Tab, icon: 'MessageCircle', label: 'Чаты' },
  { id: 'contacts' as Tab, icon: 'Users', label: 'Контакты' },
  { id: 'profile' as Tab, icon: 'User', label: 'Профиль' },
];

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  return (
    <div
      className="flex flex-col items-center py-4 gap-2"
      style={{
        width: 68,
        background: 'var(--surface-2)',
        borderRight: '1px solid var(--glass-border)',
        height: '100%',
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

      {/* Nav */}
      <div className="flex flex-col gap-1 w-full px-2 flex-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className="flex flex-col items-center gap-1 py-3 rounded-xl transition-all duration-200 w-full group"
            style={{
              background: activeTab === item.id
                ? 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(6,214,245,0.1))'
                : 'transparent',
              border: activeTab === item.id ? '1px solid rgba(139,92,246,0.35)' : '1px solid transparent',
              color: activeTab === item.id ? 'var(--neon-purple)' : 'hsl(var(--muted-foreground))',
            }}
          >
            <Icon
              name={item.icon}
              size={20}
              style={{ color: 'inherit', transition: 'color 0.2s' }}
            />
            <span className="text-[10px] font-medium" style={{ color: 'inherit' }}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* User avatar at bottom */}
      <div className="mt-auto pt-4 pb-1">
        <button
          onClick={() => onTabChange('profile')}
          className="transition-transform hover:scale-105"
        >
          <Avatar seed={currentUser.avatar} name={currentUser.name} size={36} online />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
