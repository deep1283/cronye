package app

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/cronye/daemon/internal/alerts"
	"github.com/cronye/daemon/internal/api"
	"github.com/cronye/daemon/internal/config"
	"github.com/cronye/daemon/internal/db"
	"github.com/cronye/daemon/internal/events"
	"github.com/cronye/daemon/internal/jobs"
	"github.com/cronye/daemon/internal/maintenance"
	"github.com/cronye/daemon/internal/runner"
	"github.com/cronye/daemon/internal/runs"
	"github.com/cronye/daemon/internal/scheduler"
	"github.com/cronye/daemon/internal/settings"
	"github.com/cronye/daemon/internal/version"
)

type App struct {
	cfg               config.Config
	logger            *slog.Logger
	startedAt         time.Time
	resolvedUIDistDir string
	db                *db.Store
	scheduler         *scheduler.Service
	runner            *runner.Service
	maintenanceWorker *maintenance.Worker
	server            *http.Server
}

func New(cfg config.Config, logger *slog.Logger) (*App, error) {
	if err := os.MkdirAll(filepath.Dir(cfg.DBPath), 0o755); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	store, err := db.OpenAndMigrate(ctx, cfg.DBPath)
	if err != nil {
		return nil, err
	}

	jobRepo := jobs.NewRepository(store.DB)
	runRepo := runs.NewRepository(store.DB)
	settingsRepo := settings.NewRepository(store.DB)
	eventsRepo := events.NewRepository(store.DB)
	maintenanceSvc := maintenance.NewService(store.DB)
	maintenanceWorker := maintenance.NewWorker(logger.With("component", "maintenance"), maintenanceSvc, settingsRepo, eventsRepo)
	alertsSvc := alerts.NewService(logger.With("component", "alerts"), settingsRepo)
	outputDir := filepath.Join(filepath.Dir(cfg.DBPath), "run-outputs")
	svc := scheduler.NewService(
		logger.With("component", "scheduler"),
		jobRepo,
		func(ctx context.Context, jobID string, scheduledAt time.Time) error {
			_, err := runRepo.CreateQueued(ctx, jobID, scheduledAt)
			return err
		},
	)
	runnerSvc := runner.NewService(logger.With("component", "runner"), jobRepo, runRepo, alertsSvc, eventsRepo, outputDir)

	startedAt := time.Now().UTC()
	apiHandler := api.NewRouter(api.Dependencies{
		Logger:            logger.With("component", "api"),
		Store:             store,
		Jobs:              jobRepo,
		Runs:              runRepo,
		Maintenance:       maintenanceSvc,
		MaintenanceWorker: maintenanceWorker,
		Events:            eventsRepo,
		Runner:            runnerSvc,
		Settings:          settingsRepo,
		Scheduler:         svc,
		StartedAt:         startedAt,
	})
	handler, resolvedUIDir := newHTTPHandler(apiHandler, cfg.UIDistDir)

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	return &App{
		cfg:               cfg,
		logger:            logger,
		startedAt:         startedAt,
		resolvedUIDistDir: resolvedUIDir,
		db:                store,
		scheduler:         svc,
		runner:            runnerSvc,
		maintenanceWorker: maintenanceWorker,
		server:            server,
	}, nil
}

func (a *App) Run() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := a.scheduler.Start(ctx); err != nil {
		return err
	}
	if err := a.runner.Start(ctx); err != nil {
		return err
	}
	if err := a.maintenanceWorker.Start(ctx); err != nil {
		return err
	}

	a.logger.Info("daemon started",
		"version", version.BuildVersion,
		"addr", a.cfg.Addr,
		"db_path", a.cfg.DBPath,
		"ui_dist_dir", a.cfg.UIDistDir,
		"registered_jobs", a.scheduler.RegisteredJobs(),
		"runner_running", a.runner.Running(),
		"maintenance_running", a.maintenanceWorker.Running(),
	)
	if a.resolvedUIDistDir == "" {
		a.logger.Warn("ui dist not found; serving API only", "configured_ui_dist_dir", a.cfg.UIDistDir)
	} else {
		a.logger.Info("ui static files enabled", "resolved_ui_dist_dir", a.resolvedUIDistDir)
	}

	err := a.server.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (a *App) Shutdown(ctx context.Context) error {
	a.maintenanceWorker.Stop(ctx)
	a.runner.Stop(ctx)
	a.scheduler.Stop(ctx)
	if err := a.server.Shutdown(ctx); err != nil {
		return err
	}
	return a.db.Close()
}
