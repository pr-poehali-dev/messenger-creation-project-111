import { createContext } from 'react';
import { api } from '@/api/client';

export interface User {
  id: number;
  name: string;
  username: string;
  bio: string;
  phone: string;
  avatar_seed: string;
  online: boolean;
  email?: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (name: string, username: string, password: string, phone?: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: { name: string; bio: string; phone: string }) => Promise<void>;
}

export { api };
export const AuthContext = createContext<AuthContextType | null>(null);
