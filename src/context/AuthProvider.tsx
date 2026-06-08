import React, { useState, useEffect, ReactNode } from 'react';
import { AuthContext, User } from './AuthContext';
import { api } from '@/api/client';

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sid = localStorage.getItem('session_id');
    if (!sid) { setLoading(false); return; }
    api.getMe()
      .then((data) => setUser(data.user as User))
      .catch(() => localStorage.removeItem('session_id'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const data = await api.login(username, password);
    localStorage.setItem('session_id', data.session_id as string);
    setUser(data.user as User);
  };

  const register = async (name: string, username: string, password: string, phone?: string, email?: string) => {
    const data = await api.register(name, username, password, phone, email);
    localStorage.setItem('session_id', data.session_id as string);
    setUser(data.user as User);
  };

  const logout = async () => {
    await api.logout();
    localStorage.removeItem('session_id');
    setUser(null);
  };

  const updateUser = async (data: { name: string; bio: string; phone: string }) => {
    const res = await api.updateMe(data);
    setUser(res.user as User);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
