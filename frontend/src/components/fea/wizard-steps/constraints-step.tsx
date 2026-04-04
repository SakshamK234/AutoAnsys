import { ConstraintsConfig } from '@/components/fea/constraints-config';
import { LoadsConfig } from '@/components/fea/loads-config';
import type { FEAConstraint, FEALoad } from '@/types/fea';

interface ConstraintsStepProps {
  constraints: FEAConstraint[];
  onConstraintsChange: (constraints: FEAConstraint[]) => void;
  loads: FEALoad[];
  onLoadsChange: (loads: FEALoad[]) => void;
}

export function ConstraintsStep({
  constraints,
  onConstraintsChange,
  loads,
  onLoadsChange,
}: ConstraintsStepProps) {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-1">Boundary Conditions</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Define constraints — at least one is required.
          </p>
        </div>
        <ConstraintsConfig constraints={constraints} onChange={onConstraintsChange} />
      </section>

      <div className="border-t border-[hsl(var(--border))]" />

      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-1">Loads</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Apply forces, pressures, gravity, or prescribed displacements — at least one is required.
          </p>
        </div>
        <LoadsConfig loads={loads} onChange={onLoadsChange} />
      </section>
    </div>
  );
}
