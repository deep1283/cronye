package runner

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/rand"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/cronye/daemon/internal/jobs"
	"github.com/cronye/daemon/internal/runs"
)

const (
	statusSuccess        = "success"
	statusFailed         = "failed"
	statusTimedOut       = "timed_out"
	statusCancelled      = "cancelled"
	statusSkippedOverlap = "skipped_overlap"
)

type JobRepository interface {
	GetByID(ctx context.Context, id string) (jobs.Record, error)
}

type RunRepository interface {
	ClaimNextDue(ctx context.Context) (runs.Record, error)
	MarkFinished(ctx context.Context, id, status string, exitCode *int, errorMsg, outputPath, outputTail string, durationMS int64) error
	CreateQueuedWithAttempt(ctx context.Context, jobID string, scheduledAt time.Time, attempt int) (runs.Record, error)
	GetByID(ctx context.Context, id string) (runs.Record, error)
}

type FailureNotifier interface {
	NotifyTerminalFailure(ctx context.Context, job jobs.Record, run runs.Record) error
}

type EventLogger interface {
	Log(ctx context.Context, level, category, message string, meta any) error
}

type Service struct {
	logger   *slog.Logger
	jobs     JobRepository
	runs     RunRepository
	notifier FailureNotifier
	events   EventLogger

	outputDir string

	pollInterval time.Duration
	rand         *rand.Rand
	workerCount  int

	mu      sync.RWMutex
	running bool
	cancel  context.CancelFunc
	done    chan struct{}

	activeMu      sync.Mutex
	activeCancels map[string]context.CancelFunc
	activeRunJobs map[string]string
}

func NewService(
	logger *slog.Logger,
	jobsRepo JobRepository,
	runsRepo RunRepository,
	notifier FailureNotifier,
	eventsLogger EventLogger,
	outputDir string,
	workerCount int,
) *Service {
	if workerCount < 1 {
		workerCount = 1
	}
	return &Service{
		logger:        logger,
		jobs:          jobsRepo,
		runs:          runsRepo,
		notifier:      notifier,
		events:        eventsLogger,
		outputDir:     outputDir,
		pollInterval:  1 * time.Second,
		rand:          rand.New(rand.NewSource(time.Now().UnixNano())),
		workerCount:   workerCount,
		activeCancels: make(map[string]context.CancelFunc),
		activeRunJobs: make(map[string]string),
	}
}

func (s *Service) Start(context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return nil
	}

	runCtx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	s.cancel = cancel
	s.done = done
	s.running = true

	go s.loop(runCtx, done)
	return nil
}

func (s *Service) Stop(ctx context.Context) {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return
	}

	cancel := s.cancel
	done := s.done
	s.running = false
	s.cancel = nil
	s.done = nil
	s.mu.Unlock()

	cancel()

	select {
	case <-done:
	case <-ctx.Done():
	}
}

func (s *Service) Running() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.running
}

func (s *Service) WorkerCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.workerCount
}

func (s *Service) CancelRunningByJob(jobID string) int {
	s.activeMu.Lock()
	var runIDs []string
	var cancels []context.CancelFunc
	for runID, mappedJobID := range s.activeRunJobs {
		if mappedJobID != jobID {
			continue
		}
		runIDs = append(runIDs, runID)
		cancels = append(cancels, s.activeCancels[runID])
	}
	for _, runID := range runIDs {
		delete(s.activeRunJobs, runID)
		delete(s.activeCancels, runID)
	}
	s.activeMu.Unlock()

	for _, cancel := range cancels {
		cancel()
	}
	return len(cancels)
}

func (s *Service) loop(ctx context.Context, done chan struct{}) {
	defer close(done)

	var wg sync.WaitGroup
	for i := 0; i < s.workerCount; i++ {
		wg.Add(1)
		go s.worker(ctx, &wg)
	}
	wg.Wait()
}

