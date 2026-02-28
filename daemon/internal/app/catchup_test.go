package app

import (
	"context"
	"io"
	"log/slog"
	"path/filepath"
	"sort"
	"testing"
	"time"

	"github.com/cronye/daemon/internal/db"
	"github.com/cronye/daemon/internal/events"
	"github.com/cronye/daemon/internal/jobs"
	"github.com/cronye/daemon/internal/runs"
	"github.com/cronye/daemon/internal/settings"
)

func TestMissedRunTimesMinuteSchedule(t *testing.T) {
	t.Parallel()

	job := jobs.ScheduleJob{
		ID:       "job_1",
		Name:     "Test Job",
		Schedule: "* * * * *",
		Timezone: "UTC",
	}

	start := time.Date(2026, 2, 28, 10, 0, 0, 0, time.UTC)
	end := time.Date(2026, 2, 28, 10, 3, 30, 0, time.UTC)

	missed, truncated, err := missedRunTimes(job, start, end, 100)
	if err != nil {
		t.Fatalf("missedRunTimes returned error: %v", err)
	}
	if truncated {
		t.Fatalf("expected no truncation")
	}
	if len(missed) != 3 {
		t.Fatalf("expected 3 missed run times, got %d", len(missed))
	}
	want := []string{
		"2026-02-28T10:01:00Z",
		"2026-02-28T10:02:00Z",
		"2026-02-28T10:03:00Z",
	}
	for i, scheduledAt := range missed {
		if scheduledAt.Format(time.RFC3339) != want[i] {
			t.Fatalf("unexpected missed[%d]: got %s want %s", i, scheduledAt.Format(time.RFC3339), want[i])
		}
	}
}

func TestRunStartupCatchupEnqueuesMissingOnly(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	tempDir := t.TempDir()
	store, err := db.OpenAndMigrate(ctx, filepath.Join(tempDir, "catchup.db"))
	if err != nil {
		t.Fatalf("open and migrate db: %v", err)
	}
	defer store.Close()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	jobRepo := jobs.NewRepository(store.DB)
	runRepo := runs.NewRepository(store.DB)
	settingsRepo := settings.NewRepository(store.DB)
	eventsRepo := events.NewRepository(store.DB)

	created, err := jobRepo.Create(ctx, jobs.CreateInput{
		Name:          "Catchup Job",
		Type:          "shell",
		Schedule:      "* * * * *",
		Timezone:      "UTC",
		Enabled:       true,
		PayloadJSON:   `{"command":"echo ok"}`,
		TimeoutSec:    30,
		RetryMax:      0,
		RetryBackoff:  1,
		OverlapPolicy: "skip",
	})
	if err != nil {
		t.Fatalf("create job: %v", err)
	}

	windowStart := time.Date(2026, 2, 28, 10, 0, 0, 0, time.UTC)
	windowEnd := time.Date(2026, 2, 28, 10, 3, 30, 0, time.UTC)
	if err := settingsRepo.Upsert(ctx, settings.KeySchedulerHeartbeatAt, windowStart.Format(time.RFC3339Nano)); err != nil {
		t.Fatalf("set scheduler heartbeat: %v", err)
	}

	if _, err := runRepo.CreateQueued(ctx, created.ID, time.Date(2026, 2, 28, 10, 1, 0, 0, time.UTC)); err != nil {
		t.Fatalf("create existing queued run: %v", err)
	}

	application := &App{
		logger:       logger,
		jobRepo:      jobRepo,
		runRepo:      runRepo,
		settingsRepo: settingsRepo,
		eventsRepo:   eventsRepo,
	}

	if err := application.runStartupCatchup(ctx, windowEnd); err != nil {
		t.Fatalf("runStartupCatchup returned error: %v", err)
	}

	items, err := runRepo.ListByJob(ctx, created.ID)
	if err != nil {
		t.Fatalf("list runs: %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("expected 3 total runs after catch-up, got %d", len(items))
	}

	gotTimes := make([]string, 0, len(items))
	for _, item := range items {
		gotTimes = append(gotTimes, item.ScheduledAt)
		if item.Status != "queued" {
			t.Fatalf("expected queued status, got %s", item.Status)
		}
	}
	sort.Strings(gotTimes)
	wantTimes := []string{
		"2026-02-28T10:01:00Z",
		"2026-02-28T10:02:00Z",
		"2026-02-28T10:03:00Z",
	}
	for i := range wantTimes {
		if gotTimes[i] != wantTimes[i] {
			t.Fatalf("unexpected scheduled_at at index %d: got %s want %s", i, gotTimes[i], wantTimes[i])
		}
	}

	heartbeat, err := settingsRepo.Get(ctx, settings.KeySchedulerHeartbeatAt)
	if err != nil {
		t.Fatalf("get scheduler heartbeat: %v", err)
	}
	if heartbeat != windowEnd.Format(time.RFC3339Nano) {
		t.Fatalf("unexpected heartbeat value: got %s want %s", heartbeat, windowEnd.Format(time.RFC3339Nano))
	}

	eventRecords, err := eventsRepo.ListRecent(ctx, 20)
	if err != nil {
		t.Fatalf("list events: %v", err)
	}
	foundSummary := false
	for _, record := range eventRecords {
		if record.Category == "scheduler" && record.Message == "startup_catchup_completed" {
			foundSummary = true
			break
		}
	}
	if !foundSummary {
		t.Fatalf("expected startup_catchup_completed event")
	}
}
