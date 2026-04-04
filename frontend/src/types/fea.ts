export type ConstraintType = 'fixed' | 'pinned' | 'roller' | 'symmetry' | 'displacement';
export type LoadType = 'force' | 'pressure' | 'gravity' | 'displacement';
export type AnalysisAxis = 'X' | 'Y' | 'Z';
export type SymmetryPlane = 'XY' | 'YZ' | 'XZ';

export interface FEAMaterial {
  preset: string;
  youngs_modulus: number;
  poissons_ratio: number;
  density: number;
  yield_strength?: number | null;
}

export interface FEAConstraint {
  id: string;
  type: ConstraintType;
  face_ids: string[];
  axis?: AnalysisAxis;
  plane?: SymmetryPlane;
  displacement?: {
    x: number | null;
    y: number | null;
    z: number | null;
  };
}

export interface FEALoad {
  id: string;
  type: LoadType;
  face_ids?: string[];
  magnitude?: number;
  direction?: { x: number; y: number; z: number };
  displacement?: {
    x: number | null;
    y: number | null;
    z: number | null;
  };
  g?: number;
}

export interface FEAArcSettings {
  job_name: string;
  partition: string;
  nodes: number;
  tasks_per_node: number;
  walltime: string;
}

export interface FEASubmitPayload {
  job_name: string;
  mesh_file_id: string;
  mesh_file_name?: string;
  material: FEAMaterial;
  constraints: Omit<FEAConstraint, 'id'>[];
  loads: Omit<FEALoad, 'id'>[];
  arc: FEAArcSettings;
}

export interface FEAJobSummary {
  max_displacement_mm: number;
  max_von_mises_stress_mpa: number;
  max_principal_stress_mpa: number;
  min_principal_stress_mpa: number;
  max_reaction_force_n: number;
  yielded: boolean | null;
  yield_strength_mpa: number | null;
  safety_factor: number | null;
}

export interface FEAOutputFile {
  name: string;
  url: string;
}

export interface FEAJob {
  id: string;
  user_id: string;
  job_name: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  slurm_job_id?: string | null;
  mesh_file_id: string;
  mesh_file_name?: string | null;
  material_json?: Record<string, unknown> | null;
  constraints_json?: Record<string, unknown>[] | null;
  loads_json?: Record<string, unknown>[] | null;
  arc_settings_json?: Record<string, unknown> | null;
  summary_json?: FEAJobSummary | null;
  output_files_json?: FEAOutputFile[] | null;
  cluster_workspace?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FEAJobListResponse {
  items: FEAJob[];
  total: number;
}
