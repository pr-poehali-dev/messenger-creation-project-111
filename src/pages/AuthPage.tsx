import React, { useState } from 'react';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';

type Mode = 'login' | 'register';

const AuthPage: React.FC = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(name, username, password, phone);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: 'var(--surface-1)',
        backgroundImage:
          'radial-gradient(circle at 30% 30%, rgba(139,92,246,0.12) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(6,214,245,0.08) 0%, transparent 50%)',
      }}
    >
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-white text-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-cyan))',
              boxShadow: '0 0 40px rgba(139,92,246,0.4)',
              letterSpacing: '-1px',
            }}
          >
            P
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">PULSE</h1>
          <p className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {mode === 'login' ? 'Войдите в аккаунт' : 'Создайте аккаунт'}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'register' && (
              <InputField
                icon="User"
                placeholder="Имя"
                value={name}
                onChange={setName}
                autoComplete="name"
              />
            )}
            <InputField
              icon="AtSign"
              placeholder="Имя пользователя"
              value={username}
              onChange={setUsername}
              autoComplete="username"
            />
            <InputField
              icon="Lock"
              placeholder="Пароль"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'register' && (
              <InputField
                icon="Phone"
                placeholder="Телефон (необязательно)"
                value={phone}
                onChange={setPhone}
                autoComplete="tel"
              />
            )}

            {error && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
              >
                <Icon name="AlertCircle" size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, var(--neon-purple), #5b21b6)',
                boxShadow: '0 0 20px rgba(139,92,246,0.4)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Icon name="Loader2" size={16} className="animate-spin" />
                  Загрузка...
                </span>
              ) : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </button>
          </form>
        </div>

        {/* Toggle */}
        <p className="text-center text-sm mt-4" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="font-semibold transition-colors hover:opacity-80"
            style={{ color: 'var(--neon-cyan)' }}
          >
            {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </p>
      </div>
    </div>
  );
};

const InputField: React.FC<{
  icon: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}> = ({ icon, placeholder, value, onChange, type = 'text', autoComplete }) => (
  <div
    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
    style={{ background: 'var(--surface-3)', border: '1px solid var(--glass-border)' }}
    onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)')}
    onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--glass-border)')}
  >
    <Icon name={icon} size={16} style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      autoComplete={autoComplete}
      className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-muted-foreground"
      style={{ fontFamily: 'inherit' }}
    />
  </div>
);

export default AuthPage;
