export const MATERIAL_PRESETS = {
  steel:        { label: 'Steel (A36)',          youngs_modulus: 210e9,  poissons_ratio: 0.30, density: 7850, yield_strength: 250e6  },
  aluminum:     { label: 'Aluminum (6061-T6)',   youngs_modulus: 69e9,   poissons_ratio: 0.33, density: 2700, yield_strength: 270e6  },
  titanium:     { label: 'Titanium (Ti-6Al-4V)', youngs_modulus: 116e9,  poissons_ratio: 0.32, density: 4510, yield_strength: 880e6  },
  cast_iron:    { label: 'Cast Iron',            youngs_modulus: 170e9,  poissons_ratio: 0.26, density: 7200, yield_strength: 200e6  },
  copper:       { label: 'Copper',               youngs_modulus: 110e9,  poissons_ratio: 0.34, density: 8960, yield_strength: 210e6  },
  abs_plastic:  { label: 'ABS Plastic',          youngs_modulus: 2.3e9,  poissons_ratio: 0.35, density: 1050, yield_strength: 40e6   },
  nylon:        { label: 'Nylon (PA6)',          youngs_modulus: 2.8e9,  poissons_ratio: 0.39, density: 1150, yield_strength: 55e6   },
  carbon_fiber: { label: 'Carbon Fiber (CFRP)',  youngs_modulus: 70e9,   poissons_ratio: 0.10, density: 1600, yield_strength: 600e6  },
  concrete:     { label: 'Concrete',             youngs_modulus: 30e9,   poissons_ratio: 0.20, density: 2400, yield_strength: null    },
  custom:       { label: 'Custom\u2026',         youngs_modulus: null,   poissons_ratio: null,  density: null,  yield_strength: null   },
} as const;

export type MaterialPresetKey = keyof typeof MATERIAL_PRESETS;

export const CONSTRAINT_LABELS: Record<string, string> = {
  fixed:        'Fixed Support',
  pinned:       'Pinned',
  roller:       'Roller',
  symmetry:     'Symmetry',
  displacement: 'Forced Displacement',
};

export const LOAD_LABELS: Record<string, string> = {
  force:        'Force',
  pressure:     'Pressure',
  gravity:      'Gravity',
  displacement: 'Forced Displacement',
};

export const FEA_PARTITIONS = ['standard', 'compute', 'gpu', 'highmem', 'debug'] as const;
