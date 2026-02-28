# Daemon (Go)

Week 1 scope currently implemented:

- Daemon lifecycle with graceful shutdown
- SQLite bootstrap with WAL + migrations
- Scheduler bootstrap that registers enabled jobs
- Startup catch-up that replays missed cron windows since last scheduler heartbeat (deduped by `job_id + scheduled_at`)
- Local API with `GET /health`
- Job APIs: `GET /jobs`, `POST /jobs`, `GET /jobs/:id`, `PUT /jobs/:id`, `POST /jobs/:id/run`, `POST /jobs/:id/cancel-running`, `POST /jobs/:id/pause`, `POST /jobs/:id/resume`, `DELETE /jobs/:id`
- Run APIs: `GET /jobs/:id/runs`, `GET /runs/:id`, `GET /runs/:id/output`
- Runner: executes queued shell/http runs with timeout + output tail capture
- Retry: exponential backoff with jitter (per-job `retry_max` / `retry_backoff_sec`)
- Failed-run full output is persisted to `var/run-outputs/` and linked via `output_path`
- Terminal failure webhook alerts configurable via `PUT /settings/alerts`
- Log cap enforcement deletes oldest persisted run output files when above `max_log_bytes`
- Maintenance APIs: `POST /maintenance/purge`, `GET /storage/usage`, `PUT /settings/retention`, `GET /settings`
- License APIs: `GET /license`, `POST /license/activate`, `POST /license/deactivate`
- Automatic maintenance worker runs every 10 minutes:
  - nightly retention purge (once per local calendar day)
  - periodic log-cap enforcement
  - weekly `VACUUM` (or earlier after large deletions)
- Scheduler heartbeat persists every 30s to support downtime catch-up on restart

## Run locally

```bash
# from repo root, build local UI bundle first
cd ui && npm run build

# then run daemon
cd daemon
go run ./cmd/daemon
```

Then open:

- `http://127.0.0.1:9480` for the local UI (served by daemon)
- API is available at both root paths (`/health`, `/jobs`, etc.) and `/api/*` aliases (`/api/health`, `/api/jobs`, etc.)

Optional environment variables:

- `CRONYE_ADDR` (default `127.0.0.1:9480`)
- `CRONYE_DATA_DIR` (default `var`)
- `CRONYE_DB_PATH` (default `<CRONYE_DATA_DIR>/cronye.db`)
- `CRONYE_UI_DIST` (default `ui/dist`; daemon also tries `../ui/dist` fallback)
- `CRONYE_LICENSE_PUBLIC_KEY` (base64 encoded ed25519 public key for license verification)
- `CRONYE_LICENSE_ALLOW_UNSIGNED_DEV` (`true` for local dev-only unsigned tokens)
- `CRONYE_SERVICE_NAME` (default `cronye-daemon`)
- `CRONYE_SERVICE_LABEL` (default `com.cronye.daemon`)

## Release Bundle Runtime

When launched from a release bundle, daemon auto-detects UI files at:

- `<binary_dir>/ui/dist`
- `<binary_dir>/../ui/dist`

So the bundled `ui/dist` works without extra flags.

## Service Installers

Install as OS service:

```bash
./cronye-daemon service install
```

Uninstall service:

```bash
./cronye-daemon service uninstall
```

Notes:
- Use the built binary for service install/uninstall (not `go run`).
- macOS uses user LaunchAgents (`~/Library/LaunchAgents/<label>.plist`)
- Linux uses `systemd` and requires root privileges
- Windows uses `sc.exe` service commands

## License Key Generation (Issuer Side)

Generate a signed key using an ed25519 PKCS8 private key:

```bash
go run ./cmd/licensegen \
  --private-key /abs/path/license-private.pem \
  --email customer@example.com \
  --plan lifetime \
  --device-limit 1
```

Output is a license key token for `/license/activate`.
