import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { errorText } from '../lib/api';
import { useAuth } from '../stores/auth';
import { Button, Field, Input } from '../components/ui';
import type { TokenResponse, User } from '../types';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setAuth = useAuth((s) => s.setAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const dest = (location.state as { from?: { pathname?: string } })?.from?.pathname ?? '/';

  async function finishLogin(tokens: TokenResponse) {
    localStorage.setItem('token', tokens.access_token);
    const me = (await api.get<User>('/auth/me')).data;
    setAuth(me, tokens.access_token, tokens.refresh_token);
    navigate(dest, { replace: true });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'register') {
        await api.post('/auth/register', { email, name, password, invite_code: inviteCode });
      }
      const { data } = await api.post<TokenResponse>('/auth/login', { email, password });
      await finishLogin(data);
    } catch (err) {
      setError(errorText(err, 'Sign-in failed'));
    } finally {
      setBusy(false);
    }
  }

  async function onGuest() {
    setError(null);
    setBusy(true);
    try {
      const { data } = await api.post<TokenResponse>('/auth/guest');
      await finishLogin(data);
    } catch (err) {
      setError(errorText(err, 'Guest access failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full">
      {/* Livery panel */}
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-race p-10 lg:flex">
        <div className="flex items-center gap-3">
          <svg width="34" height="34" viewBox="0 0 28 28" aria-hidden>
            <rect x="3" y="5" width="22" height="4" rx="1" fill="#fff" />
            <rect x="6" y="12" width="19" height="4" rx="1" fill="#fff" opacity="0.75" />
            <rect x="10" y="19" width="15" height="4" rx="1" fill="#fff" opacity="0.5" />
          </svg>
          <span className="font-display text-2xl font-bold tracking-tight text-white">AutoAnsys</span>
        </div>

        <div>
          <p className="font-condensed text-[13px] font-bold tracking-[0.18em] text-race-text uppercase">
            CAD in · coefficients out
          </p>
          <h1 className="font-display mt-3 max-w-md text-[40px] leading-[1.05] font-bold text-white">
            The team's wind tunnel lives on the cluster.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-race-text">
            Upload a part from NX, mesh and solve it in Fluent on TinkerCliffs, and review
            forces, convergence, and contours together — no SSH, no journal files.
          </p>
        </div>

        {/* Big livery stripes anchor the panel bottom. */}
        <div aria-hidden>
          <div className="h-4 w-3/4 bg-white" />
          <div className="mt-2 h-4 w-3/5 bg-[#d92d20]" />
          <div className="mt-2 h-4 w-2/5 bg-[#e8a013]" />
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="font-display text-2xl font-bold text-race">AutoAnsys</span>
          </div>
          <h2 className="font-display text-[24px] font-bold text-ink">
            {mode === 'login' ? 'Sign in' : 'Join the team'}
          </h2>
          <p className="mt-1 text-sm text-ink-3">
            {mode === 'login' ? 'Back to the garage.' : 'Create your account to submit runs.'}
          </p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            {mode === 'register' && (
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </Field>
            )}
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </Field>
            {mode === 'register' && (
              <Field label="Invite code" hint="Leave empty if your deployment has open registration.">
                <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
              </Field>
            )}

            {error && (
              <p role="alert" className="border border-crit/40 bg-crit-tint px-3 py-2 text-sm text-crit">
                {error}
              </p>
            )}

            <Button type="submit" variant="primary" busy={busy} className="h-10">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <button
              className="cursor-pointer font-medium text-race hover:underline"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
            >
              {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
            </button>
            <button className="cursor-pointer text-ink-3 hover:text-ink" onClick={onGuest} disabled={busy}>
              Browse as guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
