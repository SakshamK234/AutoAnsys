import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { Wind, Mail, Lock, UserIcon, ArrowRight } from 'lucide-react';
import api from '@/lib/api';

export function LoginForm() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await api.post('/auth/register', { email, password, name });
      }
      const res = await api.post('/auth/login', { email, password });
      const { access_token, refresh_token } = res.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      const userRes = await api.get('/auth/me');
      setAuth(userRes.data, access_token, refresh_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setGuestLoading(true);

    try {
      const res = await api.post('/auth/guest');
      const { access_token, refresh_token } = res.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      const userRes = await api.get('/auth/me');
      setAuth(userRes.data, access_token, refresh_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Guest login failed');
    } finally {
      setGuestLoading(false);
    }
  };

  const anyLoading = loading || guestLoading;

  const inputClass =
    'w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-10 pr-3 py-2.5 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-shadow';

  return (
    <form onSubmit={handleSubmit} className="space-y-5 w-full">
      <div className="lg:hidden flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
          <Wind className="h-4 w-4 text-[hsl(var(--primary-foreground))]" />
        </div>
        <span className="text-lg font-bold tracking-tight">AutoAnsys</span>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {isRegister ? 'Create your account' : 'Welcome back'}
        </h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          {isRegister
            ? 'Get started with your FSAE simulations'
            : 'Sign in to continue to your simulations'}
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {isRegister && (
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
              placeholder="Full name"
            />
          </div>
        )}

        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
            placeholder="you@team.edu"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputClass}
            placeholder="Password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={anyLoading}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 active:brightness-95 disabled:opacity-50 transition-all"
      >
        {loading ? 'Signing in...' : isRegister ? 'Create Account' : 'Sign In'}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[hsl(var(--border))]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[hsl(var(--background))] px-2 text-[hsl(var(--muted-foreground))]">or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGuestLogin}
        disabled={anyLoading}
        className="w-full rounded-lg border border-[hsl(var(--input))] py-2.5 text-sm font-medium hover:bg-[hsl(var(--accent))] disabled:opacity-50 transition-colors"
      >
        {guestLoading ? 'Setting up...' : 'Continue as Guest'}
      </button>

      <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
        {isRegister ? 'Already have an account? ' : "Don't have an account? "}
        <button
          type="button"
          onClick={() => { setIsRegister(!isRegister); setError(''); }}
          className="font-medium text-[hsl(var(--primary))] hover:underline"
        >
          {isRegister ? 'Sign in' : 'Register'}
        </button>
      </p>
    </form>
  );
}
