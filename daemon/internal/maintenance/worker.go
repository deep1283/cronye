package maintenance

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/cronye/daemon/internal/settings"
)

type Worker struct {
	logger   *slog.Logger
	service  *Service
	settings *settings.Repository
	events   EventLogger

	interval      time.Duration
	vacuumEvery   time.Duration
	vacuumDeleted int64

	mu      sync.RWMutex
	running bool
	cancel  context.CancelFunc
	done    chan struct{}
}

type EventLogger interface {
	Log(ctx context.Context, level, category, message string, meta any) error
}

func NewWorker(logger *slog.Logger, service *Service, settingsRepo *settings.Repository, eventsLogger EventLogger) *Worker {
	return &Worker{
		logger:        logger,
		service:       service,
		settings:      settingsRepo,
		events:        eventsLogger,
		interval:      10 * time.Minute,
		vacuumEvery:   7 * 24 * time.Hour,
		vacuumDeleted: 10000,
	}
}

func (w *Worker) Start(context.Context) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.running {
		return nil
	}

	runCtx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	w.cancel = cancel
	w.done = done
	w.running = true

	go w.loop(runCtx, done)
	return nil
}

func (w *Worker) Stop(ctx context.Context) {
	w.mu.Lock()
	if !w.running {
		w.mu.Unlock()
		return
	}

	cancel := w.cancel
	done := w.done
	w.cancel = nil
	w.done = nil
	w.running = false
	w.mu.Unlock()

	cancel()
	select {
	case <-done:
	case <-ctx.Done():
	}
}

func (w *Worker) Running() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.running
}

func (w *Worker) loop(ctx context.Context, done chan struct{}) {
	defer close(done)
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	w.runCycle(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.runCycle(ctx)
		}
	}
}

func (w *Worker) runCycle(ctx context.Context) {
	maxLogBytes, err := w.settings.GetInt64(ctx, settings.KeyMaxLogBytes, 1_073_741_824)
	if err != nil {
		w.logger.Error("maintenance load max_log_bytes failed", "error", err)
		w.logEvent(ctx, "error", "maintenance", "load_max_log_bytes_failed", map[string]any{"error": err.Error()})
		return
	}

	capResult, err := w.service.EnforceOutputLogCap(ctx, maxLogBytes)
	if err != nil {
		w.logger.Error("maintenance cap enforcement failed", "error", err)
		w.logEvent(ctx, "error", "maintenance", "cap_enforcement_failed", map[string]any{"error": err.Error()})
		return
	}

	now := time.Now()
	shouldNightly, err := w.shouldRunNightly(ctx, now)
	if err != nil {
		w.logger.Error("maintenance nightly decision failed", "error", err)
		w.logEvent(ctx, "error", "maintenance", "nightly_decision_failed", map[string]any{"error": err.Error()})
		return
	}

	var purgeResult PurgeResult
	if shouldNightly {
		retentionDays, err := w.settings.GetInt(ctx, settings.KeyRetentionDays, 30)
		if err != nil {
			w.logger.Error("maintenance load retention_days failed", "error", err)
			w.logEvent(ctx, "error", "maintenance", "load_retention_days_failed", map[string]any{"error": err.Error()})
			return
		}

		purgeResult, err = w.service.PurgeRuns(ctx, retentionDays, false)
		if err != nil {
			w.logger.Error("maintenance nightly purge failed", "error", err)
			w.logEvent(ctx, "error", "maintenance", "nightly_purge_failed", map[string]any{"error": err.Error()})
			return
		}

		if err := w.settings.Upsert(ctx, settings.KeyMaintenanceLastRunAt, now.UTC().Format(time.RFC3339Nano)); err != nil {
			w.logger.Error("maintenance save last run failed", "error", err)
		}
	}

	if shouldNightly || capResult.DeletedOutputFiles > 0 || purgeResult.DeletedRuns > 0 {
		w.logger.Info("maintenance cycle completed",
			"nightly", shouldNightly,
			"deleted_runs", purgeResult.DeletedRuns,
			"deleted_output_files", purgeResult.DeletedOutputFiles,
			"cap_deleted_output_files", capResult.DeletedOutputFiles,
			"cap_freed_bytes", capResult.FreedBytes,
		)
		w.logEvent(ctx, "info", "maintenance", "cycle_completed", map[string]any{
			"nightly":                  shouldNightly,
			"deleted_runs":             purgeResult.DeletedRuns,
			"deleted_output_files":     purgeResult.DeletedOutputFiles,
			"cap_deleted_output_files": capResult.DeletedOutputFiles,
			"cap_freed_bytes":          capResult.FreedBytes,
		})
	}

	shouldVacuum, err := w.shouldVacuum(ctx, now, purgeResult.DeletedRuns)
	if err != nil {
		w.logger.Error("maintenance vacuum decision failed", "error", err)
		w.logEvent(ctx, "error", "maintenance", "vacuum_decision_failed", map[string]any{"error": err.Error()})
		return
	}
	if !shouldVacuum {
		return
	}

	if err := w.service.Vacuum(ctx); err != nil {
		w.logger.Error("maintenance vacuum failed", "error", err)
		w.logEvent(ctx, "error", "maintenance", "vacuum_failed", map[string]any{"error": err.Error()})
		return
	}
	if err := w.settings.Upsert(ctx, settings.KeyMaintenanceLastVacuumAt, now.UTC().Format(time.RFC3339Nano)); err != nil {
		w.logger.Error("maintenance save last vacuum failed", "error", err)
	}
	w.logger.Info("maintenance vacuum completed")
	w.logEvent(ctx, "info", "maintenance", "vacuum_completed", nil)
}

func (w *Worker) shouldRunNightly(ctx context.Context, now time.Time) (bool, error) {
	lastRunRaw, err := w.settings.Get(ctx, settings.KeyMaintenanceLastRunAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return true, nil
		}
		return false, err
	}

	lastRunAt, err := time.Parse(time.RFC3339Nano, lastRunRaw)
	if err != nil {
		return true, nil
	}

	y1, m1, d1 := now.Date()
	y2, m2, d2 := lastRunAt.Local().Date()
	return y1 != y2 || m1 != m2 || d1 != d2, nil
}

func (w *Worker) shouldVacuum(ctx context.Context, now time.Time, deletedRuns int64) (bool, error) {
	if deletedRuns >= w.vacuumDeleted {
		return true, nil
	}

	lastVacuumRaw, err := w.settings.Get(ctx, settings.KeyMaintenanceLastVacuumAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return true, nil
		}
		return false, err
	}

	lastVacuumAt, err := time.Parse(time.RFC3339Nano, lastVacuumRaw)
	if err != nil {
		return true, nil
	}

	return now.Sub(lastVacuumAt.Local()) >= w.vacuumEvery, nil
}

func (w *Worker) logEvent(ctx context.Context, level, category, message string, meta map[string]any) {
	if w.events == nil {
		return
	}
	if err := w.events.Log(ctx, level, category, message, meta); err != nil {
		w.logger.Error("event log write failed", "category", category, "message", message, "error", err)
	}
}
