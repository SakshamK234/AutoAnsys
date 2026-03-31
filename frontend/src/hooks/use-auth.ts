import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { User, TokenResponse, LoginRequest, RegisterRequest } from '@/types';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      const res = await api.post<TokenResponse>('/auth/login', data);
      const { access_token, refresh_token } = res.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      const userRes = await api.get<User>('/auth/me');
      return { user: userRes.data, access_token, refresh_token };
    },
    onSuccess: ({ user, access_token, refresh_token }) => {
      setAuth(user, access_token, refresh_token);
      navigate('/');
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      await api.post('/auth/register', data);
      const res = await api.post<TokenResponse>('/auth/login', {
        email: data.email,
        password: data.password,
      });
      const { access_token, refresh_token } = res.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      const userRes = await api.get<User>('/auth/me');
      return { user: userRes.data, access_token, refresh_token };
    },
    onSuccess: ({ user, access_token, refresh_token }) => {
      setAuth(user, access_token, refresh_token);
      navigate('/');
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return () => {
    logout();
    navigate('/login');
  };
}
