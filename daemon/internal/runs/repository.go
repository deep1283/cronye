package runs

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/cronye/daemon/internal/idgen"
)

var ErrNoQueuedRuns = errors.New("no_queued_runs")

type Record struct {
	ID          string `json:"id"`
	JobID       string `json:"job_id"`
	ScheduledAt string `json:"scheduled_at"`
	StartedAt   string `json:"started_at,omitempty"`
	FinishedAt  string `json:"finished_at,omitempty"`
	Status      string `json:"status"`
	Attempt     int    `json:"attempt"`
	ExitCode    *int   `json:"exit_code,omitempty"`
	ErrorMsg    string `json:"error_msg,omitempty"`
	OutputPath  string `json:"output_path,omitempty"`
	OutputTail  string `json:"output_tail,omitempty"`
	DurationMS  *int64 `json:"duration_ms,omitempty"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateQueued(ctx context.Context, jobID string, scheduledAt time.Time) (Record, error) {
	return r.CreateQueuedWithAttempt(ctx, jobID, scheduledAt, 0)
}

func (r *Repository) CreateQueuedWithAttempt(ctx context.Context, jobID string, scheduledAt time.Time, attempt int) (Record, error) {
	runID, err := idgen.New("run")
	if err != nil {
		return Record{}, err
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err = r.db.ExecContext(
		ctx,
		`INSERT INTO job_runs (
			id, job_id, scheduled_at, status, attempt, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		runID, jobID, scheduledAt.UTC().Format(time.RFC3339Nano), "queued", attempt, now, now,
	)
	if err != nil {
		return Record{}, err
	}

	return r.GetByID(ctx, runID)
}

func (r *Repository) ExistsByJobAndScheduledAt(ctx context.Context, jobID string, scheduledAt time.Time) (bool, error) {
	var count int
	err := r.db.QueryRowContext(
		ctx,
		`SELECT COUNT(1) FROM job_runs WHERE job_id = ? AND scheduled_at = ?`,
		jobID,
		scheduledAt.UTC().Format(time.RFC3339Nano),
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *Repository) ClaimNextDue(ctx context.Context) (Record, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Record{}, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	now := time.Now().UTC().Format(time.RFC3339Nano)

	var runID string
	err = tx.QueryRowContext(
		ctx,
		`SELECT id
		FROM job_runs
		WHERE status = 'queued' AND scheduled_at <= ?
		ORDER BY scheduled_at ASC, created_at ASC
		LIMIT 1`,
		now,
	).Scan(&runID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Record{}, ErrNoQueuedRuns
		}
		return Record{}, err
	}

	res, err := tx.ExecContext(
		ctx,
		`UPDATE job_runs
		SET status = 'running', started_at = ?, updated_at = ?
		WHERE id = ? AND status = 'queued'`,
		now, now, runID,
	)
	if err != nil {
		return Record{}, err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return Record{}, err
	}
	if affected == 0 {
		return Record{}, ErrNoQueuedRuns
	}

	item, err := scanRun(tx.QueryRowContext(
		ctx,
		`SELECT id, job_id, scheduled_at, started_at, finished_at, status, attempt, exit_code, error_msg, output_path, output_tail, duration_ms, created_at, updated_at
		FROM job_runs WHERE id = ?`,
		runID,
	))
	if err != nil {
		return Record{}, err
	}

	if err := tx.Commit(); err != nil {
		return Record{}, err
	}

	return item, nil
}

func (r *Repository) CountRunningByJob(ctx context.Context, jobID, excludeRunID string) (int, error) {
	var count int
	err := r.db.QueryRowContext(
		ctx,
		`SELECT COUNT(1)
		FROM job_runs
		WHERE job_id = ? AND status = 'running' AND id != ?`,
		jobID, excludeRunID,
	).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (r *Repository) MarkFinished(
	ctx context.Context,
	id string,
	status string,
	exitCode *int,
	errorMsg string,
	outputPath string,
	outputTail string,
	durationMS int64,
) error {
	now := time.Now().UTC().Format(time.RFC3339Nano)

	var exit any
	if exitCode == nil {
		exit = nil
	} else {
		exit = *exitCode
	}

	var msg any
	if errorMsg == "" {
		msg = nil
	} else {
		msg = errorMsg
	}

	var tail any
	if outputTail == "" {
		tail = nil
	} else {
		tail = outputTail
	}

	var path any
	if outputPath == "" {
		path = nil
	} else {
		path = outputPath
	}

	res, err := r.db.ExecContext(
		ctx,
		`UPDATE job_runs
		SET status = ?, finished_at = ?, exit_code = ?, error_msg = ?, output_path = ?, output_tail = ?, duration_ms = ?, updated_at = ?
		WHERE id = ?`,
		status, now, exit, msg, path, tail, durationMS, now, id,
	)
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

func (r *Repository) ListByJob(ctx context.Context, jobID string) ([]Record, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT id, job_id, scheduled_at, started_at, finished_at, status, attempt, exit_code, error_msg, output_path, output_tail, duration_ms, created_at, updated_at
		FROM job_runs
		WHERE job_id = ?
		ORDER BY created_at DESC`,
		jobID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Record, 0)
	for rows.Next() {
		item, err := scanRun(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, id string) (Record, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT id, job_id, scheduled_at, started_at, finished_at, status, attempt, exit_code, error_msg, output_path, output_tail, duration_ms, created_at, updated_at
		FROM job_runs WHERE id = ?`,
		id,
	)

	item, err := scanRun(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Record{}, sql.ErrNoRows
		}
		return Record{}, err
	}

	return item, nil
}

func (r *Repository) LatestByJob(ctx context.Context, jobID string) (Record, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT id, job_id, scheduled_at, started_at, finished_at, status, attempt, exit_code, error_msg, output_path, output_tail, duration_ms, created_at, updated_at
		FROM job_runs
		WHERE job_id = ?
		ORDER BY created_at DESC
		LIMIT 1`,
		jobID,
	)

	item, err := scanRun(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Record{}, sql.ErrNoRows
		}
		return Record{}, err
	}
	return item, nil
}

type scanner interface {
	Scan(dest ...any) error
}

func scanRun(row scanner) (Record, error) {
	var (
		item       Record
		startedAt  sql.NullString
		finishedAt sql.NullString
		errorMsg   sql.NullString
		outputPath sql.NullString
		outputTail sql.NullString
		exitCode   sql.NullInt64
		durationMS sql.NullInt64
	)

	err := row.Scan(
		&item.ID,
		&item.JobID,
		&item.ScheduledAt,
		&startedAt,
		&finishedAt,
		&item.Status,
		&item.Attempt,
		&exitCode,
		&errorMsg,
		&outputPath,
		&outputTail,
		&durationMS,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return Record{}, err
	}

	if startedAt.Valid {
		item.StartedAt = startedAt.String
	}
	if finishedAt.Valid {
		item.FinishedAt = finishedAt.String
	}
	if exitCode.Valid {
		code := int(exitCode.Int64)
		item.ExitCode = &code
	}
	if errorMsg.Valid {
		item.ErrorMsg = errorMsg.String
	}
	if outputPath.Valid {
		item.OutputPath = outputPath.String
	}
	if outputTail.Valid {
		item.OutputTail = outputTail.String
	}
	if durationMS.Valid {
		val := durationMS.Int64
		item.DurationMS = &val
	}

	return item, nil
}
