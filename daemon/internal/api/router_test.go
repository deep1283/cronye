package api

import (
	"encoding/json"
	"testing"
)

func TestValidateUpsertJobDefaults(t *testing.T) {
	t.Parallel()

	payload, err := json.Marshal(map[string]any{
		"command": "echo hello",
	})
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	out, err := validateUpsertJob(upsertJobRequest{
		Name:     "Test Job",
		Type:     "shell",
		Schedule: "*/5 * * * *",
		Timezone: "Asia/Kolkata",
		Payload:  payload,
	})
	if err != nil {
		t.Fatalf("validateUpsertJob returned error: %v", err)
	}

	if !out.Enabled {
		t.Fatalf("expected enabled default true")
	}
	if out.TimeoutSec != 300 {
		t.Fatalf("expected timeout default 300, got %d", out.TimeoutSec)
	}
	if out.RetryMax != 0 {
		t.Fatalf("expected retry_max default 0, got %d", out.RetryMax)
	}
	if out.RetryBackoff != 10 {
		t.Fatalf("expected retry_backoff default 10, got %d", out.RetryBackoff)
	}
	if out.OverlapPolicy != "skip" {
		t.Fatalf("expected overlap policy default skip, got %s", out.OverlapPolicy)
	}
}

func TestValidateUpsertJobInvalidSchedule(t *testing.T) {
	t.Parallel()

	payload, err := json.Marshal(map[string]any{
		"url": "https://example.com",
	})
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	_, err = validateUpsertJob(upsertJobRequest{
		Name:     "Bad Schedule",
		Type:     "http",
		Schedule: "invalid cron",
		Timezone: "Asia/Kolkata",
		Payload:  payload,
	})
	if err == nil {
		t.Fatalf("expected error for invalid schedule")
	}
	if err.Error() != "invalid_schedule" {
		t.Fatalf("expected invalid_schedule error, got %s", err.Error())
	}
}
