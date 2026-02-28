package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/cronye/daemon/internal/db"
	"github.com/cronye/daemon/internal/jobs"
	"github.com/cronye/daemon/internal/maintenance"
	"github.com/cronye/daemon/internal/runs"
	"github.com/cronye/daemon/internal/settings"
	"github.com/cronye/daemon/internal/version"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/robfig/cron/v3"
)

var cronParser = cron.NewParser(
	cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor,
)

type SchedulerInfo interface {
	RegisteredJobs() int
	Running() bool
	Reload(ctx context.Context) error
	NextRun(jobID string) (time.Time, bool)
}

type RunnerControl interface {
	CancelRunningByJob(jobID string) int
	Running() bool
}

type MaintenanceControl interface {
	Running() bool
}

type EventLogger interface {
	Log(ctx context.Context, level, category, message string, meta any) error
}

type Dependencies struct {
	Logger            *slog.Logger
	Store             *db.Store
	Jobs              *jobs.Repository
	Runs              *runs.Repository
	Maintenance       *maintenance.Service
	MaintenanceWorker MaintenanceControl
	Events            EventLogger
	Runner            RunnerControl
	Settings          *settings.Repository
	Scheduler         SchedulerInfo
	StartedAt         time.Time
}

type upsertJobRequest struct {
	Name            string          `json:"name"`
	Type            string          `json:"type"`
	Schedule        string          `json:"schedule"`
	Timezone        string          `json:"timezone"`
	Enabled         *bool           `json:"enabled"`
	Payload         json.RawMessage `json:"payload"`
	TimeoutSec      *int            `json:"timeout_sec"`
	RetryMax        *int            `json:"retry_max"`
	RetryBackoffSec *int            `json:"retry_backoff_sec"`
	OverlapPolicy   string          `json:"overlap_policy"`
}

type purgeRequest struct {
	OlderThanDays int  `json:"older_than_days"`
	SuccessOnly   bool `json:"success_only"`
}

type retentionRequest struct {
	RetentionDays     *int   `json:"retention_days"`
	MaxLogBytes       *int64 `json:"max_log_bytes"`
	GlobalConcurrency *int   `json:"global_concurrency"`
}

type alertsRequest struct {
	AlertWebhookURL string `json:"alert_webhook_url"`
}

