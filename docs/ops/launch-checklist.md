# Launch Readiness Checklist

## Build and Packaging

- [ ] Signed binaries generated for macOS/Linux/Windows
- [ ] Checksums generated and published
- [ ] Install and uninstall flows validated per OS
- [ ] Service autostart validated per OS

## Runtime Reliability

- [ ] 1-minute cron runs reliably over sustained test window
- [ ] Crash recovery confirmed with bounded restart behavior
- [ ] Timeout and cancel behavior validated
- [ ] Overlap policy behavior validated (`skip` default)

## Data and Storage

- [ ] Retention cleanup job executes nightly
- [ ] Disk cap enforcement works under stress
- [ ] Purge APIs and UI actions validated
- [ ] Weekly `VACUUM` behavior validated

## API and UI

- [ ] Job CRUD + run-now + pause/resume + delete tested end-to-end
- [ ] Run history and output tail display validated
- [ ] Storage dashboard reflects true usage
- [ ] Settings save/load behavior validated

## Commercial and Legal

- [ ] Dodo Payments one-time `$39` checkout live
- [ ] License generation and activation verified
- [ ] Offline grace period behavior validated
- [ ] EULA, refund policy, and support scope published

## Docs and Support

- [ ] Install guide published
- [ ] Troubleshooting guide published
- [ ] Retention tuning guide published
- [ ] FAQ published (always-on requirement, OS support, privacy)
