# Daemon (Go)

Week 1 scope currently implemented:

- Daemon lifecycle with graceful shutdown
- SQLite bootstrap with WAL + migrations
- Scheduler bootstrap that registers enabled jobs
- Local API with `GET /health`
- Job APIs: `GET /jobs`, `POST /jobs`, `GET /jobs/:id`, `PUT /jobs/:id`, `POST /jobs/:id/run`, `POST /jobs/:id/cancel-running`, `POST /jobs/:id/pause`, `POST /jobs/:id/resume`, `DELETE /jobs/:id`
- Run APIs: `GET /jobs/:id/runs`, `GET /runs/:id`, `GET /runs/:id/output`
- Runner: executes queued shell/http runs with timeout + output tail capture
- Retry: exponential backoff with jitter (per-job `retry_max` / `retry_backoff_sec`)
- Failed-run full output is persisted to `var/run-outputs/` and linked via `output_path`
- Terminal failure webhook alerts configurable via `PUT /settings/alerts`
- Log cap enforcement deletes oldest persisted run output files when above `max_log_bytes`
- Maintenance APIs: `POST /maintenance/purge`, `GET /storage/usage`, `PUT /settings/retention`, `GET /settings`
- Automatic maintenance worker runs every 10 minutes:
  - nightly retention purge (once per local calendar day)
  - periodic log-cap enforcement
  - weekly `VACUUM` (or earlier after large deletions)

## Run locally

```bash
cd daemon
go run ./cmd/daemon
```

Optional environment variables:

- `CRONYE_ADDR` (default `127.0.0.1:9480`)
- `CRONYE_DATA_DIR` (default `var`)
- `CRONYE_DB_PATH` (default `<CRONYE_DATA_DIR>/cronye.db`)
