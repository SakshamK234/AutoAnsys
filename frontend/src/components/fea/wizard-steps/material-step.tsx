import { MaterialConfig } from '@/components/fea/material-config';
import type { FEAMaterial } from '@/types/fea';

interface MaterialStepProps {
  material: FEAMaterial;
  onChange: (material: FEAMaterial) => void;
}

export function MaterialStep({ material, onChange }: MaterialStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Material Properties</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Select a preset or define custom isotropic material properties.
        </p>
      </div>

      <MaterialConfig material={material} onChange={onChange} />
    </div>
  );
}
