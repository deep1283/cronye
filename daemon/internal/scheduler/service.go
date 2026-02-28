package scheduler

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/cronye/daemon/internal/jobs"
	"github.com/robfig/cron/v3"
)

type JobRepository interface {
	ListEnabled(ctx context.Context) ([]jobs.ScheduleJob, error)
}

type EnqueueFunc func(ctx context.Context, jobID string, scheduledAt time.Time) error

type Service struct {
	logger  *slog.Logger
	repo    JobRepository
	enqueue EnqueueFunc

	mu      sync.RWMutex
	cron    *cron.Cron
	entries map[string]cron.EntryID
	running bool
}

func NewService(logger *slog.Logger, repo JobRepository, enqueue EnqueueFunc) *Service {
	return &Service{
		logger:  logger,
		repo:    repo,
		enqueue: enqueue,
		cron:    cron.New(),
		entries: make(map[string]cron.EntryID),
	}
}

func (s *Service) Start(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return nil
	}

	if err := s.reloadLocked(ctx); err != nil {
		return err
	}

	s.cron.Start()
	s.running = true
	return nil
}

func (s *Service) Reload(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.reloadLocked(ctx)
}

func (s *Service) reloadLocked(ctx context.Context) error {
	for _, entryID := range s.entries {
		s.cron.Remove(entryID)
	}
	s.entries = make(map[string]cron.EntryID)

	enabledJobs, err := s.repo.ListEnabled(ctx)
	if err != nil {
		return err
	}

	for _, job := range enabledJobs {
		if err := s.registerLocked(job); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) Stop(ctx context.Context) {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return
	}

	doneCtx := s.cron.Stop()
	s.running = false
	s.mu.Unlock()

	select {
	case <-doneCtx.Done():
	case <-ctx.Done():
	}
}

func (s *Service) RegisteredJobs() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.entries)
}

func (s *Service) Running() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.running
}

func (s *Service) NextRun(jobID string) (time.Time, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entryID, ok := s.entries[jobID]
	if !ok {
		return time.Time{}, false
	}

	next := s.cron.Entry(entryID).Next
	if next.IsZero() {
		return time.Time{}, false
	}
	return next.UTC(), true
}

func (s *Service) registerLocked(job jobs.ScheduleJob) error {
	spec := fmt.Sprintf("CRON_TZ=%s %s", job.Timezone, job.Schedule)

	entryID, err := s.cron.AddFunc(spec, func() {
		triggeredAt := time.Now().UTC()

		if s.enqueue == nil {
			s.logger.Warn("job trigger has no enqueue handler", "job_id", job.ID, "name", job.Name)
			return
		}

		enqueueCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := s.enqueue(enqueueCtx, job.ID, triggeredAt); err != nil {
			s.logger.Error("failed to enqueue scheduled run", "job_id", job.ID, "name", job.Name, "error", err)
			return
		}

		s.logger.Info("scheduled run enqueued", "job_id", job.ID, "name", job.Name, "scheduled_at", triggeredAt.Format(time.RFC3339))
	})
	if err != nil {
		return fmt.Errorf("register job %s failed: %w", job.ID, err)
	}

	s.entries[job.ID] = entryID
	return nil
}
