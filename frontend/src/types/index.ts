// ── User ──────────────────────────────────────────────────────────────────────

export type UserRole = 'guest' | 'member' | 'aero_lead' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

// ── Geometry ──────────────────────────────────────────────────────────────────

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

export interface GeometryList {
  items: Geometry[];
  total: number;
}

// ── Group ─────────────────────────────────────────────────────────────────────

export interface GroupMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user_name: string | null;
  user_email: string | null;
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

export interface GroupDetail extends Group {
  members: GroupMember[];
}

// ── Job ──────────────────────────────────────────────────────────────────────

export type JobStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ── Mesh Config (mirrors backend schemas/job.py) ─────────────────────────────

export interface LocalSizingRegion {
  name: string;
  type: 'body_of_influence' | 'face_sizing';
  size: number;
  growth_rate: number;
  x_min?: number;
  x_max?: number;
  y_min?: number;
  y_max?: number;
  z_min?: number;
  z_max?: number;
  face_zones: string[];
}

export interface SurfaceMeshConfig {
  min_size: number;
  max_size: number;
  curvature_normal_angle: number;
  growth_rate: number;
}

export interface VolumeMeshConfig {
  max_cell_length: number;
  growth_rate: number;
  first_layer_height: number;
  num_layers: number;
  bl_growth_rate: number;
}

export interface WindTunnelConfig {
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  z_min: number;
  z_max: number;
}

export interface MeshConfig {
  local_sizing: LocalSizingRegion[];
  surface_mesh: SurfaceMeshConfig;
  volume_mesh: VolumeMeshConfig;
  wind_tunnel: WindTunnelConfig;
  geometry_unit: string;
}

// ── Solver Config (mirrors backend schemas/job.py) ───────────────────────────

export interface GeneralSolverConfig {
  solver_type: 'pressure-based' | 'density-based';
  time: 'steady' | 'transient';
  velocity_formulation: 'absolute' | 'relative';
}

export interface TurbulenceConfig {
  model: string;
  near_wall_treatment: string;
}

export interface InletBC {
  velocity: number;
  turbulent_intensity: number;
  turbulent_viscosity_ratio: number;
}

export interface OutletBC {
  gauge_pressure: number;
}

export interface GroundBC {
  type: string;
  velocity: number;
}

export interface SymmetryBC {
  type: string;
}

export interface BoundaryConditions {
  inlet: InletBC;
  outlet: OutletBC;
  ground: GroundBC;
  symmetry: SymmetryBC;
}

export interface SolutionMethods {
  scheme: string;
  gradient: string;
  pressure: string;
  momentum: string;
  turbulent_kinetic_energy: string;
  specific_dissipation_rate: string;
}

export interface ConvergenceConfig {
  residual_target: number;
  max_iterations: number;
  force_monitor_window: number;
  force_monitor_tolerance: number;
}

export interface DataExportConfig {
  forces_csv: boolean;
  residuals_csv: boolean;
  case_data: boolean;
  surface_data: string[];
}

export interface SolverConfig {
  general: GeneralSolverConfig;
  turbulence: TurbulenceConfig;
  boundary_conditions: BoundaryConditions;
  solution_methods: SolutionMethods;
  convergence: ConvergenceConfig;
  data_export: DataExportConfig;
}

// ── SLURM Config ─────────────────────────────────────────────────────────────

export interface SlurmConfig {
  nodes: number;
  cores_per_node: number;
  memory_gb: number;
  walltime_hours: number;
  partition: string;
  account: string;
  job_name: string;
}

// ── Job types ────────────────────────────────────────────────────────────────

export interface JobConfig {
  mesh: MeshConfig;
  solver: SolverConfig;
  slurm: SlurmConfig;
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
  created_at: string;
}

export interface JobListResponse {
  items: Job[];
  total: number;
}

// ── Templates ────────────────────────────────────────────────────────────────

export interface SimulationTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  config: Partial<JobConfig> | null;
  is_shared: boolean;
  is_recommended: boolean;
  version: number;
  created_at: string;
}

// ── Monitoring Data ──────────────────────────────────────────────────────────

export interface ResidualData {
  iteration: number;
  continuity: number;
  x_velocity: number;
  y_velocity: number;
  z_velocity: number;
  k: number;
  omega: number;
}

export interface ForceReport {
  iteration: number;
  cd: number;
  cl: number;
  cm: number;
}

// ── Cluster ──────────────────────────────────────────────────────────────────

export interface ClusterStatus {
  connected: boolean;
  nodes: { total: number; idle: number; allocated: number; down: number };
  queue: { pending: number; running: number };
  message?: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}
