import { useNavigate } from 'react-router-dom';
import { Plus, Upload, BarChart3, ArrowRight } from 'lucide-react';

export function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { icon: Plus, label: 'New Simulation', description: 'Start a CFD run', to: '/new-job' },
    { icon: Upload, label: 'Upload Geometry', description: 'Add CAD file', to: '/geometries' },
    { icon: BarChart3, label: 'View Results', description: 'Completed sims', to: '/jobs' },
  ];

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
      <div className="space-y-2">
        {actions.map((action) => (
          <button
            key={action.to}
            onClick={() => navigate(action.to)}
            className="group flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-[hsl(var(--accent))]"
          >
            <div className="rounded-lg bg-[hsl(var(--primary)/0.1)] p-2 text-[hsl(var(--primary))] transition-colors group-hover:bg-[hsl(var(--primary))] group-hover:text-[hsl(var(--primary-foreground))]">
              <action.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{action.label}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{action.description}</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
