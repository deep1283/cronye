# Delivery Plan (6 Weeks)

## Week 1 - Foundation

### Build
- Daemon skeleton and lifecycle management
- SQLite schema + migrations
- Scheduler bootstrap and job registration
- `GET /health`

### Verify
- Cold startup under 2 seconds
- DB opens in WAL mode
- Health endpoint reports scheduler and DB readiness

## Week 2 - Core Backend Behavior

### Build
- Job CRUD APIs
- Runner with timeout and overlap checks
- Run persistence model
- Retry engine with backoff+jitter

### Verify
- Create/update/delete/pause/resume run successfully via API
- Failed runs retry as configured
- Run history persists across restart

## Week 3 - Frontend MVP

### Build
- Jobs list and job editor
- Cron validation and timezone picker
- Run-now/pause/resume actions
- Basic run history view

### Verify
- Full job lifecycle from UI
- Error states are visible and actionable
- API and UI parity checks pass

## Week 4 - Retention and Alerts

### Build
- Retention and cleanup engine
- Storage usage API + dashboard
- Purge controls in UI
- Failed-run webhook notifications

### Verify
- Nightly cleanup removes expected data
- Log cap enforcement works under stress
- Webhook on terminal failure is delivered once

## Week 5 - Packaging and Cross-OS Readiness

### Build
- Service installers (launchd/systemd/windows service wrapper)
- Signed artifacts and checksums
- Cross-platform smoke scripts

### Verify
- Service autostart and crash recovery on all target OSes
- Install/uninstall scripts are idempotent

## Week 6 - Commercial and Launch

### Build
- Next.js landing page
- Stripe checkout for one-time `$39`
- License generation and activation UI
- Docs: install/troubleshooting/retention tuning

### Verify
- Payment -> license -> activation flow end-to-end
- Launch checklist all green
- Beta release candidate signed and published
