export type JobType = "shell" | "http";
export type OverlapPolicy = "skip" | "allow";

export interface LastRun {
  id: string;
  status: string;
  finished_at?: string;
  exit_code?: number | null;
  duration_ms?: number | null;
}

export interface Job {
  id: string;
  name: string;
  type: JobType;
  schedule: string;
  timezone: string;
  enabled: boolean;
  payload_json: string;
  timeout_sec: number;
  retry_max: number;
  retry_backoff_sec: number;
  overlap_policy: OverlapPolicy;
  created_at: string;
  updated_at: string;
  next_run_at?: string | null;
  last_run?: LastRun | null;
}

export interface Run {
  id: string;
  job_id: string;
  scheduled_at: string;
  started_at?: string;
  finished_at?: string;
  status: string;
  attempt: number;
  exit_code?: number | null;
  error_msg?: string;
  output_path?: string;
  output_tail?: string;
  duration_ms?: number | null;
  created_at: string;
  updated_at: string;
}

export interface StorageUsage {
  db_bytes: number;
  run_output_bytes: number;
  total_bytes: number;
  retention_days: number;
  max_log_bytes: number;
}

export interface Settings {
  retention_days: number;
  max_log_bytes: number;
  global_concurrency: 1 | 2;
  alert_webhook_url: string;
  startup_catchup?: {
    last_run_at?: string;
    window_start_at?: string;
    window_end_at?: string;
    jobs_scanned: number;
    runs_enqueued: number;
    skipped_existing: number;
    truncated_jobs: number;
  };
}

export interface RetentionPayload {
  retention_days: number;
  max_log_bytes: number;
  global_concurrency: 1 | 2;
}

export interface RetentionUpdateResult extends RetentionPayload {
  cap_deleted_output_files: number;
  cap_freed_bytes: number;
}

export interface PurgePayload {
  older_than_days: number;
  success_only: boolean;
}

export interface PurgeResult {
  deleted_runs: number;
  deleted_output_files: number;
  cap_deleted_output_files: number;
  cap_freed_bytes: number;
}

export interface RunNowResult {
  run_id: string;
  status: string;
}

export interface CancelRunningResult {
  cancelled_runs: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  uptime_sec: number;
}

export interface JobUpsertPayload {
  name: string;
  type: JobType;
  schedule: string;
  timezone: string;
  enabled: boolean;
  payload: Record<string, unknown>;
  timeout_sec: number;
  retry_max: number;
  retry_backoff_sec: number;
  overlap_policy: OverlapPolicy;
}
