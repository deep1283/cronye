# MVP Risk Register

## R1 - Cross-platform service complexity
- Risk: launchd/systemd/windows service parity delays release.
- Mitigation: define per-OS acceptance tests in week 2 and run weekly smoke checks from week 3 onward.

## R2 - Cron reliability drift under long-running load
- Risk: missed or duplicate triggers with process restarts.
- Mitigation: persist schedule events and startup recovery checks; run 72-hour soak tests.

## R3 - Unbounded log growth
- Risk: disk cap missed due to cleanup race conditions.
- Mitigation: nightly cleanup + immediate cap enforcement path + stress tests.

## R4 - License UX friction
- Risk: activation/offline checks block legitimate users.
- Mitigation: include grace window and clear status UI; test activation recovery flows.

## R5 - Shell execution safety
- Risk: injection and accidental destructive commands.
- Mitigation: explicit execution mode, avoid implicit shell interpolation, document warnings in UI.
