package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/cronye/daemon/internal/db"
	"github.com/cronye/daemon/internal/events"
	"github.com/cronye/daemon/internal/jobs"
	"github.com/cronye/daemon/internal/maintenance"
	"github.com/cronye/daemon/internal/runner"
	"github.com/cronye/daemon/internal/runs"
	"github.com/cronye/daemon/internal/scheduler"
	"github.com/cronye/daemon/internal/settings"
)

type integrationHarness struct {
	router http.Handler
	runner *runner.Service
	sched  *scheduler.Service
	store  *db.Store
	events *events.Repository
	ctx    context.Context
}

func setupIntegrationHarness(t *testing.T) *integrationHarness {
	t.Helper()

	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "integration.db")
	ctx := context.Background()

	store, err := db.OpenAndMigrate(ctx, dbPath)
	if err != nil {
		t.Fatalf("open and migrate db: %v", err)
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	jobRepo := jobs.NewRepository(store.DB)
	runRepo := runs.NewRepository(store.DB)
	settingsRepo := settings.NewRepository(store.DB)
	eventsRepo := events.NewRepository(store.DB)
	maintenanceSvc := maintenance.NewService(store.DB)

	sched := scheduler.NewService(
		logger.With("component", "scheduler"),
		jobRepo,
		func(ctx context.Context, jobID string, scheduledAt time.Time) error {
			_, err := runRepo.CreateQueued(ctx, jobID, scheduledAt)
			return err
		},
	)

	runnerSvc := runner.NewService(
		logger.With("component", "runner"),
		jobRepo,
		runRepo,
		nil,
		eventsRepo,
		filepath.Join(tempDir, "run-outputs"),
	)

	if err := sched.Start(ctx); err != nil {
		t.Fatalf("start scheduler: %v", err)
	}
	if err := runnerSvc.Start(ctx); err != nil {
		t.Fatalf("start runner: %v", err)
	}

	router := NewRouter(Dependencies{
		Logger:      logger.With("component", "api"),
		Store:       store,
		Jobs:        jobRepo,
		Runs:        runRepo,
		Maintenance: maintenanceSvc,
		Runner:      runnerSvc,
		Settings:    settingsRepo,
		Events:      eventsRepo,
		Scheduler:   sched,
		StartedAt:   time.Now().UTC(),
	})
	t.Cleanup(func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		runnerSvc.Stop(stopCtx)
		sched.Stop(stopCtx)
		_ = store.Close()
	})

	return &integrationHarness{
		router: router,
		runner: runnerSvc,
		sched:  sched,
		store:  store,
		events: eventsRepo,
		ctx:    ctx,
	}
}

func TestIntegrationRunExecutionEndpoint(t *testing.T) {
	t.Parallel()
	h := setupIntegrationHarness(t)

	createResp := requestJSON(t, h.router, http.MethodPost, "/jobs", map[string]any{
		"name":              "Run Success",
		"type":              "shell",
		"schedule":          "*/20 * * * *",
		"timezone":          "UTC",
		"enabled":           true,
		"payload":           map[string]any{"command": "echo integration-success"},
		"timeout_sec":       10,
		"retry_max":         0,
		"retry_backoff_sec": 1,
		"overlap_policy":    "skip",
	}, http.StatusCreated)
	jobID := mustString(t, createResp["id"])

	runResp := requestJSON(t, h.router, http.MethodPost, "/jobs/"+jobID+"/run", nil, http.StatusAccepted)
	runID := mustString(t, runResp["run_id"])

	run := waitForRunStatus(t, h.router, runID, []string{"success"}, 10*time.Second)
	if run["output_tail"] == nil || !strings.Contains(mustString(t, run["output_tail"]), "integration-success") {
		t.Fatalf("expected output_tail to contain integration-success, got %#v", run["output_tail"])
	}

	waitForEvent(t, h, 5*time.Second, func(record events.Record, meta map[string]any) bool {
		return record.Category == "job_run" &&
			record.Message == "run_started" &&
			mustStringFromMap(meta, "run_id") == runID
	})
	waitForEvent(t, h, 5*time.Second, func(record events.Record, meta map[string]any) bool {
		return record.Category == "job_run" &&
			record.Message == "run_finished" &&
			record.Level == "info" &&
			mustStringFromMap(meta, "run_id") == runID &&
			mustStringFromMap(meta, "status") == "success"
	})
}

