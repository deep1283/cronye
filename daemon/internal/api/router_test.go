package api

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/cronye/daemon/internal/license"
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

type fakeLicenseControl struct {
	status license.Status
	err    error
}

func (f fakeLicenseControl) Status(_ context.Context) (license.Status, error) {
	return f.status, f.err
}

func (f fakeLicenseControl) Activate(_ context.Context, _ string) (license.Status, error) {
	return license.Status{}, nil
}

func (f fakeLicenseControl) Deactivate(_ context.Context) error {
	return nil
}

func TestRequireActiveLicenseMiddlewareBlocksProtectedRoutes(t *testing.T) {
	t.Parallel()

	deps := Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		License: fakeLicenseControl{
			status: license.Status{Active: false, Status: "missing", Message: "license_not_activated"},
		},
	}
	handler := requireActiveLicenseMiddleware(deps)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/jobs", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusPaymentRequired {
		t.Fatalf("expected status %d, got %d", http.StatusPaymentRequired, rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "license_required") {
		t.Fatalf("expected license_required body, got %s", rr.Body.String())
	}
}

func TestRequireActiveLicenseMiddlewareAllowsLicenseRoutes(t *testing.T) {
	t.Parallel()

	deps := Dependencies{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		License: fakeLicenseControl{
			status: license.Status{Active: false, Status: "missing", Message: "license_not_activated"},
		},
	}
	handler := requireActiveLicenseMiddleware(deps)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/license", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, rr.Code)
	}
}
