package maintenance

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/cronye/daemon/internal/db"
)

func TestEnforceOutputLogCapDeletesOldest(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := db.OpenAndMigrate(ctx, dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer store.Close()

	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err = store.DB.ExecContext(ctx, `INSERT INTO jobs (id, name, type, schedule, timezone, enabled, payload_json, timeout_sec, retry_max, retry_backoff_sec, overlap_policy, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"job_1", "Cap Test", "shell", "*/5 * * * *", "UTC", 1, `{"command":"echo"}`, 30, 0, 1, "skip", now, now,
	)
	if err != nil {
		t.Fatalf("insert job: %v", err)
	}

	oldPath := filepath.Join(tempDir, "old.log")
	newPath := filepath.Join(tempDir, "new.log")
	if err := os.WriteFile(oldPath, []byte("12345"), 0o644); err != nil {
		t.Fatalf("write old file: %v", err)
	}
	if err := os.WriteFile(newPath, []byte("1234"), 0o644); err != nil {
		t.Fatalf("write new file: %v", err)
	}

	oldTime := time.Now().UTC().Add(-2 * time.Hour).Format(time.RFC3339Nano)
	newTime := time.Now().UTC().Add(-1 * time.Hour).Format(time.RFC3339Nano)
	_, err = store.DB.ExecContext(ctx, `INSERT INTO job_runs (id, job_id, scheduled_at, started_at, finished_at, status, attempt, exit_code, output_path, output_tail, duration_ms, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"run_old", "job_1", oldTime, oldTime, oldTime, "failed", 0, 1, oldPath, "old", 10, oldTime, oldTime,
	)
	if err != nil {
		t.Fatalf("insert old run: %v", err)
	}
	_, err = store.DB.ExecContext(ctx, `INSERT INTO job_runs (id, job_id, scheduled_at, started_at, finished_at, status, attempt, exit_code, output_path, output_tail, duration_ms, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"run_new", "job_1", newTime, newTime, newTime, "failed", 0, 1, newPath, "new", 10, newTime, newTime,
	)
	if err != nil {
		t.Fatalf("insert new run: %v", err)
	}

	svc := NewService(store.DB)
	result, err := svc.EnforceOutputLogCap(ctx, 4)
	if err != nil {
		t.Fatalf("enforce log cap: %v", err)
	}

	if result.DeletedOutputFiles != 1 {
		t.Fatalf("expected 1 deleted file, got %d", result.DeletedOutputFiles)
	}
	if result.FreedBytes != 5 {
		t.Fatalf("expected 5 freed bytes, got %d", result.FreedBytes)
	}

	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Fatalf("expected old file to be deleted")
	}
	if _, err := os.Stat(newPath); err != nil {
		t.Fatalf("expected new file to remain: %v", err)
	}
}

func TestPurgeRunsDeletesOrphanedOutput(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := db.OpenAndMigrate(ctx, dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer store.Close()

	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err = store.DB.ExecContext(ctx, `INSERT INTO jobs (id, name, type, schedule, timezone, enabled, payload_json, timeout_sec, retry_max, retry_backoff_sec, overlap_policy, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"job_1", "Purge Test", "shell", "*/5 * * * *", "UTC", 1, `{"command":"echo"}`, 30, 0, 1, "skip", now, now,
	)
	if err != nil {
		t.Fatalf("insert job: %v", err)
	}

	outputPath := filepath.Join(tempDir, "purge.log")
	if err := os.WriteFile(outputPath, []byte("old"), 0o644); err != nil {
		t.Fatalf("write output file: %v", err)
	}

	oldTime := time.Now().UTC().AddDate(0, 0, -10).Format(time.RFC3339Nano)
	_, err = store.DB.ExecContext(ctx, `INSERT INTO job_runs (id, job_id, scheduled_at, started_at, finished_at, status, attempt, exit_code, output_path, output_tail, duration_ms, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"run_old", "job_1", oldTime, oldTime, oldTime, "failed", 0, 1, outputPath, "old", 10, oldTime, oldTime,
	)
	if err != nil {
		t.Fatalf("insert run: %v", err)
	}

	svc := NewService(store.DB)
	result, err := svc.PurgeRuns(ctx, 1, false)
	if err != nil {
		t.Fatalf("purge runs: %v", err)
	}

	if result.DeletedRuns != 1 {
		t.Fatalf("expected 1 deleted run, got %d", result.DeletedRuns)
	}
	if result.DeletedOutputFiles != 1 {
		t.Fatalf("expected 1 deleted output file, got %d", result.DeletedOutputFiles)
	}
	if _, err := os.Stat(outputPath); !os.IsNotExist(err) {
		t.Fatalf("expected output file to be deleted")
	}
}

func TestPurgeJobRunsKeepRecent(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := db.OpenAndMigrate(ctx, dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer store.Close()

	now := time.Now().UTC()
	nowRaw := now.Format(time.RFC3339Nano)
	_, err = store.DB.ExecContext(ctx, `INSERT INTO jobs (id, name, type, schedule, timezone, enabled, payload_json, timeout_sec, retry_max, retry_backoff_sec, overlap_policy, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"job_1", "Keep Recent Test", "shell", "*/5 * * * *", "UTC", 1, `{"command":"echo"}`, 30, 0, 1, "skip", nowRaw, nowRaw,
	)
	if err != nil {
		t.Fatalf("insert job: %v", err)
	}

	paths := []string{
		filepath.Join(tempDir, "run1.log"),
		filepath.Join(tempDir, "run2.log"),
		filepath.Join(tempDir, "run3.log"),
		filepath.Join(tempDir, "run4.log"),
	}
	for _, p := range paths {
		if err := os.WriteFile(p, []byte("x"), 0o644); err != nil {
			t.Fatalf("write output file: %v", err)
		}
	}

	for i := 0; i < 4; i++ {
		ts := now.Add(time.Duration(i) * time.Minute).Format(time.RFC3339Nano)
		_, err = store.DB.ExecContext(ctx, `INSERT INTO job_runs (id, job_id, scheduled_at, started_at, finished_at, status, attempt, exit_code, output_path, output_tail, duration_ms, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			fmt.Sprintf("run_%d", i), "job_1", ts, ts, ts, "success", 0, 0, paths[i], "ok", 10, ts, ts,
		)
		if err != nil {
			t.Fatalf("insert run: %v", err)
		}
	}

	svc := NewService(store.DB)
	result, err := svc.PurgeJobRunsKeepRecent(ctx, "job_1", 2, false)
	if err != nil {
		t.Fatalf("purge job runs: %v", err)
	}
	if result.DeletedRuns != 2 {
		t.Fatalf("expected 2 deleted runs, got %d", result.DeletedRuns)
	}

	var count int
	if err := store.DB.QueryRowContext(ctx, `SELECT COUNT(1) FROM job_runs WHERE job_id = ?`, "job_1").Scan(&count); err != nil {
		t.Fatalf("count runs: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 remaining runs, got %d", count)
	}
}

func TestDeleteRunByID(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := db.OpenAndMigrate(ctx, dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer store.Close()

	nowRaw := time.Now().UTC().Format(time.RFC3339Nano)
	_, err = store.DB.ExecContext(ctx, `INSERT INTO jobs (id, name, type, schedule, timezone, enabled, payload_json, timeout_sec, retry_max, retry_backoff_sec, overlap_policy, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"job_1", "Delete Run Test", "shell", "*/5 * * * *", "UTC", 1, `{"command":"echo"}`, 30, 0, 1, "skip", nowRaw, nowRaw,
	)
	if err != nil {
		t.Fatalf("insert job: %v", err)
	}

	outputPath := filepath.Join(tempDir, "run.log")
	if err := os.WriteFile(outputPath, []byte("sample-output"), 0o644); err != nil {
		t.Fatalf("write output file: %v", err)
	}

	_, err = store.DB.ExecContext(ctx, `INSERT INTO job_runs (id, job_id, scheduled_at, started_at, finished_at, status, attempt, exit_code, output_path, output_tail, duration_ms, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"run_1", "job_1", nowRaw, nowRaw, nowRaw, "success", 0, 0, outputPath, "ok", 10, nowRaw, nowRaw,
	)
	if err != nil {
		t.Fatalf("insert run: %v", err)
	}

	svc := NewService(store.DB)
	result, err := svc.DeleteRunByID(ctx, "run_1")
	if err != nil {
		t.Fatalf("delete run: %v", err)
	}
	if result.DeletedRuns != 1 {
		t.Fatalf("expected 1 deleted run, got %d", result.DeletedRuns)
	}
	if _, err := os.Stat(outputPath); !os.IsNotExist(err) {
		t.Fatalf("expected output file to be deleted")
	}

	var count int
	if err := store.DB.QueryRowContext(ctx, `SELECT COUNT(1) FROM job_runs WHERE id = ?`, "run_1").Scan(&count); err != nil {
		t.Fatalf("count run: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected run to be deleted")
	}
}
