import type {
  MeshConfig,
  SolverConfig,
  SlurmConfig,
  WindTunnelConfig,
  EnclosureConfig,
  LocalSizingCategory,
  CfdMode,
} from '@/types';

export const WIND_TUNNEL_PRESETS: Record<string, WindTunnelConfig> = {
  'Component Small': {
    x_min: -2.0,
    x_max: 4.0,
    y_min: 0.0,
    y_max: 2.0,
    z_min: -1.5,
    z_max: 1.5,
  },
  'Half Car Standard': {
    x_min: -5.0,
    x_max: 15.0,
    y_min: 0.0,
    y_max: 5.0,
    z_min: -3.0,
    z_max: 3.0,
  },
  'Full Car Large': {
    x_min: -8.0,
    x_max: 20.0,
    y_min: 0.0,
    y_max: 6.0,
    z_min: -5.0,
    z_max: 5.0,
  },
};

export const VELOCITY_PRESETS: Record<string, number> = {
  'FSAE SOP (15.65)': 15.65,
  'Autocross 15': 15,
  'Endurance 20': 20,
  'Acceleration 25': 25,
  'Top Speed 30': 30,
};

// SOP enclosure presets (mm), measured from the part — built in Discovery, not Fluent.
// Individual Part SOP: back 8000, front 1000, rest 2500.
// Kevin Full Car: front must be 1000 (not 2892.28); rest use individual-part defaults.
export const ENCLOSURE_PRESETS: Record<string, EnclosureConfig> = {
  'Individual Part (SOP)': {
    back_mm: 8000,
    front_mm: 1000,
    top_mm: 2500,
    bottom_mm: 2500,
    left_mm: 2500,
    right_mm: 2500,
    flow_axis: '+x',
  },
  'Full Car (Kevin)': {
    back_mm: 8000,
    front_mm: 1000,
    top_mm: 2500,
    bottom_mm: 2500,
    left_mm: 2500,
    right_mm: 2500,
    flow_axis: '+x',
  },
};

export const LOCAL_SIZING_CATEGORIES: { value: LocalSizingCategory; label: string; group: 'sizing' | 'refinement' }[] = [
  { value: 'aero', label: 'Aero (airfoils / diffusers)', group: 'sizing' },
  { value: 'chassis', label: 'Chassis', group: 'sizing' },
  { value: 'wheels', label: 'Wheels', group: 'sizing' },
  { value: 'intake', label: 'Intake', group: 'sizing' },
  { value: 'nearfield', label: 'Nearfield refinement', group: 'refinement' },
  { value: 'farfield', label: 'Farfield refinement', group: 'refinement' },
  { value: 'rear_wing', label: 'Rear Wing refinement', group: 'refinement' },
];

export const CFD_MODE_LABELS: Record<CfdMode, string> = {
  individual_part: 'Individual Part (SOP)',
  full_car: 'Full Car (Kevin reference)',
};

export const TURBULENCE_MODELS = [
  'k-omega-sst',
  'k-epsilon-realizable',
  'k-epsilon-standard',
  'spalart-allmaras',
  'k-omega-standard',
  'reynolds-stress',
] as const;

export const SOLVER_SCHEMES = [
  'SIMPLE',
  'SIMPLEC',
  'PISO',
  'Coupled',
] as const;

export const GRADIENT_METHODS = [
  'least-squares-cell-based',
  'green-gauss-node-based',
  'green-gauss-cell-based',
] as const;

export const PRESSURE_SCHEMES = [
  'second-order',
  'standard',
  'presto',
  'linear',
  'body-force-weighted',
] as const;

export const MOMENTUM_SCHEMES = [
  'second-order-upwind',
  'first-order-upwind',
  'quick',
  'third-order-muscl',
  'power-law',
] as const;

export const PARTITIONS = [
  'normal_q',
  'preemptable_q',
  'a100_normal_q',
  'a100_preemptable_q',
  'h200_normal_q',
  'h200_preemptable_q',
] as const;

