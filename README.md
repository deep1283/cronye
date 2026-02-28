# Cronye

Local-first cron automation product.

## Product Goal

Reliable automations on your own machine, without cloud lock-in.

## MVP Scope

- Cron scheduling
- Shell and webhook jobs
- Run logs, retries, retention, and cleanup controls
- Local web UI served from daemon
- Localhost API only by default

Non-goals in MVP:

- Drag-and-drop workflow builder
- Team collaboration
- Mobile runtime
- Deep AI agent features

## Architecture (MVP)

- Daemon: Go
- Scheduler: `robfig/cron/v3`
- API: `chi` on `127.0.0.1`
- Database: SQLite (WAL)
- UI: React + Vite + Tailwind (static assets served by daemon)
- Landing: Next.js (separate app)

## Repo Docs

- [Implementation blueprint](./docs/planning/implementation-blueprint.md)
- [MVP backlog](./docs/planning/mvp-backlog.md)
- [6-week delivery plan](./docs/planning/delivery-plan-6-weeks.md)
- [Launch checklist](./docs/ops/launch-checklist.md)
- [Local API contract](./docs/api/local-api.md)
- [SQLite schema](./docs/db/schema.sql)

## Repo Layout

- `daemon/` Go daemon and localhost API
- `ui/` local web app (planned)
- `landing/` Next.js marketing site (planned)
- `docs/` implementation and launch docs

## Getting Started (Daemon)

```bash
cd daemon
go run ./cmd/daemon
```

Then check:

```bash
curl http://127.0.0.1:9480/health
```

## Performance Targets

- Idle RAM: < 80 MB
- Idle CPU: < 1%
- Startup: < 2 seconds
- Disk growth: < 100 MB/month by default

## Pricing

- MVP: `$39` one-time (cron product only)
- AI add-on deferred to post-MVP (v1.1/v1.2)
