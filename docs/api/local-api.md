# Local API Contract (MVP)

Base URL: `http://127.0.0.1:<port>`

Current implementation status:
- Implemented: `GET /health`, `GET /jobs`, `POST /jobs`, `GET /jobs/:id`, `PUT /jobs/:id`, `POST /jobs/:id/run`, `POST /jobs/:id/cancel-running`, `POST /jobs/:id/pause`, `POST /jobs/:id/resume`, `DELETE /jobs/:id`, `GET /jobs/:id/runs`, `GET /runs/:id`, `GET /runs/:id/output`, `POST /maintenance/purge`, `GET /storage/usage`, `PUT /settings/retention`, `GET /settings`, `PUT /settings/alerts`
- Planned: remaining endpoints in MVP contract

## Health

### `GET /health`
Returns daemon health and version.

Includes runtime components:
- `scheduler.running`
- `runner.running`
- `maintenance.running`

## Jobs

### `GET /jobs`
List jobs with status summary.

Response includes runtime fields:
- `next_run_at`
- `last_run` (id/status/finished_at/exit_code/duration_ms)

### `POST /jobs`
Create job.

Request body:
```json
{
  "name": "Nightly Backup",
  "type": "shell",
  "schedule": "0 2 * * *",
  "timezone": "Asia/Kolkata",
  "enabled": true,
  "payload": {
    "command": "./backup.sh"
  },
  "timeout_sec": 300,
  "retry_max": 3,
  "retry_backoff_sec": 10,
  "overlap_policy": "skip"
}
```

### `GET /jobs/:id`
Get one job.

### `PUT /jobs/:id`
Update job.

### `POST /jobs/:id/run`
Trigger immediate run.

### `POST /jobs/:id/cancel-running`
Best-effort cancel for currently running executions for the job.

### `POST /jobs/:id/pause`
Pause job schedule.

### `POST /jobs/:id/resume`
Resume job schedule.

### `DELETE /jobs/:id`
Delete job and associated future scheduling state.

## Runs

### `GET /jobs/:id/runs`
List runs for a job (newest first).

### `GET /runs/:id`
Get detailed run record.

### `GET /runs/:id/output`
Get full run output if stored; otherwise returns output tail.

## Maintenance

### `POST /maintenance/purge`
Purge run and log data.

Request body:
```json
{
  "older_than_days": 30,
  "success_only": true
}
```

Response includes:
- `deleted_runs`
- `deleted_output_files`
- `cap_deleted_output_files`
- `cap_freed_bytes`

### `GET /storage/usage`
Return storage usage summary and configured limits.

## Settings

### `PUT /settings/retention`
Set retention and disk-cap related settings.

Request body:
```json
{
  "retention_days": 30,
  "max_log_bytes": 1073741824,
  "global_concurrency": 1
}
```

Response also includes cap-enforcement result:
- `cap_deleted_output_files`
- `cap_freed_bytes`

### `GET /settings`
Get current retention, storage, concurrency, and alerts settings.

### `PUT /settings/alerts`
Set terminal failure webhook URL.

Request body:
```json
{
  "alert_webhook_url": "https://example.com/webhook"
}
```

## Status values

Run `status` enum:
- `queued`
- `running`
- `success`
- `failed`
- `cancelled`
- `timed_out`
- `skipped_overlap`
