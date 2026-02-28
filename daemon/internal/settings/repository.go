package settings

import (
	"context"
	"database/sql"
	"strconv"
	"time"
)

const (
	KeyRetentionDays           = "retention_days"
	KeyMaxLogBytes             = "max_log_bytes"
	KeyGlobalConcurrency       = "global_concurrency"
	KeyAlertWebhookURL         = "alert_webhook_url"
	KeyMaintenanceLastRunAt    = "maintenance_last_run_at"
	KeyMaintenanceLastVacuumAt = "maintenance_last_vacuum_at"
	KeySchedulerHeartbeatAt    = "scheduler_heartbeat_at"
	KeyLicenseToken            = "license_token"
	KeyLicenseActivatedAt      = "license_activated_at"
	KeyLicenseLastCheckedAt    = "license_last_checked_at"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Upsert(ctx context.Context, key, value string) error {
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err := r.db.ExecContext(
		ctx,
		`INSERT INTO settings (key, value, updated_at)
		VALUES (?, ?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
		key, value, now,
	)
	return err
}

func (r *Repository) Get(ctx context.Context, key string) (string, error) {
	var value string
	err := r.db.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", sql.ErrNoRows
		}
		return "", err
	}
	return value, nil
}

func (r *Repository) GetInt(ctx context.Context, key string, fallback int) (int, error) {
	raw, err := r.Get(ctx, key)
	if err == sql.ErrNoRows {
		return fallback, nil
	}
	if err != nil {
		return 0, err
	}

	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback, nil
	}
	return value, nil
}

func (r *Repository) GetInt64(ctx context.Context, key string, fallback int64) (int64, error) {
	raw, err := r.Get(ctx, key)
	if err == sql.ErrNoRows {
		return fallback, nil
	}
	if err != nil {
		return 0, err
	}

	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return fallback, nil
	}
	return value, nil
}

func (r *Repository) Delete(ctx context.Context, key string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM settings WHERE key = ?`, key)
	return err
}
