package app

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/cronye/daemon/internal/jobs"
	"github.com/cronye/daemon/internal/settings"
	"github.com/robfig/cron/v3"
)

const (
	schedulerHeartbeatInterval  = 30 * time.Second
	startupCatchupMaxRunsPerJob = 1000
)

var catchupCronParser = cron.NewParser(
	cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor,
)

func (a *App) runStartupCatchup(ctx context.Context, now time.Time) error {
	lastHeartbeat, ok, err := a.loadSchedulerHeartbeat(ctx)
	if err != nil {
		return err
	}
	if !ok {
		return a.persistSchedulerHeartbeat(ctx, now)
	}
	if !lastHeartbeat.Before(now) {
		return a.persistSchedulerHeartbeat(ctx, now)
	}

	enabledJobs, err := a.jobRepo.ListEnabled(ctx)
	if err != nil {
		return err
	}

	enqueuedTotal := 0
	skippedExistingTotal := 0
	truncatedJobs := 0

	for _, job := range enabledJobs {
		missed, truncated, err := missedRunTimes(job, lastHeartbeat, now, startupCatchupMaxRunsPerJob)
		if err != nil {
			return fmt.Errorf("compute startup catch-up window for job %s: %w", job.ID, err)
		}
		if truncated {
			truncatedJobs++
		}

		jobEnqueued := 0
		jobSkippedExisting := 0
		for _, scheduledAt := range missed {
			exists, err := a.runRepo.ExistsByJobAndScheduledAt(ctx, job.ID, scheduledAt)
			if err != nil {
				return fmt.Errorf("startup catch-up dedupe check failed for job %s at %s: %w", job.ID, scheduledAt.Format(time.RFC3339Nano), err)
			}
			if exists {
				jobSkippedExisting++
				continue
			}
			if _, err := a.runRepo.CreateQueued(ctx, job.ID, scheduledAt); err != nil {
				return fmt.Errorf("startup catch-up enqueue failed for job %s at %s: %w", job.ID, scheduledAt.Format(time.RFC3339Nano), err)
			}
			jobEnqueued++
		}

		enqueuedTotal += jobEnqueued
		skippedExistingTotal += jobSkippedExisting

		if jobEnqueued > 0 || jobSkippedExisting > 0 || truncated {
			a.logEvent(ctx, "info", "scheduler", "startup_catchup_job_replayed", map[string]any{
				"job_id":           job.ID,
				"job_name":         job.Name,
				"window_start":     lastHeartbeat.Format(time.RFC3339Nano),
				"window_end":       now.Format(time.RFC3339Nano),
				"missed_detected":  len(missed),
				"enqueued":         jobEnqueued,
				"skipped_existing": jobSkippedExisting,
				"truncated":        truncated,
				"max_runs_per_job": startupCatchupMaxRunsPerJob,
			})
		}
	}

	a.logEvent(ctx, "info", "scheduler", "startup_catchup_completed", map[string]any{
		"window_start":     lastHeartbeat.Format(time.RFC3339Nano),
		"window_end":       now.Format(time.RFC3339Nano),
		"jobs_scanned":     len(enabledJobs),
		"runs_enqueued":    enqueuedTotal,
		"skipped_existing": skippedExistingTotal,
		"errors":           0,
		"truncated_jobs":   truncatedJobs,
		"max_runs_per_job": startupCatchupMaxRunsPerJob,
	})

	return a.persistSchedulerHeartbeat(ctx, now)
}

func (a *App) loadSchedulerHeartbeat(ctx context.Context) (time.Time, bool, error) {
	raw, err := a.settingsRepo.Get(ctx, settings.KeySchedulerHeartbeatAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return time.Time{}, false, nil
		}
		return time.Time{}, false, err
	}

	parsed, err := time.Parse(time.RFC3339Nano, raw)
	if err != nil {
		a.logger.Warn("invalid scheduler heartbeat; resetting", "value", raw, "error", err)
		return time.Time{}, false, nil
	}
	return parsed.UTC(), true, nil
}

func (a *App) persistSchedulerHeartbeat(ctx context.Context, now time.Time) error {
	return a.settingsRepo.Upsert(ctx, settings.KeySchedulerHeartbeatAt, now.UTC().Format(time.RFC3339Nano))
}

func (a *App) startSchedulerHeartbeatLoop() {
	heartbeatCtx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})

	a.heartbeatCancel = cancel
	a.heartbeatDone = done

	go func() {
		defer close(done)

		ticker := time.NewTicker(schedulerHeartbeatInterval)
		defer ticker.Stop()

		for {
			select {
			case <-heartbeatCtx.Done():
				return
			case <-ticker.C:
				writeCtx, writeCancel := context.WithTimeout(context.Background(), 3*time.Second)
				err := a.persistSchedulerHeartbeat(writeCtx, time.Now().UTC())
				writeCancel()
				if err != nil {
					a.logger.Warn("scheduler heartbeat update failed", "error", err)
				}
			}
		}
	}()
}

func (a *App) stopSchedulerHeartbeatLoop(ctx context.Context) {
	cancel := a.heartbeatCancel
	done := a.heartbeatDone
	a.heartbeatCancel = nil
	a.heartbeatDone = nil

	if cancel == nil || done == nil {
		return
	}

	cancel()

	select {
	case <-done:
	case <-ctx.Done():
	}
}

func missedRunTimes(job jobs.ScheduleJob, windowStart, windowEnd time.Time, maxRuns int) ([]time.Time, bool, error) {
	if maxRuns <= 0 {
		return nil, false, fmt.Errorf("maxRuns must be positive")
	}
	if !windowStart.Before(windowEnd) {
		return nil, false, nil
	}

	loc, err := time.LoadLocation(job.Timezone)
	if err != nil {
		return nil, false, fmt.Errorf("load timezone %q: %w", job.Timezone, err)
	}

	schedule, err := catchupCronParser.Parse(job.Schedule)
	if err != nil {
		return nil, false, fmt.Errorf("parse schedule %q: %w", job.Schedule, err)
	}

	start := windowStart.In(loc)
	end := windowEnd.In(loc)

	times := make([]time.Time, 0, 8)
	next := schedule.Next(start)
	for !next.After(end) {
		if len(times) >= maxRuns {
			return times, true, nil
		}
		times = append(times, next.UTC())
		next = schedule.Next(next)
	}

	return times, false, nil
}

func (a *App) logEvent(ctx context.Context, level, category, message string, meta any) {
	if a.eventsRepo == nil {
		return
	}
	if err := a.eventsRepo.Log(ctx, level, category, message, meta); err != nil {
		a.logger.Debug("event log failed", "category", category, "message", message, "error", err)
	}
}