export const DEFAULT_MESH_CONFIG: MeshConfig = {
  local_sizing: [],
  surface_mesh: {
    // mm units. Reference SOP journal used 2 / 264.
    min_size: 2,
    max_size: 264,
    curvature_normal_angle: 18,
    growth_rate: 1.2,
  },
  wind_tunnel: {
    x_min: -5.0,
    x_max: 15.0,
    y_min: 0.0,
    y_max: 5.0,
    z_min: -3.0,
    z_max: 3.0,
  },
  // SOP enclosure (mm) is the default representation from now on.
  enclosure: {
    back_mm: 8000,
    front_mm: 1000,
    top_mm: 2500,
    bottom_mm: 2500,
    left_mm: 2500,
    right_mm: 2500,
    flow_axis: '+x',
  },
  mesh_quality: {
    surface_skewness_threshold: 0.6,
    volume_orthogonal_quality_threshold: 0.15,
    auto_improve: true,
  },
  volume_mesh: {
    max_cell_length: 0.15,
    growth_rate: 1.2,
    first_layer_height: 5e-5,
    num_layers: 15,
    bl_growth_rate: 1.2,
  },
  geometry_unit: 'mm',
  // SOP face labels applied in Discovery.
  original_zones: ['inlet', 'outlet', 'ground', 'symmetry', 'walls'],
};

export const DEFAULT_SOLVER_CONFIG: SolverConfig = {
  general: {
    solver_type: 'pressure-based',
    time: 'steady',
    velocity_formulation: 'absolute',
  },
  turbulence: {
    model: 'k-omega-sst',
    near_wall_treatment: 'auto',
    curvature_correction: true,
  },
  // BCs start empty — applyCfdModeDefaults() fills them per-mode.
  boundary_conditions: {
    velocity_inlets: [],
    pressure_outlets: [],
    translating_walls: [],
    rotating_walls: [],
    slip_walls: [],
    stationary_walls: [],
    symmetry_planes: [],
  },
  solution_methods: {
    scheme: 'Coupled',
    gradient: 'least-squares-cell-based',
    pressure: 'second-order',
    momentum: 'second-order-upwind',
    turbulent_kinetic_energy: 'second-order-upwind',
    specific_dissipation_rate: 'second-order-upwind',
  },
  convergence: {
    residual_target: 1e-4,
    // SOP Individual Part = 300; Full Car mode bumps this to 750.
    max_iterations: 300,
    force_monitor_window: 100,
    force_monitor_tolerance: 0.001,
  },
  data_export: {
    forces_csv: true,
    residuals_csv: true,
    case_data: true,
    surface_data: ['pressure', 'wall-shear'],
  },
  reference_values: {
    area_m2: 1.2,
    length_m: 2.8,
    velocity_mps: 15.65,
    // Sea-level air — required for physical force coefficients.
    density_kg_m3: 1.225,
  },
  // "hybrid" → /solve/init/hyb-init (matches specialist script).
  // "hybrid-absolute" → set absolute reference frame, then hyb-initialize.
  initialization: 'hybrid',
};

/**
 * Mirror of backend `apply_cfd_mode_defaults` (schemas/job.py).
 *
 * - full_car: BCs = inlet (15.65, 5%/10), front-tire & rear-tire @ 77 rad/s
 *   with the Max-Squat origins, ground translating at -15.65 m/s in -x,
 *   tunnel-walls and contact-patches as slip walls, centreline symmetry plane
 *   (half-car; the backend pairs it with symmetry.force_factor = 2.0).
 *   Reference: FULL frontal area 1.0 m², length = wheelbase 1.5367 m (F1).
 *   Iterations 750.
 * - individual_part: inlet, outlet, moving ground, walls, symmetry plane.
 *   Reference area 1.2 m², iterations 300.
 *
 * NOTE: the backend serves these presets at GET /api/profiles/{mode} from its
 * single source of truth (profiles.yaml). Prefer that endpoint over extending
 * this mirror — it has drifted before.
 *
 * Only fills BCs when all lists are empty, so once the wizard has populated
 * them, switching modes does not clobber user edits.
 */