func NewRouter(deps Dependencies) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 1*time.Second)
		defer cancel()

		dbStatus := "ok"
		statusCode := http.StatusOK
		if err := deps.Store.DB.PingContext(ctx); err != nil {
			dbStatus = "down"
			statusCode = http.StatusServiceUnavailable
			deps.Logger.Error("health check db ping failed", "error", err)
		}

		resp := map[string]any{
			"status": func() string {
				if dbStatus == "ok" {
					return "ok"
				}
				return "degraded"
			}(),
			"version":    version.BuildVersion,
			"started_at": deps.StartedAt.Format(time.RFC3339),
			"uptime_sec": int(time.Since(deps.StartedAt).Seconds()),
			"db": map[string]any{
				"status": dbStatus,
			},
			"scheduler": map[string]any{
				"running":         deps.Scheduler.Running(),
				"registered_jobs": deps.Scheduler.RegisteredJobs(),
			},
		}
		if deps.Runner != nil {
			resp["runner"] = map[string]any{
				"running": deps.Runner.Running(),
			}
		}
		if deps.MaintenanceWorker != nil {
			resp["maintenance"] = map[string]any{
				"running": deps.MaintenanceWorker.Running(),
			}
		}

		writeJSON(w, statusCode, resp)
	})

	r.Get("/jobs", func(w http.ResponseWriter, r *http.Request) {
		items, err := deps.Jobs.List(r.Context())
		if err != nil {
			deps.Logger.Error("list jobs failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		out := make([]map[string]any, 0, len(items))
		for _, item := range items {
			out = append(out, decorateJobWithRuntime(r.Context(), item, deps))
		}

		writeJSON(w, http.StatusOK, map[string]any{"jobs": out})
	})

	r.Post("/jobs", func(w http.ResponseWriter, r *http.Request) {
		var req upsertJobRequest
		if err := decodeJSON(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		jobInput, err := validateUpsertJob(req)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		item, err := deps.Jobs.Create(r.Context(), jobInput)
		if err != nil {
			deps.Logger.Error("create job failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		if err := reloadScheduler(r.Context(), deps.Scheduler); err != nil {
			deps.Logger.Error("scheduler reload failed after create", "job_id", item.ID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "scheduler_reload_failed"})
			return
		}

		emitEvent(r.Context(), deps, "info", "job_lifecycle", "job_created", map[string]any{
			"job_id": item.ID,
			"name":   item.Name,
			"type":   item.Type,
		})
		writeJSON(w, http.StatusCreated, item)
	})

	r.Get("/jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		jobID := chi.URLParam(r, "id")
		item, err := deps.Jobs.GetByID(r.Context(), jobID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "job_not_found"})
				return
			}
			deps.Logger.Error("get job failed", "job_id", jobID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		writeJSON(w, http.StatusOK, decorateJobWithRuntime(r.Context(), item, deps))
	})

	r.Put("/jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		jobID := chi.URLParam(r, "id")

		var req upsertJobRequest
		if err := decodeJSON(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		jobInput, err := validateUpsertJob(req)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		item, err := deps.Jobs.Update(r.Context(), jobID, jobInput)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "job_not_found"})
				return
			}
			deps.Logger.Error("update job failed", "job_id", jobID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		if err := reloadScheduler(r.Context(), deps.Scheduler); err != nil {
			deps.Logger.Error("scheduler reload failed after update", "job_id", item.ID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "scheduler_reload_failed"})
			return
		}

		emitEvent(r.Context(), deps, "info", "job_lifecycle", "job_updated", map[string]any{
			"job_id": item.ID,
		})
		writeJSON(w, http.StatusOK, item)
	})

	r.Post("/jobs/{id}/pause", func(w http.ResponseWriter, r *http.Request) {
		jobID := chi.URLParam(r, "id")
		item, err := deps.Jobs.SetEnabled(r.Context(), jobID, false)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "job_not_found"})
				return
			}
			deps.Logger.Error("pause job failed", "job_id", jobID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		if err := reloadScheduler(r.Context(), deps.Scheduler); err != nil {
			deps.Logger.Error("scheduler reload failed after pause", "job_id", item.ID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "scheduler_reload_failed"})
			return
		}

		emitEvent(r.Context(), deps, "info", "job_lifecycle", "job_paused", map[string]any{
			"job_id": item.ID,
		})
		writeJSON(w, http.StatusOK, item)
	})

	r.Post("/jobs/{id}/resume", func(w http.ResponseWriter, r *http.Request) {
		jobID := chi.URLParam(r, "id")
		item, err := deps.Jobs.SetEnabled(r.Context(), jobID, true)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "job_not_found"})
				return
			}
			deps.Logger.Error("resume job failed", "job_id", jobID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		if err := reloadScheduler(r.Context(), deps.Scheduler); err != nil {
			deps.Logger.Error("scheduler reload failed after resume", "job_id", item.ID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "scheduler_reload_failed"})
			return
		}

		emitEvent(r.Context(), deps, "info", "job_lifecycle", "job_resumed", map[string]any{
			"job_id": item.ID,
		})
		writeJSON(w, http.StatusOK, item)
	})

	r.Delete("/jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		jobID := chi.URLParam(r, "id")
		if err := deps.Jobs.Delete(r.Context(), jobID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "job_not_found"})
				return
			}
			deps.Logger.Error("delete job failed", "job_id", jobID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		if err := reloadScheduler(r.Context(), deps.Scheduler); err != nil {
			deps.Logger.Error("scheduler reload failed after delete", "job_id", jobID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "scheduler_reload_failed"})
			return
		}

		emitEvent(r.Context(), deps, "warn", "job_lifecycle", "job_deleted", map[string]any{
			"job_id": jobID,
		})
		w.WriteHeader(http.StatusNoContent)
	})

	r.Post("/jobs/{id}/run", func(w http.ResponseWriter, r *http.Request) {
		jobID := chi.URLParam(r, "id")
		_, err := deps.Jobs.GetByID(r.Context(), jobID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "job_not_found"})
				return
			}
			deps.Logger.Error("manual run lookup failed", "job_id", jobID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		runRecord, err := deps.Runs.CreateQueued(r.Context(), jobID, time.Now().UTC())
		if err != nil {
			deps.Logger.Error("manual run enqueue failed", "job_id", jobID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		emitEvent(r.Context(), deps, "info", "job_run", "manual_run_enqueued", map[string]any{
			"job_id": jobID,
			"run_id": runRecord.ID,
		})
		writeJSON(w, http.StatusAccepted, map[string]any{
			"run_id": runRecord.ID,
			"status": runRecord.Status,
		})
	})

	r.Post("/jobs/{id}/cancel-running", func(w http.ResponseWriter, r *http.Request) {
		jobID := chi.URLParam(r, "id")
		_, err := deps.Jobs.GetByID(r.Context(), jobID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "job_not_found"})
				return
			}
			deps.Logger.Error("cancel running job lookup failed", "job_id", jobID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		if deps.Runner == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "runner_unavailable"})
			return
		}

		cancelled := deps.Runner.CancelRunningByJob(jobID)
		emitEvent(r.Context(), deps, "warn", "job_run", "cancel_running_requested", map[string]any{
			"job_id":         jobID,
			"cancelled_runs": cancelled,
		})
		writeJSON(w, http.StatusOK, map[string]any{
			"cancelled_runs": cancelled,
		})
	})

	r.Get("/jobs/{id}/runs", func(w http.ResponseWriter, r *http.Request) {
		jobID := chi.URLParam(r, "id")
		_, err := deps.Jobs.GetByID(r.Context(), jobID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "job_not_found"})
				return
			}
			deps.Logger.Error("job runs lookup failed", "job_id", jobID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		items, err := deps.Runs.ListByJob(r.Context(), jobID)
		if err != nil {
			deps.Logger.Error("list runs failed", "job_id", jobID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"runs": items})
	})

	r.Get("/runs/{id}", func(w http.ResponseWriter, r *http.Request) {
		runID := chi.URLParam(r, "id")
		item, err := deps.Runs.GetByID(r.Context(), runID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "run_not_found"})
				return
			}
			deps.Logger.Error("get run failed", "run_id", runID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		writeJSON(w, http.StatusOK, item)
	})

	r.Get("/runs/{id}/output", func(w http.ResponseWriter, r *http.Request) {
		runID := chi.URLParam(r, "id")
		item, err := deps.Runs.GetByID(r.Context(), runID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "run_not_found"})
				return
			}
			deps.Logger.Error("get run output failed", "run_id", runID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		if item.OutputPath != "" {
			content, err := os.ReadFile(item.OutputPath)
			if err == nil {
				_, _ = w.Write(content)
				return
			}
		}
		_, _ = w.Write([]byte(item.OutputTail))
	})

	r.Get("/storage/usage", func(w http.ResponseWriter, r *http.Request) {
		retentionDays, err := deps.Settings.GetInt(r.Context(), settings.KeyRetentionDays, 30)
		if err != nil {
			deps.Logger.Error("read retention setting failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		maxLogBytes, err := deps.Settings.GetInt64(r.Context(), settings.KeyMaxLogBytes, 1_073_741_824)
		if err != nil {
			deps.Logger.Error("read max log setting failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		usage, err := deps.Maintenance.StorageUsage(r.Context(), retentionDays, maxLogBytes)
		if err != nil {
			deps.Logger.Error("get storage usage failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		writeJSON(w, http.StatusOK, usage)
	})

	r.Post("/maintenance/purge", func(w http.ResponseWriter, r *http.Request) {
		var req purgeRequest
		if err := decodeJSON(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		if req.OlderThanDays == 0 {
			req.OlderThanDays = 30
		}
		if req.OlderThanDays < 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "older_than_days_must_be_positive"})
			return
		}

		result, err := deps.Maintenance.PurgeRuns(r.Context(), req.OlderThanDays, req.SuccessOnly)
		if err != nil {
			deps.Logger.Error("purge maintenance failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		maxLogBytes, err := deps.Settings.GetInt64(r.Context(), settings.KeyMaxLogBytes, 1_073_741_824)
		if err != nil {
			deps.Logger.Error("load max log setting for purge failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}
		capResult, err := deps.Maintenance.EnforceOutputLogCap(r.Context(), maxLogBytes)
		if err != nil {
			deps.Logger.Error("log cap enforcement failed after purge", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		emitEvent(r.Context(), deps, "info", "maintenance", "manual_purge_completed", map[string]any{
			"older_than_days":          req.OlderThanDays,
			"success_only":             req.SuccessOnly,
			"deleted_runs":             result.DeletedRuns,
			"deleted_output_files":     result.DeletedOutputFiles,
			"cap_deleted_output_files": capResult.DeletedOutputFiles,
			"cap_freed_bytes":          capResult.FreedBytes,
		})
		writeJSON(w, http.StatusOK, map[string]any{
			"deleted_runs":             result.DeletedRuns,
			"deleted_output_files":     result.DeletedOutputFiles,
			"cap_deleted_output_files": capResult.DeletedOutputFiles,
			"cap_freed_bytes":          capResult.FreedBytes,
		})
	})

	r.Put("/settings/retention", func(w http.ResponseWriter, r *http.Request) {
		var req retentionRequest
		if err := decodeJSON(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		retentionDays, err := deps.Settings.GetInt(r.Context(), settings.KeyRetentionDays, 30)
		if err != nil {
			deps.Logger.Error("load retention setting failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}
		maxLogBytes, err := deps.Settings.GetInt64(r.Context(), settings.KeyMaxLogBytes, 1_073_741_824)
		if err != nil {
			deps.Logger.Error("load max log setting failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}
		globalConcurrency, err := deps.Settings.GetInt(r.Context(), settings.KeyGlobalConcurrency, 1)
		if err != nil {
			deps.Logger.Error("load global concurrency setting failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		if req.RetentionDays != nil {
			if *req.RetentionDays <= 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "retention_days_must_be_positive"})
				return
			}
			retentionDays = *req.RetentionDays
		}
		if req.MaxLogBytes != nil {
			if *req.MaxLogBytes <= 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "max_log_bytes_must_be_positive"})
				return
			}
			maxLogBytes = *req.MaxLogBytes
		}
		if req.GlobalConcurrency != nil {
			if *req.GlobalConcurrency <= 0 || *req.GlobalConcurrency > 2 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "global_concurrency_must_be_1_or_2"})
				return
			}
			globalConcurrency = *req.GlobalConcurrency
		}

		if err := deps.Settings.Upsert(r.Context(), settings.KeyRetentionDays, strconv.Itoa(retentionDays)); err != nil {
			deps.Logger.Error("save retention setting failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}
		if err := deps.Settings.Upsert(r.Context(), settings.KeyMaxLogBytes, strconv.FormatInt(maxLogBytes, 10)); err != nil {
			deps.Logger.Error("save max log setting failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}
		if err := deps.Settings.Upsert(r.Context(), settings.KeyGlobalConcurrency, strconv.Itoa(globalConcurrency)); err != nil {
			deps.Logger.Error("save global concurrency setting failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		capResult, err := deps.Maintenance.EnforceOutputLogCap(r.Context(), maxLogBytes)
		if err != nil {
			deps.Logger.Error("log cap enforcement failed after retention update", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		emitEvent(r.Context(), deps, "info", "settings", "retention_settings_updated", map[string]any{
			"retention_days":           retentionDays,
			"max_log_bytes":            maxLogBytes,
			"global_concurrency":       globalConcurrency,
			"cap_deleted_output_files": capResult.DeletedOutputFiles,
			"cap_freed_bytes":          capResult.FreedBytes,
		})
		writeJSON(w, http.StatusOK, map[string]any{
			"retention_days":           retentionDays,
			"max_log_bytes":            maxLogBytes,
			"global_concurrency":       globalConcurrency,
			"cap_deleted_output_files": capResult.DeletedOutputFiles,
			"cap_freed_bytes":          capResult.FreedBytes,
		})
	})

	r.Get("/settings", func(w http.ResponseWriter, r *http.Request) {
		retentionDays, err := deps.Settings.GetInt(r.Context(), settings.KeyRetentionDays, 30)
		if err != nil {
			deps.Logger.Error("load retention_days failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}
		maxLogBytes, err := deps.Settings.GetInt64(r.Context(), settings.KeyMaxLogBytes, 1_073_741_824)
		if err != nil {
			deps.Logger.Error("load max_log_bytes failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}
		globalConcurrency, err := deps.Settings.GetInt(r.Context(), settings.KeyGlobalConcurrency, 1)
		if err != nil {
			deps.Logger.Error("load global_concurrency failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}
		alertWebhookURL, err := deps.Settings.Get(r.Context(), settings.KeyAlertWebhookURL)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			deps.Logger.Error("load alert_webhook_url failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"retention_days":     retentionDays,
			"max_log_bytes":      maxLogBytes,
			"global_concurrency": globalConcurrency,
			"alert_webhook_url":  alertWebhookURL,
		})
	})

	r.Put("/settings/alerts", func(w http.ResponseWriter, r *http.Request) {
		var req alertsRequest
		if err := decodeJSON(r, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		url := strings.TrimSpace(req.AlertWebhookURL)
		if err := deps.Settings.Upsert(r.Context(), settings.KeyAlertWebhookURL, url); err != nil {
			deps.Logger.Error("save alert webhook setting failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
			return
		}

		emitEvent(r.Context(), deps, "info", "settings", "alerts_settings_updated", map[string]any{
			"alert_webhook_url": url,
		})
		writeJSON(w, http.StatusOK, map[string]any{
			"alert_webhook_url": url,
		})
	})

	return r
}

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return errors.New("invalid_json_body")
	}
	return nil
}

func validateUpsertJob(req upsertJobRequest) (jobs.CreateInput, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return jobs.CreateInput{}, errors.New("name_required")
	}

	jobType := strings.TrimSpace(req.Type)
	if jobType != "shell" && jobType != "http" {
		return jobs.CreateInput{}, errors.New("type_must_be_shell_or_http")
	}

	schedule := strings.TrimSpace(req.Schedule)
	if schedule == "" {
		return jobs.CreateInput{}, errors.New("schedule_required")
	}
	if _, err := cronParser.Parse(schedule); err != nil {
		return jobs.CreateInput{}, errors.New("invalid_schedule")
	}

	timezone := strings.TrimSpace(req.Timezone)
	if timezone == "" {
		return jobs.CreateInput{}, errors.New("timezone_required")
	}
	if _, err := time.LoadLocation(timezone); err != nil {
		return jobs.CreateInput{}, errors.New("invalid_timezone")
	}

	if len(req.Payload) == 0 || !json.Valid(req.Payload) {
		return jobs.CreateInput{}, errors.New("payload_must_be_valid_json")
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	timeoutSec := 300
	if req.TimeoutSec != nil {
		timeoutSec = *req.TimeoutSec
	}
	if timeoutSec <= 0 {
		return jobs.CreateInput{}, errors.New("timeout_sec_must_be_positive")
	}

	retryMax := 0
	if req.RetryMax != nil {
		retryMax = *req.RetryMax
	}
	if retryMax < 0 {
		return jobs.CreateInput{}, errors.New("retry_max_must_be_non_negative")
	}

	retryBackoff := 10
	if req.RetryBackoffSec != nil {
		retryBackoff = *req.RetryBackoffSec
	}
	if retryBackoff < 0 {
		return jobs.CreateInput{}, errors.New("retry_backoff_sec_must_be_non_negative")
	}

	overlapPolicy := strings.TrimSpace(req.OverlapPolicy)
	if overlapPolicy == "" {
		overlapPolicy = "skip"
	}
	if overlapPolicy != "skip" && overlapPolicy != "allow" {
		return jobs.CreateInput{}, errors.New("overlap_policy_must_be_skip_or_allow")
	}

	return jobs.CreateInput{
		Name:          name,
		Type:          jobType,
		Schedule:      schedule,
		Timezone:      timezone,
		Enabled:       enabled,
		PayloadJSON:   string(req.Payload),
		TimeoutSec:    timeoutSec,
		RetryMax:      retryMax,
		RetryBackoff:  retryBackoff,
		OverlapPolicy: overlapPolicy,
	}, nil
}

func reloadScheduler(ctx context.Context, sched SchedulerInfo) error {
	reloadCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return sched.Reload(reloadCtx)
}

func decorateJobWithRuntime(ctx context.Context, item jobs.Record, deps Dependencies) map[string]any {
	out := map[string]any{
		"id":                item.ID,
		"name":              item.Name,
		"type":              item.Type,
		"schedule":          item.Schedule,
		"timezone":          item.Timezone,
		"enabled":           item.Enabled,
		"payload_json":      item.PayloadJSON,
		"timeout_sec":       item.TimeoutSec,
		"retry_max":         item.RetryMax,
		"retry_backoff_sec": item.RetryBackoffSec,
		"overlap_policy":    item.OverlapPolicy,
		"created_at":        item.CreatedAt,
		"updated_at":        item.UpdatedAt,
	}

	if deps.Scheduler != nil {
		if nextRun, ok := deps.Scheduler.NextRun(item.ID); ok {
			out["next_run_at"] = nextRun.Format(time.RFC3339)
		} else {
			out["next_run_at"] = nil
		}
	}

	if deps.Runs != nil {
		if latestRun, err := deps.Runs.LatestByJob(ctx, item.ID); err == nil {
			out["last_run"] = map[string]any{
				"id":          latestRun.ID,
				"status":      latestRun.Status,
				"finished_at": latestRun.FinishedAt,
				"exit_code":   latestRun.ExitCode,
				"duration_ms": latestRun.DurationMS,
			}
		} else if errors.Is(err, sql.ErrNoRows) {
			out["last_run"] = nil
		}
	}

	return out
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func emitEvent(ctx context.Context, deps Dependencies, level, category, message string, meta map[string]any) {
	if deps.Events == nil {
		return
	}
	if err := deps.Events.Log(ctx, level, category, message, meta); err != nil {
		deps.Logger.Error("event log write failed", "category", category, "message", message, "error", err)
	}
}
