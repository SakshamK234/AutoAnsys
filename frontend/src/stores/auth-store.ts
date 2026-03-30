import { create } from 'zustand';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isGuest: false,

  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true, isGuest: user.role === 'guest' });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false, isGuest: false });
  },

  hydrate: () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({ user, token, isAuthenticated: true, isGuest: user.role === 'guest' });
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  },
}));