export function applyCfdModeDefaults(mode: CfdMode, solver: SolverConfig): SolverConfig {
  const next: SolverConfig = JSON.parse(JSON.stringify(solver));
  const bc = next.boundary_conditions;
  const isEmpty =
    bc.velocity_inlets.length === 0 &&
    bc.pressure_outlets.length === 0 &&
    bc.translating_walls.length === 0 &&
    bc.rotating_walls.length === 0 &&
    bc.slip_walls.length === 0 &&
    bc.stationary_walls.length === 0 &&
    bc.symmetry_planes.length === 0;

  if (mode === 'full_car') {
    if (isEmpty) {
      next.boundary_conditions = {
        velocity_inlets: [
          {
            zone_name: 'inlet',
            velocity: 15.65,
            turbulent_intensity_pct: 5.0,
            turbulent_viscosity_ratio: 10.0,
          },
        ],
        // F4 fix: the specialist preset omitted an outlet; an external-aero
        // domain needs one. Matches the backend preset (profiles.yaml).
        pressure_outlets: [{ zone_name: 'outlet', gauge_pressure: 0.0 }],
        translating_walls: [
          {
            zone_name: 'ground',
            velocity_mps: 15.65,
            direction_x: -1.0,
            direction_y: 0.0,
            direction_z: 0.0,
          },
        ],
        rotating_walls: [
          {
            zone_name: 'front-tire',
            omega_rad_s: 77.0,
            origin_x: 0.8264, origin_y: 0.6125, origin_z: 0.1998,
            axis_x: 0.0, axis_y: 1.0, axis_z: 0.0,
          },
          {
            zone_name: 'rear-tire',
            omega_rad_s: 77.0,
            origin_x: -0.7056, origin_y: 0.6125, origin_z: 0.1998,
            axis_x: 0.0, axis_y: 1.0, axis_z: 0.0,
          },
        ],
        slip_walls: [
          { zone_name: 'tunnel-walls' },
          { zone_name: 'contact-patches' },
        ],
        stationary_walls: [],
        // Half-car centreline symmetry plane — must match the backend preset
        // (profiles.yaml), which pairs it with symmetry.force_factor = 2.0.
        symmetry_planes: [{ zone_name: 'symmetry' }],
      };
    }
    // F1: FULL frontal area (1.0 m²) — half-model forces are doubled in post,
    // so the area must be the whole car's. Reference length = wheelbase
    // (60.5 in = 1.5367 m). Matches the backend preset (profiles.yaml).
    if (next.reference_values.area_m2 === 1.2) {
      next.reference_values.area_m2 = 1.0;
    }
    if (next.reference_values.length_m === 2.8) {
      next.reference_values.length_m = 1.5367;
    }
    if (next.convergence.max_iterations === 300 || next.convergence.max_iterations === 3000) {
      next.convergence.max_iterations = 750;
    }
  } else if (mode === 'individual_part') {
    if (isEmpty) {
      next.boundary_conditions = {
        velocity_inlets: [
          {
            zone_name: 'inlet',
            velocity: 15.65,
            turbulent_intensity_pct: 5.0,
            turbulent_viscosity_ratio: 10.0,
          },
        ],
        pressure_outlets: [{ zone_name: 'outlet', gauge_pressure: 0.0 }],
        translating_walls: [
          {
            zone_name: 'ground',
            velocity_mps: 15.65,
            direction_x: -1.0,
            direction_y: 0.0,
            direction_z: 0.0,
          },
        ],
        rotating_walls: [],
        slip_walls: [],
        stationary_walls: [{ zone_name: 'walls' }],
        symmetry_planes: [{ zone_name: 'symmetry' }],
      };
    }
    if (next.convergence.max_iterations === 750) {
      next.convergence.max_iterations = 300;
    }
  }
  return next;
}

export const DEFAULT_SLURM_CONFIG: SlurmConfig = {
  nodes: 1,
  cores_per_node: 128,
  memory_gb: 243,
  walltime_hours: 24,
  partition: 'normal_q',
  account: 'your_slurm_account',
  job_name: 'autoansys_cfd',
};
