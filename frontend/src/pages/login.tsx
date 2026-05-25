import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { ThemeMenu } from '@/components/layout/theme-menu';
import { LoginForm } from '@/components/auth/login-form';
import { Wind, Cpu, Gauge, Layers } from 'lucide-react';

export function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen">
      {/* Branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[hsl(var(--card))] p-12 relative overflow-hidden">
        <div className="bg-grid-pattern absolute inset-0 opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.12)] via-transparent to-[hsl(var(--primary)/0.06)]" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
              <Wind className="h-5 w-5 text-[hsl(var(--primary-foreground))]" />
            </div>
            <span className="text-xl font-bold tracking-tight">AutoAnsys</span>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight leading-tight">
              Automated CFD<br />
              for Formula SAE
            </h1>
            <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))] max-w-md">
              From CAD upload to converged results. Run ANSYS Fluent simulations
              without touching a single journal file.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-md">
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background)/0.5)] p-4">
              <Cpu className="h-5 w-5 text-[hsl(var(--primary))] mb-2" />
              <p className="text-xs font-medium">HPC Cluster</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">SLURM integration</p>
            </div>
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background)/0.5)] p-4">
              <Layers className="h-5 w-5 text-[hsl(var(--primary))] mb-2" />
              <p className="text-xs font-medium">Auto Mesh</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Surface + volume</p>
            </div>
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background)/0.5)] p-4">
              <Gauge className="h-5 w-5 text-[hsl(var(--primary))] mb-2" />
              <p className="text-xs font-medium">Live Monitor</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Residuals & forces</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-[hsl(var(--muted-foreground))]">
          Built for FSAE aero teams
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-[hsl(var(--background))] p-8">
        <div className="absolute top-4 right-4">
          <ThemeMenu />
        </div>
        <div className="w-full max-w-sm animate-fade-in">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
