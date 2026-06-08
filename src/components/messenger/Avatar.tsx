import React from 'react';

interface AvatarProps {
  seed: string;
  name: string;
  size?: number;
  online?: boolean;
  className?: string;
}

const gradients = [
  'linear-gradient(135deg, #8b5cf6, #06d6f5)',
  'linear-gradient(135deg, #f472b6, #8b5cf6)',
  'linear-gradient(135deg, #10f5a0, #06d6f5)',
  'linear-gradient(135deg, #f59e0b, #f472b6)',
  'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  'linear-gradient(135deg, #06d6f5, #10f5a0)',
  'linear-gradient(135deg, #ef4444, #f472b6)',
  'linear-gradient(135deg, #8b5cf6, #3b82f6)',
];

const groupGradients: Record<string, string> = {
  group1: 'linear-gradient(135deg, #8b5cf6, #f472b6)',
  group2: 'linear-gradient(135deg, #10f5a0, #3b82f6)',
  channel1: 'linear-gradient(135deg, #06d6f5, #8b5cf6)',
  channel2: 'linear-gradient(135deg, #f59e0b, #ef4444)',
};

const groupIcons: Record<string, string> = {
  group1: '👥',
  group2: '🎨',
  channel1: '📡',
  channel2: '📰',
};

function getGradient(seed: string): string {
  if (groupGradients[seed]) return groupGradients[seed];
  const num = parseInt(seed) || seed.charCodeAt(0);
  return gradients[num % gradients.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const Avatar: React.FC<AvatarProps> = ({ seed, name, size = 40, online, className = '' }) => {
  const isSpecial = !!groupGradients[seed];
  const gradient = getGradient(seed);
  const content = isSpecial ? groupIcons[seed] : getInitials(name);
  const fontSize = isSpecial ? size * 0.42 : size * 0.35;

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-full flex items-center justify-center font-bold select-none"
        style={{ background: gradient, fontSize }}
      >
        <span style={{ color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{content}</span>
      </div>
      {online && (
        <div
          className="absolute bottom-0 right-0 rounded-full border-2"
          style={{
            width: size * 0.28,
            height: size * 0.28,
            background: 'var(--neon-green)',
            borderColor: 'var(--surface-1)',
            boxShadow: '0 0 6px rgba(16,245,160,0.7)',
          }}
        />
      )}
    </div>
  );
};

export default Avatar;
