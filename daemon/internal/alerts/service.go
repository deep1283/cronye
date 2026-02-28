package alerts

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/cronye/daemon/internal/jobs"
	"github.com/cronye/daemon/internal/runs"
	"github.com/cronye/daemon/internal/settings"
)

type Service struct {
	logger   *slog.Logger
	settings *settings.Repository
	client   *http.Client
}

func NewService(logger *slog.Logger, settingsRepo *settings.Repository) *Service {
	return &Service{
		logger:   logger,
		settings: settingsRepo,
		client: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

func (s *Service) NotifyTerminalFailure(ctx context.Context, job jobs.Record, run runs.Record) error {
	webhookURL, err := s.settings.Get(ctx, settings.KeyAlertWebhookURL)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		return err
	}

	webhookURL = strings.TrimSpace(webhookURL)
	if webhookURL == "" {
		return nil
	}

	payload := map[string]any{
		"event": "job_terminal_failure",
		"job": map[string]any{
			"id":       job.ID,
			"name":     job.Name,
			"type":     job.Type,
			"schedule": job.Schedule,
			"timezone": job.Timezone,
		},
		"run": map[string]any{
			"id":           run.ID,
			"job_id":       run.JobID,
			"status":       run.Status,
			"attempt":      run.Attempt,
			"scheduled_at": run.ScheduledAt,
			"started_at":   run.StartedAt,
			"finished_at":  run.FinishedAt,
			"exit_code":    run.ExitCode,
			"error_msg":    run.ErrorMsg,
			"output_tail":  run.OutputTail,
			"duration_ms":  run.DurationMS,
		},
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhookURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook status code %d", resp.StatusCode)
	}

	s.logger.Info("terminal failure alert sent", "job_id", job.ID, "run_id", run.ID)
	return nil
}
