import { useNavigate } from 'react-router-dom';
import { Plus, Upload, BarChart3 } from 'lucide-react';

export function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { icon: Plus, label: 'New Simulation', description: 'Start a new CFD run', to: '/new-job' },
    { icon: Upload, label: 'Upload Geometry', description: 'Add a CAD file', to: '/geometries' },
    { icon: BarChart3, label: 'View Results', description: 'Check completed sims', to: '/jobs' },
  ];

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <h3 className="mb-4 font-semibold">Quick Actions</h3>
      <div className="grid gap-3">
        {actions.map((action) => (
          <button
            key={action.to}
            onClick={() => navigate(action.to)}
            className="flex items-center gap-3 rounded-md border border-[hsl(var(--border))] p-3 text-left transition-colors hover:bg-[hsl(var(--accent))]"
          >
            <div className="rounded-md bg-[hsl(var(--primary))] p-2 text-[hsl(var(--primary-foreground))]">
              <action.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">{action.label}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{action.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
