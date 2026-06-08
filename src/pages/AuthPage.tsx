import React, { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';

type Mode = 'login' | 'register';
type RegStep = 'form' | 'code';

const AuthPage: React.FC = () => {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [regStep, setRegStep] = useState<RegStep>('form');

  // Login fields
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Code fields
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [pendingEmail, setPendingEmail] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Resend countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginInput, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.sendCode(email, name, username, regPassword, phone);
      setPendingEmail(email);
      setRegStep('code');
      setResendTimer(60);
      setCode(['', '', '', '', '', '']);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const fullCode = code.join('');
    if (fullCode.length < 6) return;
    setError('');
    setLoading(true);
    try {
      const data = await api.verifyCode(pendingEmail, fullCode);
      localStorage.setItem('session_id', data.session_id as string);
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      setCode(['', '', '', '', '', '']);
      codeRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleCodeInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    if (digit && idx < 5) codeRefs.current[idx + 1]?.focus();
    if (next.every(d => d !== '') && next.join('').length === 6) {
      setTimeout(() => handleVerifyCode(), 100);
    }
  };

  const handleCodeKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      codeRefs.current[idx - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const digits = pasted.split('');
      setCode(digits);
      codeRefs.current[5]?.focus();
      setTimeout(() => handleVerifyCode(), 100);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError('');
    setLoading(true);
    try {
      await api.sendCode(email, name, username, regPassword, phone);
      setResendTimer(60);
      setCode(['', '', '', '', '', '']);
      codeRefs.current[0]?.focus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setRegStep('form');
    setError('');
    setCode(['', '', '', '', '', '']);
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
            {mode === 'login' ? 'Войдите в аккаунт' : regStep === 'code' ? 'Введите код из письма' : 'Создайте аккаунт'}
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
          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <InputField icon="Mail" placeholder="Email или имя пользователя" value={loginInput} onChange={setLoginInput} autoComplete="username" />
              <InputField icon="Lock" placeholder="Пароль" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
              <ErrorBox msg={error} />
              <SubmitBtn loading={loading} label="Войти" />
            </form>
          )}

          {/* ── REGISTER STEP 1: form ── */}
          {mode === 'register' && regStep === 'form' && (
            <form onSubmit={handleSendCode} className="flex flex-col gap-3">
              <InputField icon="User" placeholder="Имя" value={name} onChange={setName} autoComplete="name" />
              <InputField icon="AtSign" placeholder="Имя пользователя" value={username} onChange={setUsername} autoComplete="username" />
              <InputField icon="Mail" placeholder="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
              <InputField icon="Lock" placeholder="Пароль (минимум 6 символов)" value={regPassword} onChange={setRegPassword} type="password" autoComplete="new-password" />
              <InputField icon="Phone" placeholder="Телефон (необязательно)" value={phone} onChange={setPhone} autoComplete="tel" />
              <ErrorBox msg={error} />
              <SubmitBtn loading={loading} label="Получить код →" />
              <p className="text-center text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Отправим 6-значный код на твой email для подтверждения
              </p>
            </form>
          )}

          {/* ── REGISTER STEP 2: code ── */}
          {mode === 'register' && regStep === 'code' && (
            <div className="flex flex-col gap-4">
              {/* Email hint */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
                style={{ background: 'rgba(6,214,245,0.08)', border: '1px solid rgba(6,214,245,0.2)' }}
              >
                <Icon name="Mail" size={15} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
                <span style={{ color: 'hsl(var(--foreground))' }}>
                  Код отправлен на <b className="text-white">{pendingEmail}</b>
                </span>
              </div>

              {/* 6 digit inputs */}
              <div className="flex gap-2 justify-center">
                {code.map((d, idx) => (
                  <input
                    key={idx}
                    ref={el => { codeRefs.current[idx] = el; }}
                    value={d}
                    onChange={e => handleCodeInput(idx, e.target.value)}
                    onKeyDown={e => handleCodeKeyDown(idx, e)}
                    onPaste={handleCodePaste}
                    maxLength={1}
                    inputMode="numeric"
                    className="w-11 h-14 rounded-xl text-center text-xl font-bold text-white outline-none transition-all"
                    style={{
                      background: 'var(--surface-3)',
                      border: d ? '2px solid var(--neon-purple)' : '2px solid var(--glass-border)',
                      boxShadow: d ? '0 0 10px rgba(139,92,246,0.3)' : 'none',
                      fontFamily: 'inherit',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(139,92,246,0.6)')}
                    onBlur={e => (e.target.style.borderColor = d ? 'var(--neon-purple)' : 'var(--glass-border)')}
                  />
                ))}
              </div>

              <ErrorBox msg={error} />

              {/* Verify button */}
              <button
                onClick={handleVerifyCode}
                disabled={code.join('').length < 6 || loading}
                className="py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, var(--neon-purple), #5b21b6)',
                  boxShadow: '0 0 20px rgba(139,92,246,0.4)',
                }}
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2"><Icon name="Loader2" size={16} className="animate-spin" />Проверяем...</span>
                  : 'Подтвердить'}
              </button>

              {/* Resend */}
              <div className="flex items-center justify-between text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                <button
                  onClick={() => { setRegStep('form'); setError(''); }}
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                >
                  <Icon name="ArrowLeft" size={12} />
                  Изменить email
                </button>
                <button
                  onClick={handleResend}
                  disabled={resendTimer > 0 || loading}
                  className="transition-opacity disabled:opacity-40"
                  style={{ color: resendTimer > 0 ? 'hsl(var(--muted-foreground))' : 'var(--neon-cyan)' }}
                >
                  {resendTimer > 0 ? `Повторить через ${resendTimer}с` : 'Отправить снова'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Toggle */}
        <p className="text-center text-sm mt-4" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
          <button
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
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
  icon: string; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string; autoComplete?: string;
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

const ErrorBox: React.FC<{ msg: string }> = ({ msg }) => msg ? (
  <div
    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
  >
    <Icon name="AlertCircle" size={14} />
    {msg}
  </div>
) : null;

const SubmitBtn: React.FC<{ loading: boolean; label: string }> = ({ loading, label }) => (
  <button
    type="submit"
    disabled={loading}
    className="mt-1 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 disabled:opacity-60"
    style={{
      background: 'linear-gradient(135deg, var(--neon-purple), #5b21b6)',
      boxShadow: '0 0 20px rgba(139,92,246,0.4)',
    }}
  >
    {loading
      ? <span className="flex items-center justify-center gap-2"><Icon name="Loader2" size={16} className="animate-spin" />Загрузка...</span>
      : label}
  </button>
);

export default AuthPage;