func TestIntegrationRetryEndpoint(t *testing.T) {
	t.Parallel()
	h := setupIntegrationHarness(t)

	createResp := requestJSON(t, h.router, http.MethodPost, "/jobs", map[string]any{
		"name":              "Run Retry",
		"type":              "shell",
		"schedule":          "*/20 * * * *",
		"timezone":          "UTC",
		"enabled":           true,
		"payload":           map[string]any{"command": "echo retry-fail >&2; exit 2"},
		"timeout_sec":       10,
		"retry_max":         1,
		"retry_backoff_sec": 1,
		"overlap_policy":    "skip",
	}, http.StatusCreated)
	jobID := mustString(t, createResp["id"])

	runResp := requestJSON(t, h.router, http.MethodPost, "/jobs/"+jobID+"/run", nil, http.StatusAccepted)
	runID := mustString(t, runResp["run_id"])

	deadline := time.Now().Add(15 * time.Second)
	var lastStatuses []string
	for time.Now().Before(deadline) {
		runsResp := requestJSON(t, h.router, http.MethodGet, "/jobs/"+jobID+"/runs", nil, http.StatusOK)
		items := mustArray(t, runsResp["runs"])
		if len(items) >= 2 {
			attempts := map[int]bool{}
			lastStatuses = lastStatuses[:0]
			for _, item := range items {
				runMap := item.(map[string]any)
				status := mustString(t, runMap["status"])
				lastStatuses = append(lastStatuses, status)
				if status == "failed" {
					attempts[mustInt(t, runMap["attempt"])] = true
				}
			}
			if !attempts[0] || !attempts[1] {
				time.Sleep(300 * time.Millisecond)
				continue
			}
			waitForEvent(t, h, 5*time.Second, func(record events.Record, meta map[string]any) bool {
				return record.Category == "job_retry" &&
					record.Message == "retry_scheduled" &&
					mustStringFromMap(meta, "run_id") == runID
			})
			return
		}
		time.Sleep(300 * time.Millisecond)
	}

	t.Fatalf("timed out waiting for retry attempts to fail; last statuses: %#v", lastStatuses)
}

func TestIntegrationCancelRunningEndpoint(t *testing.T) {
	t.Parallel()
	h := setupIntegrationHarness(t)

	createResp := requestJSON(t, h.router, http.MethodPost, "/jobs", map[string]any{
		"name":              "Run Cancel",
		"type":              "shell",
		"schedule":          "*/20 * * * *",
		"timezone":          "UTC",
		"enabled":           true,
		"payload":           map[string]any{"command": "sleep 20"},
		"timeout_sec":       30,
		"retry_max":         0,
		"retry_backoff_sec": 1,
		"overlap_policy":    "skip",
	}, http.StatusCreated)
	jobID := mustString(t, createResp["id"])

	runResp := requestJSON(t, h.router, http.MethodPost, "/jobs/"+jobID+"/run", nil, http.StatusAccepted)
	runID := mustString(t, runResp["run_id"])

	waitForRunStatus(t, h.router, runID, []string{"running"}, 10*time.Second)

	cancelResp := requestJSON(t, h.router, http.MethodPost, "/jobs/"+jobID+"/cancel-running", nil, http.StatusOK)
	if mustInt(t, cancelResp["cancelled_runs"]) < 1 {
		t.Fatalf("expected at least one cancelled run")
	}

	waitForRunStatus(t, h.router, runID, []string{"cancelled"}, 15*time.Second)
	waitForEvent(t, h, 5*time.Second, func(record events.Record, meta map[string]any) bool {
		return record.Category == "job_run" &&
			record.Message == "cancel_running_requested" &&
			mustStringFromMap(meta, "job_id") == jobID
	})
}

func TestIntegrationLifecycleAndMaintenanceEvents(t *testing.T) {
	t.Parallel()
	h := setupIntegrationHarness(t)

	createResp := requestJSON(t, h.router, http.MethodPost, "/jobs", map[string]any{
		"name":              "Lifecycle Events",
		"type":              "shell",
		"schedule":          "*/20 * * * *",
		"timezone":          "UTC",
		"enabled":           true,
		"payload":           map[string]any{"command": "echo lifecycle"},
		"timeout_sec":       10,
		"retry_max":         0,
		"retry_backoff_sec": 1,
		"overlap_policy":    "skip",
	}, http.StatusCreated)
	jobID := mustString(t, createResp["id"])

	waitForEvent(t, h, 5*time.Second, func(record events.Record, meta map[string]any) bool {
		return record.Category == "job_lifecycle" &&
			record.Message == "job_created" &&
			mustStringFromMap(meta, "job_id") == jobID
	})

	requestJSON(t, h.router, http.MethodPut, "/jobs/"+jobID, map[string]any{
		"name":              "Lifecycle Events Updated",
		"type":              "shell",
		"schedule":          "*/15 * * * *",
		"timezone":          "UTC",
		"enabled":           true,
		"payload":           map[string]any{"command": "echo lifecycle-updated"},
		"timeout_sec":       10,
		"retry_max":         0,
		"retry_backoff_sec": 1,
		"overlap_policy":    "skip",
	}, http.StatusOK)
	requestJSON(t, h.router, http.MethodPost, "/jobs/"+jobID+"/pause", nil, http.StatusOK)
	requestJSON(t, h.router, http.MethodPost, "/jobs/"+jobID+"/resume", nil, http.StatusOK)
	requestJSON(t, h.router, http.MethodPost, "/maintenance/purge", map[string]any{
		"older_than_days": 1,
		"success_only":    false,
	}, http.StatusOK)
	requestJSON(t, h.router, http.MethodDelete, "/jobs/"+jobID, nil, http.StatusNoContent)

	waitForEvent(t, h, 5*time.Second, func(record events.Record, meta map[string]any) bool {
		return record.Category == "job_lifecycle" &&
			record.Message == "job_updated" &&
			mustStringFromMap(meta, "job_id") == jobID
	})
	waitForEvent(t, h, 5*time.Second, func(record events.Record, meta map[string]any) bool {
		return record.Category == "job_lifecycle" &&
			record.Message == "job_paused" &&
			mustStringFromMap(meta, "job_id") == jobID
	})
	waitForEvent(t, h, 5*time.Second, func(record events.Record, meta map[string]any) bool {
		return record.Category == "job_lifecycle" &&
			record.Message == "job_resumed" &&
			mustStringFromMap(meta, "job_id") == jobID
	})
	waitForEvent(t, h, 5*time.Second, func(record events.Record, meta map[string]any) bool {
		return record.Category == "maintenance" &&
			record.Message == "manual_purge_completed" &&
			mustIntFromMap(meta, "older_than_days") == 1
	})
	waitForEvent(t, h, 5*time.Second, func(record events.Record, meta map[string]any) bool {
		return record.Category == "job_lifecycle" &&
			record.Message == "job_deleted" &&
			mustStringFromMap(meta, "job_id") == jobID
	})
}