func (s *Service) worker(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()
	ticker := time.NewTicker(s.pollInterval)
	defer ticker.Stop()

	for {
		processed, err := s.processOne(ctx)
		if err != nil {
			s.logger.Error("runner process failed", "error", err)
		}
		if processed {
			continue
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *Service) processOne(ctx context.Context) (bool, error) {
	claimCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	runRecord, err := s.runs.ClaimNextDue(claimCtx)
	if err != nil {
		if errors.Is(err, runs.ErrNoQueuedRuns) {
			return false, nil
		}
		return false, err
	}

	startedAt := time.Now().UTC()
	if runRecord.StartedAt != "" {
		if parsed, parseErr := time.Parse(time.RFC3339Nano, runRecord.StartedAt); parseErr == nil {
			startedAt = parsed
		}
	}

	job, err := s.jobs.GetByID(ctx, runRecord.JobID)
	if err != nil {
		duration := time.Since(startedAt).Milliseconds()
		_ = s.runs.MarkFinished(ctx, runRecord.ID, statusFailed, nil, "job_not_found", "", "", duration)
		s.logEvent(ctx, "error", "job_run", "run_finished", map[string]any{
			"run_id":       runRecord.ID,
			"job_id":       runRecord.JobID,
			"status":       statusFailed,
			"attempt":      runRecord.Attempt,
			"duration_ms":  duration,
			"error_msg":    "job_not_found",
			"scheduled_at": runRecord.ScheduledAt,
		})
		return true, nil
	}

	if !job.Enabled {
		duration := time.Since(startedAt).Milliseconds()
		_ = s.runs.MarkFinished(ctx, runRecord.ID, statusCancelled, nil, "job_disabled", "", "", duration)
		s.logEvent(ctx, "warn", "job_run", "run_finished", map[string]any{
			"run_id":       runRecord.ID,
			"job_id":       runRecord.JobID,
			"status":       statusCancelled,
			"attempt":      runRecord.Attempt,
			"duration_ms":  duration,
			"error_msg":    "job_disabled",
			"scheduled_at": runRecord.ScheduledAt,
		})
		return true, nil
	}

	s.logEvent(ctx, "info", "job_run", "run_started", map[string]any{
		"run_id":       runRecord.ID,
		"job_id":       runRecord.JobID,
		"attempt":      runRecord.Attempt,
		"scheduled_at": runRecord.ScheduledAt,
	})

	execCtx, execCancel := context.WithCancel(ctx)
	if !s.markActive(runRecord.ID, runRecord.JobID, execCancel, job.OverlapPolicy) {
		execCancel()
		duration := time.Since(startedAt).Milliseconds()
		_ = s.runs.MarkFinished(ctx, runRecord.ID, statusSkippedOverlap, nil, "overlap_skipped", "", "", duration)
		s.logEvent(ctx, "warn", "job_run", "run_finished", map[string]any{
			"run_id":       runRecord.ID,
			"job_id":       runRecord.JobID,
			"status":       statusSkippedOverlap,
			"attempt":      runRecord.Attempt,
			"duration_ms":  duration,
			"error_msg":    "overlap_skipped",
			"scheduled_at": runRecord.ScheduledAt,
		})
		return true, nil
	}
	result := s.execute(execCtx, runRecord.ID, job)
	s.clearActive(runRecord.ID)
	durationMS := time.Since(startedAt).Milliseconds()

	if err := s.runs.MarkFinished(
		ctx,
		runRecord.ID,
		result.status,
		result.exitCode,
		result.errorMsg,
		result.outputPath,
		result.outputTail,
		durationMS,
	); err != nil {
		return true, err
	}

	s.logEvent(ctx, levelForRunStatus(result.status), "job_run", "run_finished", map[string]any{
		"run_id":       runRecord.ID,
		"job_id":       runRecord.JobID,
		"status":       result.status,
		"attempt":      runRecord.Attempt,
		"duration_ms":  durationMS,
		"exit_code":    result.exitCode,
		"error_msg":    result.errorMsg,
		"output_path":  result.outputPath,
		"scheduled_at": runRecord.ScheduledAt,
	})

	if shouldRetry(result.status) && runRecord.Attempt < job.RetryMax {
		nextAttempt := runRecord.Attempt + 1
		retryAfter := s.computeBackoff(job.RetryBackoffSec, runRecord.Attempt)
		scheduledAt := time.Now().UTC().Add(retryAfter)

		if _, err := s.runs.CreateQueuedWithAttempt(ctx, runRecord.JobID, scheduledAt, nextAttempt); err != nil {
			s.logger.Error("failed to enqueue retry", "run_id", runRecord.ID, "job_id", runRecord.JobID, "error", err)
			s.logEvent(ctx, "error", "job_retry", "retry_enqueue_failed", map[string]any{
				"run_id":  runRecord.ID,
				"job_id":  runRecord.JobID,
				"attempt": nextAttempt,
				"error":   err.Error(),
			})
		} else {
			s.logger.Info("retry scheduled",
				"run_id", runRecord.ID,
				"job_id", runRecord.JobID,
				"attempt", nextAttempt,
				"scheduled_at", scheduledAt.Format(time.RFC3339),
			)
			s.logEvent(ctx, "warn", "job_retry", "retry_scheduled", map[string]any{
				"run_id":       runRecord.ID,
				"job_id":       runRecord.JobID,
				"attempt":      nextAttempt,
				"scheduled_at": scheduledAt.Format(time.RFC3339Nano),
			})
		}
		return true, nil
	}

	if shouldRetry(result.status) && s.notifier != nil {
		finalRun, err := s.runs.GetByID(ctx, runRecord.ID)
		if err == nil {
			if notifyErr := s.notifier.NotifyTerminalFailure(ctx, job, finalRun); notifyErr != nil {
				s.logger.Error("terminal failure alert failed", "job_id", job.ID, "run_id", runRecord.ID, "error", notifyErr)
				s.logEvent(ctx, "error", "alerts", "terminal_failure_alert_failed", map[string]any{
					"job_id": runRecord.JobID,
					"run_id": runRecord.ID,
					"error":  notifyErr.Error(),
				})
			} else {
				s.logEvent(ctx, "info", "alerts", "terminal_failure_alert_sent", map[string]any{
					"job_id": runRecord.JobID,
					"run_id": runRecord.ID,
				})
			}
		}
	}

	return true, nil
}

type executionResult struct {
	status     string
	exitCode   *int
	errorMsg   string
	outputPath string
	outputTail string
}

func (s *Service) execute(ctx context.Context, runID string, job jobs.Record) executionResult {
	switch job.Type {
	case "shell":
		return s.executeShell(ctx, runID, job)
	case "http":
		return s.executeHTTP(ctx, runID, job)
	default:
		return executionResult{status: statusFailed, errorMsg: "unsupported_job_type"}
	}
}

type shellPayload struct {
	Command string `json:"command"`
}

func (s *Service) executeShell(ctx context.Context, runID string, job jobs.Record) executionResult {
	var payload shellPayload
	if err := json.Unmarshal([]byte(job.PayloadJSON), &payload); err != nil {
		return executionResult{status: statusFailed, errorMsg: "invalid_shell_payload"}
	}

	command := strings.TrimSpace(payload.Command)
	if command == "" {
		return executionResult{status: statusFailed, errorMsg: "command_required"}
	}

	capture, err := newOutputCapture(s.outputDir, runID)
	if err != nil {
		return executionResult{status: statusFailed, errorMsg: "output_capture_create_failed"}
	}
	defer capture.CloseAndMaybeKeep(false)

	runCtx, cancel := context.WithTimeout(ctx, time.Duration(job.TimeoutSec)*time.Second)
	defer cancel()

	cmd := shellCommand(runCtx, command)
	cmd.Stdout = capture
	cmd.Stderr = capture

	err = cmd.Run()
	outputTail := capture.Tail()

	if runCtx.Err() == context.DeadlineExceeded {
		path, _ := capture.CloseAndMaybeKeep(true)
		return executionResult{
			status:     statusTimedOut,
			errorMsg:   "command_timed_out",
			outputPath: path,
			outputTail: outputTail,
		}
	}
	if runCtx.Err() == context.Canceled {
		path, _ := capture.CloseAndMaybeKeep(true)
		return executionResult{
			status:     statusCancelled,
			errorMsg:   "command_cancelled",
			outputPath: path,
			outputTail: outputTail,
		}
	}

	if err != nil {
		exitCode := 1
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			exitCode = exitErr.ExitCode()
		}
		path, _ := capture.CloseAndMaybeKeep(true)
		return executionResult{
			status:     statusFailed,
			exitCode:   &exitCode,
			errorMsg:   err.Error(),
			outputPath: path,
			outputTail: outputTail,
		}
	}

	_, _ = capture.CloseAndMaybeKeep(false)
	successCode := 0
	return executionResult{
		status:     statusSuccess,
		exitCode:   &successCode,
		outputPath: "",
		outputTail: outputTail,
	}
}

func shellCommand(ctx context.Context, command string) *exec.Cmd {
	if runtime.GOOS == "windows" {
		return exec.CommandContext(ctx, "cmd.exe", "/C", command)
	}
	return exec.CommandContext(ctx, "/bin/sh", "-c", command)
}

type httpPayload struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

func (s *Service) executeHTTP(ctx context.Context, runID string, job jobs.Record) executionResult {
	var payload httpPayload
	if err := json.Unmarshal([]byte(job.PayloadJSON), &payload); err != nil {
		return executionResult{status: statusFailed, errorMsg: "invalid_http_payload"}
	}

	method := strings.ToUpper(strings.TrimSpace(payload.Method))
	if method == "" {
		method = http.MethodGet
	}
	url := strings.TrimSpace(payload.URL)
	if url == "" {
		return executionResult{status: statusFailed, errorMsg: "url_required"}
	}

	runCtx, cancel := context.WithTimeout(ctx, time.Duration(job.TimeoutSec)*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(runCtx, method, url, strings.NewReader(payload.Body))
	if err != nil {
		return executionResult{status: statusFailed, errorMsg: "invalid_http_request"}
	}
	for k, v := range payload.Headers {
		req.Header.Set(k, v)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		if runCtx.Err() == context.DeadlineExceeded {
			return executionResult{status: statusTimedOut, errorMsg: "http_request_timed_out"}
		}
		if runCtx.Err() == context.Canceled {
			return executionResult{status: statusCancelled, errorMsg: "http_request_cancelled"}
		}
		return executionResult{status: statusFailed, errorMsg: err.Error()}
	}
	defer resp.Body.Close()

	body, readErr := io.ReadAll(io.LimitReader(resp.Body, 65536))
	if readErr != nil {
		return executionResult{status: statusFailed, errorMsg: "http_read_failed"}
	}

	code := resp.StatusCode
	output := strings.TrimSpace(fmt.Sprintf("%s\n%s", resp.Status, string(body)))
	outputTail := truncateTail(output, 8192)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return executionResult{
			status:     statusSuccess,
			exitCode:   &code,
			outputTail: outputTail,
		}
	}

	outputPath, _ := writeFailureOutputFile(s.outputDir, runID, output)
	return executionResult{
		status:     statusFailed,
		exitCode:   &code,
		errorMsg:   fmt.Sprintf("http_status_%d", code),
		outputPath: outputPath,
		outputTail: outputTail,
	}
}

func (s *Service) computeBackoff(baseSec int, attempt int) time.Duration {
	if baseSec <= 0 {
		baseSec = 1
	}

	base := time.Duration(baseSec) * time.Second
	backoff := base * time.Duration(1<<attempt)
	jitterRange := backoff / 5
	if jitterRange <= 0 {
		return backoff
	}

	delta := s.rand.Int63n(int64(jitterRange*2)+1) - int64(jitterRange)
	return backoff + time.Duration(delta)
}

func shouldRetry(status string) bool {
	return status == statusFailed || status == statusTimedOut
}

func levelForRunStatus(status string) string {
	switch status {
	case statusSuccess:
		return "info"
	case statusCancelled, statusSkippedOverlap:
		return "warn"
	default:
		return "error"
	}
}

func (s *Service) logEvent(ctx context.Context, level, category, message string, meta map[string]any) {
	if s.events == nil {
		return
	}
	if err := s.events.Log(ctx, level, category, message, meta); err != nil {
		s.logger.Error("event log write failed", "category", category, "message", message, "error", err)
	}
}

func (s *Service) markActive(runID, jobID string, cancel context.CancelFunc, overlapPolicy string) bool {
	s.activeMu.Lock()
	defer s.activeMu.Unlock()

	if overlapPolicy == "skip" {
		for activeRunID, activeJobID := range s.activeRunJobs {
			if activeRunID != runID && activeJobID == jobID {
				return false
			}
		}
	}

	s.activeRunJobs[runID] = jobID
	s.activeCancels[runID] = cancel
	return true
}

func (s *Service) clearActive(runID string) {
	s.activeMu.Lock()
	defer s.activeMu.Unlock()
	delete(s.activeRunJobs, runID)
	delete(s.activeCancels, runID)
}

func truncateTail(text string, max int) string {
	if max <= 0 {
		return ""
	}
	if len(text) <= max {
		return text
	}
	return text[len(text)-max:]
}

type outputCapture struct {
	path   string
	file   *os.File
	tailer *tailBuffer
	closed bool
}

func newOutputCapture(baseDir, runID string) (*outputCapture, error) {
	if strings.TrimSpace(baseDir) == "" {
		return nil, errors.New("output_dir_required")
	}
	if err := os.MkdirAll(baseDir, 0o755); err != nil {
		return nil, err
	}

	path := filepath.Join(baseDir, runID+".log")
	file, err := os.Create(path)
	if err != nil {
		return nil, err
	}

	return &outputCapture{
		path:   path,
		file:   file,
		tailer: &tailBuffer{max: 8192},
	}, nil
}

func (o *outputCapture) Write(p []byte) (int, error) {
	if o.closed {
		return 0, errors.New("output_capture_closed")
	}
	_, _ = o.tailer.Write(p)
	return o.file.Write(p)
}

func (o *outputCapture) Tail() string {
	return o.tailer.String()
}

func (o *outputCapture) CloseAndMaybeKeep(keep bool) (string, error) {
	if o.closed {
		if keep {
			return o.path, nil
		}
		return "", nil
	}

	o.closed = true
	closeErr := o.file.Close()
	if !keep {
		_ = os.Remove(o.path)
		return "", closeErr
	}
	return o.path, closeErr
}

type tailBuffer struct {
	max int
	buf []byte
}

func (t *tailBuffer) Write(p []byte) (int, error) {
	if t.max <= 0 {
		return len(p), nil
	}

	if len(p) >= t.max {
		t.buf = append(t.buf[:0], p[len(p)-t.max:]...)
		return len(p), nil
	}

	t.buf = append(t.buf, p...)
	if len(t.buf) > t.max {
		t.buf = append([]byte(nil), t.buf[len(t.buf)-t.max:]...)
	}

	return len(p), nil
}

func (t *tailBuffer) String() string {
	return string(t.buf)
}

func writeFailureOutputFile(baseDir, runID, content string) (string, error) {
	if strings.TrimSpace(baseDir) == "" || content == "" {
		return "", nil
	}
	if err := os.MkdirAll(baseDir, 0o755); err != nil {
		return "", err
	}

	path := filepath.Join(baseDir, runID+".log")
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return "", err
	}
	return path, nil
}
