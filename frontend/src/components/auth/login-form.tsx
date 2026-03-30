import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await api.post('/auth/register', { email, password, name });
      }
      const res = await api.post('/auth/login', { email, password });
      const { access_token } = res.data;

      // Store token, then fetch user
      localStorage.setItem('token', access_token);
      const userRes = await api.get('/auth/me');
      setAuth(userRes.data, access_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">AutoAnsys</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">FSAE CFD Simulation Platform</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">{error}</div>
      )}

      {isRegister && (
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" placeholder="John Doe" />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" placeholder="you@team.edu" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-[hsl(var(--primary))] py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
      </button>

      <button
        type="button"
        onClick={() => { setIsRegister(!isRegister); setError(''); }}
        className="w-full text-sm text-[hsl(var(--muted-foreground))] hover:underline"
      >
        {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
      </button>
    </form>
  );
}
