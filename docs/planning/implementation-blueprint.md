# Implementation Blueprint (MVP + Launch)

## 1. Product Definition

### Core Promise
Reliable automations on your own machine, no cloud lock-in.

### MVP Boundary
- Cron scheduling
- Shell and HTTP jobs
- Logs and run history
- Retries and failure notifications
- Retention and cleanup controls

### Non-Goals
- Workflow builder
- Collaboration/multi-user features
- Mobile runtime
- Advanced AI orchestration

### Commercial Model
- Initial plan: `$39` one-time license
- AI add-on deferred to post-MVP versions

## 2. Runtime Architecture

### Runtime Model
- One long-running daemon process
- One local browser UI
- UI communicates with daemon API over localhost

### Stack
- Backend: Go
- Scheduler: `robfig/cron/v3`
- HTTP API: `chi`
- Database: SQLite in WAL mode
- Runtime logs: structured rotating file logs
- UI: React + Vite + Tailwind, served as static assets by daemon
- Landing: separate Next.js app

## 3. Reliability and Performance SLOs (MVP)

- Idle RAM < 80 MB
- Idle CPU < 1%
- Cold startup < 2 seconds
- Default disk growth < 100 MB/month
- Overlap policy default: skip overlapping runs
- Default global concurrency: 1 worker (configurable to 2)

## 4. Core Functional Requirements

### Job Lifecycle
- Create, edit, pause, resume, delete
- Validate cron expression before save
- Support timezone per job

### Execution Types
- Shell command job
- HTTP request job

### Run Controls
- Manual run-now
- Cancel-running (best effort)

### Observability
- Last status and next run
- Run duration, exit code, output tail
- Run history with filters

### Failure Handling
- Retries with exponential backoff + jitter
- Webhook alert on terminal failure

### Data Lifecycle
- Retention days and max log cap
- Purge actions from UI and API

## 5. Security Defaults

- Bind API to `127.0.0.1`
- Optional local auth token for UI -> API
- No telemetry enabled by default
- Environment variable based secret usage
- Mask secrets in UI and logs
- Signed release binaries and checksums

## 6. OS Service Strategy

- macOS: `launchd` install/uninstall helpers
- Linux: `systemd` install/uninstall helpers
- Windows: service wrapper with auto-start
- Crash recovery with bounded restart retries

## 7. Storage and Cleanup Strategy

- Default retention: 30 days
- Full logs retained for failed runs
- Success runs keep only output tail by default
- Nightly maintenance job:
  - Purge rows older than retention window
  - Remove orphaned output files
  - Enforce total log cap oldest-first
- Weekly `VACUUM` or after large purge

## 8. Launch Artifacts

- Cross-OS installer/service setup docs
- End-to-end payment and license flow
- Install + troubleshooting documentation
- Retention tuning guide

## 9. Launch Gate (Hard Requirements)

- Installer works on macOS/Linux/Windows
- 1-minute cron reliability validated
- Disk cap enforcement validated
- Crash recovery validated
- Payment + activation flow validated
- Baseline docs published
