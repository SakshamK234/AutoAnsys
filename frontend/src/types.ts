/** API types — mirror backend/app/schemas. Keep field names snake_case. */

export type JobStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type CfdMode = 'individual_part' | 'full_car';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'guest' | 'member' | 'aero_lead' | 'admin';
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Geometry {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  component_name: string | null;
  description: string | null;
  tags: string[] | null;
  version: number;
  file_size: number;
  s3_key: string;
  created_at: string;
}

export interface JobProgress {
  stage: string | null;
  marker: string | null;
  iteration?: number | null;
  max_iterations?: number | null;
}

export interface MeshSummary {
  id: string;
  name: string;
  status: string;
  cell_count: number | null;
  meshing_minutes: number | null;
}

export interface Job {
  id: string;
  user_id: string;
  geometry_id: string;
  name: string;
  status: JobStatus;
  config: JobConfig | null;
  slurm_job_id: string | null;
  submitted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cluster_workspace: string | null;
  group_id: string | null;
  group_name: string | null;
  owner_name: string | null;
  mesh_id: string | null;
  mesh: MeshSummary | null;
  error_message: string | null;
  progress: JobProgress | null;
  created_at: string;
}

export interface JobList {
  items: Job[];
  total: number;
}

export interface Mesh {
  id: string;
  user_id: string;
  geometry_id: string;
  group_id: string | null;
  name: string;
  status: string;
  config: Record<string, unknown> | null;
  config_hash: string;
  cell_count: number | null;
  meshing_minutes: number | null;
  case_file_s3_key: string | null;
  slurm_job_id: string | null;
  submitted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cluster_workspace: string | null;
  error_message: string | null;
  progress: JobProgress | null;
  created_at: string;
  geometry_name: string | null;
  group_name: string | null;
  owner_name: string | null;
  jobs_using_count: number | null;
}

export interface MeshList {
  items: Mesh[];
  total: number;
}

export interface ForcePoint {
  iteration: number;
  cd: number;
  cl: number;
  cm: number;
  drag_n: number;
  lift_n: number;
  moment_nm: number;
}

export interface ResidualPoint {
  iteration: number;
  continuity: number;
  x_velocity: number;
  y_velocity: number;
  z_velocity: number;
  k: number;
  omega: number;
}

export interface ResultFile {
  id: string;
  job_id: string;
  filename: string;
  file_type: string;
  s3_key: string;
  file_size: number;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
  member_count: number;
}

export interface GroupMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user_name: string | null;
  user_email: string | null;
}

export interface GroupDetail extends Group {
  members: GroupMember[];
}

export interface Template {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  config: Record<string, unknown> | null;
  is_shared: boolean;
  is_recommended: boolean;
  version: number;
  created_at: string;
}

export interface ClusterStatus {
  connected: boolean;
  nodes: { total: number; idle: number; allocated: number; down: number };
  queue: { pending: number; running: number };
  message: string | null;
}

/* ── Run configuration (subset the UI edits; the rest rides along) ───────── */

export interface VelocityInletBC {
  zone_name: string;
  velocity: number;
  turbulent_intensity_pct: number;
  turbulent_viscosity_ratio: number;
}

export interface BoundaryConditions {
  velocity_inlets: VelocityInletBC[];
  pressure_outlets: { zone_name: string; gauge_pressure: number }[];
  translating_walls: {
    zone_name: string;
    velocity_mps: number;
    direction_x: number;
    direction_y: number;
    direction_z: number;
  }[];
  rotating_walls: {
    zone_name: string;
    omega_rad_s: number;
    origin_x: number;
    origin_y: number;
    origin_z: number;
    axis_x: number;
    axis_y: number;
    axis_z: number;
  }[];
  slip_walls: { zone_name: string }[];
  stationary_walls: { zone_name: string }[];
  symmetry_planes: { zone_name: string }[];
}

export interface SolverConfig {
  general: Record<string, string>;
  turbulence: { model: string; near_wall_treatment: string; curvature_correction: boolean };
  boundary_conditions: BoundaryConditions;
  solution_methods: Record<string, string>;
  convergence: {
    residual_target: number;
    max_iterations: number;
    force_monitor_window: number;
    force_monitor_tolerance: number;
    use_force_convergence: boolean;
  };
  data_export: Record<string, unknown>;
  reference_values: {
    area_m2: number;
    length_m: number;
    velocity_mps: number;
    density_kg_m3: number;
  };
  symmetry: { half_model: boolean; force_factor: number };
  reporting: Record<string, unknown> & { body_wall_pattern: string };
  initialization: string;
}

export interface MeshConfig {
  [key: string]: unknown;
  workflow: 'watertight' | 'fault-tolerant';
  geometry_unit: string;
  surface_mesh: {
    min_size: number;
    max_size: number;
    curvature_normal_angle: number;
    growth_rate: number;
  };
  volume_mesh: {
    max_cell_length: number;
    growth_rate: number;
    first_layer_height_mm: number | null;
    num_layers: number;
    bl_growth_rate: number;
    [key: string]: unknown;
  };
}

export interface SlurmConfig {
  nodes: number;
  cores_per_node: number;
  memory_gb: number;
  walltime_hours: number;
  partition: string;
  account: string;
  job_name: string;
  mpi: string;
  interconnect: string;
}

export interface JobConfig {
  cfd_mode: CfdMode;
  mesh: MeshConfig;
  solver: SolverConfig;
  slurm: SlurmConfig;
}

export interface ProfileResponse {
  mode: CfdMode;
  preset: Record<string, unknown>;
  defaults: { solver: SolverConfig; slurm: SlurmConfig; mesh: MeshConfig };
}

/* ── Live WebSocket events ──────────────────────────────────────────────── */

export type LiveEvent =
  | { type: 'status_update'; data: { status: JobStatus; started_at?: string; completed_at?: string } }
  | { type: 'progress'; data: JobProgress }
  | { type: 'residual'; data: Partial<ResidualPoint> & { iteration: number } }
  | { type: 'force'; data: ForcePoint }
  | { type: 'results_ready'; data: { files_downloaded: number } };