func waitForRunStatus(t *testing.T, router http.Handler, runID string, accepted []string, timeout time.Duration) map[string]any {
	t.Helper()

	acceptedSet := map[string]bool{}
	for _, status := range accepted {
		acceptedSet[status] = true
	}

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		runResp := requestJSON(t, router, http.MethodGet, "/runs/"+runID, nil, http.StatusOK)
		status := mustString(t, runResp["status"])
		if acceptedSet[status] {
			return runResp
		}
		time.Sleep(250 * time.Millisecond)
	}

	t.Fatalf("timed out waiting for run %s to reach one of statuses %#v", runID, accepted)
	return nil
}

func waitForEvent(t *testing.T, h *integrationHarness, timeout time.Duration, match func(events.Record, map[string]any) bool) events.Record {
	t.Helper()

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		items, err := h.events.ListRecent(h.ctx, 200)
		if err != nil {
			t.Fatalf("list recent events: %v", err)
		}
		for _, item := range items {
			meta := map[string]any{}
			if len(item.MetaJSON) > 0 {
				if err := json.Unmarshal(item.MetaJSON, &meta); err != nil {
					t.Fatalf("decode event meta json: %v", err)
				}
			}
			if match(item, meta) {
				return item
			}
		}
		time.Sleep(200 * time.Millisecond)
	}

	t.Fatalf("timed out waiting for matching event")
	return events.Record{}
}

func requestJSON(t *testing.T, router http.Handler, method, path string, body any, expectedStatus int) map[string]any {
	t.Helper()

	var reqBody io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request body: %v", err)
		}
		reqBody = bytes.NewReader(encoded)
	}

	req, err := http.NewRequest(method, path, reqBody)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	payload, err := io.ReadAll(recorder.Body)
	if err != nil {
		t.Fatalf("read response body: %v", err)
	}

	if recorder.Code != expectedStatus {
		t.Fatalf("unexpected status %d (expected %d), body: %s", recorder.Code, expectedStatus, string(payload))
	}

	if len(payload) == 0 {
		return map[string]any{}
	}

	var decoded map[string]any
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("decode response json: %v; payload: %s", err, string(payload))
	}
	return decoded
}

func mustString(t *testing.T, value any) string {
	t.Helper()
	str, ok := value.(string)
	if !ok {
		t.Fatalf("expected string, got %T (%v)", value, value)
	}
	return str
}

func mustInt(t *testing.T, value any) int {
	t.Helper()
	switch n := value.(type) {
	case float64:
		return int(n)
	case int:
		return n
	default:
		t.Fatalf("expected numeric type, got %T (%v)", value, value)
		return 0
	}
}

func mustArray(t *testing.T, value any) []any {
	t.Helper()
	arr, ok := value.([]any)
	if !ok {
		t.Fatalf("expected array, got %T (%v)", value, value)
	}
	return arr
}

func mustStringFromMap(m map[string]any, key string) string {
	value, ok := m[key]
	if !ok {
		return ""
	}
	str, ok := value.(string)
	if !ok {
		return ""
	}
	return str
}

func mustIntFromMap(m map[string]any, key string) int {
	value, ok := m[key]
	if !ok {
		return 0
	}
	switch n := value.(type) {
	case float64:
		return int(n)
	case int:
		return n
	default:
		return 0
	}
}
