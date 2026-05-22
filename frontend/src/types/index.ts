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

// SOP categories: aero / chassis / wheels / intake are local *sizings*;
// nearfield / farfield / rear_wing are local *refinement regions* (Kevin Full Car).
export type LocalSizingCategory =
  | 'aero'
  | 'chassis'
  | 'wheels'
  | 'intake'
  | 'nearfield'
  | 'farfield'
  | 'rear_wing';

export interface LocalSizingRegion {
  name: string;
  type: 'body_of_influence' | 'face_sizing';
  category?: LocalSizingCategory | null;
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

// Axis the car nose points along (informational only — enclosure is built in Discovery).
export type FlowAxis = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

// Documentation-only record of the enclosure the user built in Discovery.
// Fluent does NOT re-create this — the CAD already contains it.
export interface EnclosureConfig {
  back_mm: number;
  front_mm: number;
  top_mm: number;
  bottom_mm: number;
  left_mm: number;
  right_mm: number;
  flow_axis: FlowAxis;
}

export interface MeshQuality {
  surface_skewness_threshold: number;
  volume_orthogonal_quality_threshold: number;
  auto_improve: boolean;
}

export interface MeshConfig {
  local_sizing: LocalSizingRegion[];
  surface_mesh: SurfaceMeshConfig;
  volume_mesh: VolumeMeshConfig;
  wind_tunnel: WindTunnelConfig;
  enclosure: EnclosureConfig | null;
  mesh_quality: MeshQuality;
  geometry_unit: string;
  // Face labels applied in Discovery to the Parasolid export.
  // Passed to Fluent as OriginalZones so they survive meshing.
  original_zones: string[];
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
  curvature_correction: boolean;
}

// ── Boundary-condition primitives ──────────────────────────────────
// Mirrors backend/app/schemas/job.py exactly. Each BC list is independent;
// empty lists are skipped by the journal renderer.

export interface VelocityInletBC {
  zone_name: string;
  velocity: number;
  // Turbulent intensity in PERCENT (5.0 = 5%) — matches the Fluent TUI
  // "/define/.../velocity-inlet ... yes 5 10" form used in the specialist
  // script. Not the 0–1 fraction.
  turbulent_intensity_pct: number;
  turbulent_viscosity_ratio: number;
}

export interface PressureOutletBC {
  zone_name: string;
  gauge_pressure: number;
}

export interface TranslatingWallBC {
  zone_name: string;
  velocity_mps: number;
  direction_x: number;
  direction_y: number;
  direction_z: number;
}

export interface RotatingWallBC {
  zone_name: string;
  omega_rad_s: number;
  origin_x: number;
  origin_y: number;
  origin_z: number;
  axis_x: number;
  axis_y: number;
  axis_z: number;
}

export interface SlipWallBC {
  zone_name: string;
}

export interface StationaryWallBC {
  zone_name: string;
}

export interface SymmetryPlaneBC {
  zone_name: string;
}

export interface BoundaryConditions {
  velocity_inlets: VelocityInletBC[];
  pressure_outlets: PressureOutletBC[];
  translating_walls: TranslatingWallBC[];
  rotating_walls: RotatingWallBC[];
  slip_walls: SlipWallBC[];
  stationary_walls: StationaryWallBC[];
  symmetry_planes: SymmetryPlaneBC[];
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

export interface ReferenceValues {
  area_m2: number;
  length_m: number;
  velocity_mps: number;
}

export type InitializationMode = 'hybrid' | 'hybrid-absolute';

export interface SolverConfig {
  general: GeneralSolverConfig;
  turbulence: TurbulenceConfig;
  boundary_conditions: BoundaryConditions;
  solution_methods: SolutionMethods;
  convergence: ConvergenceConfig;
  data_export: DataExportConfig;
  reference_values: ReferenceValues;
  initialization: InitializationMode;
}

export type CfdMode = 'individual_part' | 'full_car';

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

export interface MeshSummary {
  id: string;
  name: string;
  status: MeshStatus;
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
  // Null for legacy combined-mode jobs; set for split-mode jobs that read an
  // existing mesh.cas.h5 from the referenced Mesh.
  mesh_id: string | null;
  mesh: MeshSummary | null;
  created_at: string;
}

// ── Mesh (split workflow Phase 1 — first-class artifact) ─────────────────────

export type MeshStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Mesh {
  id: string;
  user_id: string;
  geometry_id: string;
  group_id: string | null;
  name: string;
  status: MeshStatus;
  config: {
    cfd_mode: CfdMode;
    mesh: MeshConfig;
    slurm: SlurmConfig;
  } | null;
  config_hash: string;
  cell_count: number | null;
  meshing_minutes: number | null;
  case_file_s3_key: string | null;
  slurm_job_id: string | null;
  submitted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cluster_workspace: string | null;
  created_at: string;
  // Enrichments populated by the API
  geometry_name: string | null;
  group_name: string | null;
  owner_name: string | null;
  jobs_using_count: number | null;
}

export interface MeshListResponse {
  items: Mesh[];
  total: number;
}

export interface MeshCreateRequest {
  geometry_id: string;
  name: string;
  group_id?: string | null;
  cfd_mode: CfdMode;
  mesh_config: MeshConfig;
  slurm_config: SlurmConfig;
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
