import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { ThemeMenu } from '@/components/layout/theme-menu';
import { LoginForm } from '@/components/auth/login-form';
import { Gauge, Cpu, Layers, Activity } from 'lucide-react';

export function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen">
      {/* Branding panel — the pit wall at night */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between carbon-surface p-12 relative overflow-hidden">
        <div className="bg-grid-pattern absolute inset-0 opacity-70" />
        <div className="bg-apex-glow absolute inset-0" />
        {/* Kerb strip down the panel edge */}
        <div className="kerb-strip absolute right-0 top-0 bottom-0 w-1.5" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="chamfer-sm flex h-10 w-10 items-center justify-center bg-gradient-to-br from-[hsl(var(--brand-orange))] to-[hsl(var(--brand-maroon))]">
              <Gauge className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-xl font-bold uppercase tracking-[0.14em] leading-none">
                AutoAnsys
              </span>
              <span className="mt-1 text-[10px] uppercase tracking-[0.34em] text-[hsl(var(--muted-foreground))]">
                Pit Wall
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-10">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
              Formula SAE · CFD Operations
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold uppercase leading-[1.1] tracking-wide">
              CAD in.<br />
              Downforce out.
            </h1>
            <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))] max-w-md">
              Upload geometry, pick a run profile, launch on the cluster.
              Forces, coefficients and flow fields come back — no journal
              files, no SSH, no babysitting.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-md">
            {[
              { icon: Cpu, title: 'ARC · SLURM', sub: 'TinkerCliffs launch' },
              { icon: Layers, title: 'Auto mesh', sub: 'Wrap + watertight' },
              { icon: Activity, title: 'Telemetry', sub: 'Forces live' },
            ].map(({ icon: Icon, title, sub }) => (
              <div key={title} className="pit-card pit-card--rail p-4">
                <Icon className="h-5 w-5 text-[hsl(var(--primary))] mb-2" />
                <p className="font-display text-xs font-semibold uppercase tracking-wider">{title}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <span className="checkered inline-block h-3 w-10 opacity-60" />
          <p className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            Built by the aero crew, for the whole team
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-[hsl(var(--background))] p-8">
        <div className="racing-stripe absolute inset-x-0 top-0 h-[3px]" />
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
