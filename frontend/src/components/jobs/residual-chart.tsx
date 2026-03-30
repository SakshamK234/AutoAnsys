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
import type { ResidualData } from '@/types';

const COLORS = {
  continuity: '#f97316',
  x_velocity: '#06b6d4',
  y_velocity: '#22c55e',
  z_velocity: '#eab308',
  k: '#a78bfa',
  omega: '#fb7185',
};

interface ResidualChartProps {
  data: ResidualData[];
}

export function ResidualChart({ data }: ResidualChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
        No residual data available
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="iteration"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            label={{ value: 'Iteration', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            scale="log"
            domain={['auto', 'auto']}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            label={{ value: 'Residual', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend />
          {Object.entries(COLORS).map(([key, color]) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              dot={false}
              strokeWidth={1.5}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
