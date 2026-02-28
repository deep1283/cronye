# Local UI (React + Vite + Tailwind)

This is the local product UI.

- Framework: React + Vite + Tailwind
- API target: daemon on `http://127.0.0.1:9480`
- Dev proxy: `/api/*` -> daemon root endpoints

## Run

```bash
npm install
npm run dev
```

Open: `http://127.0.0.1:5173`

Daemon must be running separately:

```bash
cd ../daemon
go run ./cmd/daemon
```

Default daemon API: `http://127.0.0.1:9480`

If your daemon runs on another address, set:

```bash
VITE_DAEMON_URL=http://127.0.0.1:9490 npm run dev
```

## Build

```bash
npm run build
```

The generated `dist/` is served by daemon in local production mode.

## Implemented MVP screens

- Jobs list with quick actions (`run`, `pause/resume`, `delete`)
- Job editor (`shell` / `http`, cron, timezone, timeout, retry, overlap policy)
- Run history with status filter and output viewer
- Storage dashboard with purge controls
- Settings for retention/log cap/concurrency, alert webhook, and local license activation/status
