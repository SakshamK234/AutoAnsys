import type { MeshConfig, SolverConfig, SlurmConfig, WindTunnelConfig } from '@/types';

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
  'Autocross 15': 15,
  'Endurance 20': 20,
  'Acceleration 25': 25,
  'Top Speed 30': 30,
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
  'compute',
  'gpu',
  'highmem',
  'debug',
] as const;

export const DEFAULT_MESH_CONFIG: MeshConfig = {
  local_sizing: [],
  surface_mesh: {
    min_size: 0.002,
    max_size: 0.1,
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
  volume_mesh: {
    max_cell_length: 0.15,
    growth_rate: 1.2,
    first_layer_height: 5e-5,
    num_layers: 15,
    bl_growth_rate: 1.2,
  },
  geometry_unit: 'm',
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
  },
  boundary_conditions: {
    inlet: {
      velocity: 20,
      turbulent_intensity: 0.01,
      turbulent_viscosity_ratio: 10,
    },
    outlet: {
      gauge_pressure: 0,
    },
    ground: {
      type: 'moving-wall',
      velocity: 20,
    },
    symmetry: {
      type: 'symmetry',
    },
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
    max_iterations: 2000,
    force_monitor_window: 100,
    force_monitor_tolerance: 0.001,
  },
  data_export: {
    forces_csv: true,
    residuals_csv: true,
    case_data: true,
    surface_data: ['pressure', 'wall-shear'],
  },
};

export const DEFAULT_SLURM_CONFIG: SlurmConfig = {
  nodes: 1,
  cores_per_node: 48,
  memory_gb: 128,
  walltime_hours: 24,
  partition: 'compute',
  job_name: 'autoansys_cfd',
};
