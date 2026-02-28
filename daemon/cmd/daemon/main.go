package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cronye/daemon/internal/app"
	"github.com/cronye/daemon/internal/config"
	"github.com/cronye/daemon/internal/osservice"
)

func main() {
	cfg := config.FromEnv()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	if len(os.Args) > 1 {
		if err := runCommand(cfg, logger, os.Args[1:]); err != nil {
			logger.Error("command failed", "error", err)
			os.Exit(1)
		}
		return
	}

	if err := runDaemon(cfg, logger); err != nil {
		logger.Error("daemon stopped with error", "error", err)
		os.Exit(1)
	}
}

func runCommand(cfg config.Config, logger *slog.Logger, args []string) error {
	switch args[0] {
	case "service":
		if len(args) < 2 {
			return errors.New("usage: daemon service <install|uninstall>")
		}
		switch args[1] {
		case "install":
			if err := osservice.Install(cfg); err != nil {
				return err
			}
			logger.Info("service installed", "service_name", cfg.ServiceName, "service_label", cfg.ServiceLabel)
			return nil
		case "uninstall":
			if err := osservice.Uninstall(cfg); err != nil {
				return err
			}
			logger.Info("service uninstalled", "service_name", cfg.ServiceName, "service_label", cfg.ServiceLabel)
			return nil
		default:
			return fmt.Errorf("unsupported service command %q", args[1])
		}
	default:
		return fmt.Errorf("unsupported command %q", args[0])
	}
}

func runDaemon(cfg config.Config, logger *slog.Logger) error {
	a, err := app.New(cfg, logger)
	if err != nil {
		return err
	}

	runErrCh := make(chan error, 1)
	go func() {
		runErrCh <- a.Run()
	}()

	sigCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	select {
	case <-sigCtx.Done():
		logger.Info("shutdown signal received")
	case err := <-runErrCh:
		if err != nil {
			return err
		}
		return nil
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := a.Shutdown(shutdownCtx); err != nil {
		return err
	}
	return nil
}
