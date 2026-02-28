package jobs

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/cronye/daemon/internal/idgen"
)

type ScheduleJob struct {
	ID       string
	Name     string
	Schedule string
	Timezone string
}

type Record struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Type            string `json:"type"`
	Schedule        string `json:"schedule"`
	Timezone        string `json:"timezone"`
	Enabled         bool   `json:"enabled"`
	PayloadJSON     string `json:"payload_json"`
	TimeoutSec      int    `json:"timeout_sec"`
	RetryMax        int    `json:"retry_max"`
	RetryBackoffSec int    `json:"retry_backoff_sec"`
	OverlapPolicy   string `json:"overlap_policy"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
}

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context) ([]Record, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT id, name, type, schedule, timezone, enabled, payload_json, timeout_sec, retry_max, retry_backoff_sec, overlap_policy, created_at, updated_at
		FROM jobs ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Record, 0)
	for rows.Next() {
		var (
			item      Record
			enabledDB int
		)

		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Type,
			&item.Schedule,
			&item.Timezone,
			&enabledDB,
			&item.PayloadJSON,
			&item.TimeoutSec,
			&item.RetryMax,
			&item.RetryBackoffSec,
			&item.OverlapPolicy,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		item.Enabled = enabledDB == 1
		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, id string) (Record, error) {
	var (
		item      Record
		enabledDB int
	)

	err := r.db.QueryRowContext(
		ctx,
		`SELECT id, name, type, schedule, timezone, enabled, payload_json, timeout_sec, retry_max, retry_backoff_sec, overlap_policy, created_at, updated_at
		FROM jobs WHERE id = ?`,
		id,
	).Scan(
		&item.ID,
		&item.Name,
		&item.Type,
		&item.Schedule,
		&item.Timezone,
		&enabledDB,
		&item.PayloadJSON,
		&item.TimeoutSec,
		&item.RetryMax,
		&item.RetryBackoffSec,
		&item.OverlapPolicy,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Record{}, sql.ErrNoRows
		}
		return Record{}, err
	}

	item.Enabled = enabledDB == 1
	return item, nil
}

func (r *Repository) ListEnabled(ctx context.Context) ([]ScheduleJob, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT id, name, schedule, timezone FROM jobs WHERE enabled = 1`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	jobs := make([]ScheduleJob, 0)
	for rows.Next() {
		var job ScheduleJob
		if err := rows.Scan(&job.ID, &job.Name, &job.Schedule, &job.Timezone); err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}

	return jobs, rows.Err()
}

type CreateInput struct {
	Name          string
	Type          string
	Schedule      string
	Timezone      string
	Enabled       bool
	PayloadJSON   string
	TimeoutSec    int
	RetryMax      int
	RetryBackoff  int
	OverlapPolicy string
}

func (r *Repository) Create(ctx context.Context, in CreateInput) (Record, error) {
	jobID, err := idgen.New("job")
	if err != nil {
		return Record{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)

	enabled := 0
	if in.Enabled {
		enabled = 1
	}

	_, err = r.db.ExecContext(
		ctx,
		`INSERT INTO jobs (
			id, name, type, schedule, timezone, enabled, payload_json, timeout_sec, retry_max, retry_backoff_sec, overlap_policy, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		jobID, in.Name, in.Type, in.Schedule, in.Timezone, enabled, in.PayloadJSON, in.TimeoutSec, in.RetryMax, in.RetryBackoff, in.OverlapPolicy, now, now,
	)
	if err != nil {
		return Record{}, err
	}

	return r.GetByID(ctx, jobID)
}

func (r *Repository) Update(ctx context.Context, id string, in CreateInput) (Record, error) {
	now := time.Now().UTC().Format(time.RFC3339Nano)
	enabled := 0
	if in.Enabled {
		enabled = 1
	}

	res, err := r.db.ExecContext(
		ctx,
		`UPDATE jobs
		SET name = ?, type = ?, schedule = ?, timezone = ?, enabled = ?, payload_json = ?, timeout_sec = ?, retry_max = ?, retry_backoff_sec = ?, overlap_policy = ?, updated_at = ?
		WHERE id = ?`,
		in.Name, in.Type, in.Schedule, in.Timezone, enabled, in.PayloadJSON, in.TimeoutSec, in.RetryMax, in.RetryBackoff, in.OverlapPolicy, now, id,
	)
	if err != nil {
		return Record{}, err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return Record{}, err
	}
	if affected == 0 {
		return Record{}, sql.ErrNoRows
	}

	return r.GetByID(ctx, id)
}

func (r *Repository) SetEnabled(ctx context.Context, id string, enabled bool) (Record, error) {
	now := time.Now().UTC().Format(time.RFC3339Nano)
	enabledDB := 0
	if enabled {
		enabledDB = 1
	}

	res, err := r.db.ExecContext(
		ctx,
		`UPDATE jobs SET enabled = ?, updated_at = ? WHERE id = ?`,
		enabledDB, now, id,
	)
	if err != nil {
		return Record{}, err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return Record{}, err
	}
	if affected == 0 {
		return Record{}, sql.ErrNoRows
	}

	return r.GetByID(ctx, id)
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM jobs WHERE id = ?`, id)
	if err != nil {
		return err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}
