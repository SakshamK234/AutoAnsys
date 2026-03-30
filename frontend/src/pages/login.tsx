import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { LoginForm } from '@/components/auth/login-form';

export function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))]">
      <LoginForm />
    </div>
  );
}
