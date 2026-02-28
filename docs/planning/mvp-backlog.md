# MVP Backlog (Prioritized)

## P0 - Must Ship for Launch

### EPIC-1 Daemon Foundation
- Initialize daemon process lifecycle and graceful shutdown.
- Add health endpoint and startup diagnostics.
- Acceptance criteria:
  - `GET /health` returns `200` with daemon version and db status.
  - Daemon exits gracefully on SIGINT/SIGTERM.

### EPIC-2 Scheduler + Runner Core
- Load enabled jobs at startup and register schedules.
- Enqueue trigger events with scheduled timestamp.
- Worker executes jobs with timeout support.
- Acceptance criteria:
  - Enabled jobs trigger at expected timestamps.
  - Timeout marks run failed with reason.
  - Overlap policy `skip` is enforced.

### EPIC-3 Job CRUD API
- Implement full job CRUD and lifecycle actions.
- Add cron expression validation and timezone validation.
- Acceptance criteria:
  - Jobs are persisted and reloaded after restart.
  - Pause/resume affects scheduler registration without restart.

### EPIC-4 Run Tracking and Observability
- Persist run state transitions and output tails.
- Track status, duration, exit code, and attempts.
- Acceptance criteria:
  - `GET /jobs/:id/runs` returns newest-first history.
  - Run details include attempts and output tail.

### EPIC-5 Retries + Failure Alerts
- Exponential backoff with jitter.
- Terminal failure webhook notification.
- Acceptance criteria:
  - Retry count respects per-job max.
  - Final failure sends one webhook event.

### EPIC-6 Retention + Cleanup
- Nightly cleanup task for runs and log files.
- Manual purge APIs and storage usage endpoint.
- Acceptance criteria:
  - Old records/logs are removed according to settings.
  - Storage usage endpoint reflects post-cleanup state.

### EPIC-7 Frontend MVP (Local UI)
- Jobs list page with status and next run.
- Job editor with cron + timezone.
- Run history and output viewer.
- Storage dashboard and settings.
- Acceptance criteria:
  - User can create/edit/run/pause/resume/delete jobs from UI.
  - User can view run results and trigger purge actions.

### EPIC-8 Packaging + Services
- Install/uninstall scripts for macOS/Linux/Windows services.
- Signed binaries and checksums.
- Acceptance criteria:
  - Service auto-start works after install.
  - Recovery policy restarts daemon after crash.

### EPIC-9 Licensing + Checkout
- Dodo Payments one-time checkout for `$39`.
- License key generation and local activation flow.
- Acceptance criteria:
  - Purchase -> key generation -> activation works end-to-end.
  - Offline grace behavior and slot limits are enforced.

### EPIC-10 Landing Site
- Next.js marketing site with pricing and FAQ.
- Basic SEO metadata and FAQ structured data.
- Acceptance criteria:
  - Hero/features/performance/pricing/FAQ/CTA sections present.
  - OG metadata validated.

## P1 - Should Ship Soon After MVP

- Optional auth token hardening for localhost API.
- Better output viewer (search/copy/download).
- More detailed maintenance insights.
- Error/event timeline UI.

## P2 - Post-MVP

- AI add-on integration.
- Multi-worker advanced scheduling controls.
- Team features.
- Workflow builder.
