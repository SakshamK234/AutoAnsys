import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ForceReport } from '@/types';

interface ForceChartProps {
  data: ForceReport[];
}

export function ForceChart({ data }: ForceChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
        No force data available
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="iteration" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="cd" name="Cd" stroke="#f97316" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="cl" name="Cl" stroke="#06b6d4" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="cm" name="Cm" stroke="#22c55e" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
