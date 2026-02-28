package maintenance

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

type Service struct {
	db *sql.DB
}

type PurgeResult struct {
	DeletedRuns        int64 `json:"deleted_runs"`
	DeletedOutputFiles int   `json:"deleted_output_files"`
}

type LogCapResult struct {
	DeletedOutputFiles int   `json:"deleted_output_files"`
	FreedBytes         int64 `json:"freed_bytes"`
}

type StorageUsage struct {
	DBBytes        int64 `json:"db_bytes"`
	RunOutputBytes int64 `json:"run_output_bytes"`
	TotalBytes     int64 `json:"total_bytes"`
	RetentionDays  int   `json:"retention_days"`
	MaxLogBytes    int64 `json:"max_log_bytes"`
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) PurgeRuns(ctx context.Context, olderThanDays int, successOnly bool) (PurgeResult, error) {
	if olderThanDays <= 0 {
		return PurgeResult{}, errors.New("older_than_days_must_be_positive")
	}

	cutoff := time.Now().UTC().AddDate(0, 0, -olderThanDays).Format(time.RFC3339Nano)

	whereClause := `COALESCE(finished_at, created_at) < ?`
	args := []any{cutoff}
	if successOnly {
		whereClause += ` AND status = 'success'`
	}

	rows, err := s.db.QueryContext(
		ctx,
		fmt.Sprintf(`SELECT DISTINCT output_path FROM job_runs WHERE %s AND output_path IS NOT NULL AND output_path != ''`, whereClause),
		args...,
	)
	if err != nil {
		return PurgeResult{}, err
	}
	defer rows.Close()

	paths := make([]string, 0)
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return PurgeResult{}, err
		}
		paths = append(paths, path)
	}
	if err := rows.Err(); err != nil {
		return PurgeResult{}, err
	}

	res, err := s.db.ExecContext(ctx, fmt.Sprintf(`DELETE FROM job_runs WHERE %s`, whereClause), args...)
	if err != nil {
		return PurgeResult{}, err
	}

	deletedRuns, err := res.RowsAffected()
	if err != nil {
		return PurgeResult{}, err
	}

	deletedOutputFiles, err := s.deleteOrphanedPaths(ctx, paths)
	if err != nil {
		return PurgeResult{}, err
	}

	return PurgeResult{
		DeletedRuns:        deletedRuns,
		DeletedOutputFiles: deletedOutputFiles,
	}, nil
}

func (s *Service) EnforceOutputLogCap(ctx context.Context, maxBytes int64) (LogCapResult, error) {
	if maxBytes <= 0 {
		return LogCapResult{}, errors.New("max_bytes_must_be_positive")
	}

	type item struct {
		path string
	}

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT output_path
		FROM job_runs
		WHERE output_path IS NOT NULL AND output_path != ''
		GROUP BY output_path
		ORDER BY MIN(COALESCE(finished_at, created_at)) ASC`,
	)
	if err != nil {
		return LogCapResult{}, err
	}
	defer rows.Close()

	items := make([]item, 0)
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.path); err != nil {
			return LogCapResult{}, err
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return LogCapResult{}, err
	}

	totalBytes, err := runOutputBytes(ctx, s.db)
	if err != nil {
		return LogCapResult{}, err
	}
	if totalBytes <= maxBytes {
		return LogCapResult{}, nil
	}

	var deletedFiles int
	var freedBytes int64
	for _, it := range items {
		if totalBytes <= maxBytes {
			break
		}
		path := strings.TrimSpace(it.path)
		if path == "" {
			continue
		}

		var size int64
		if info, err := os.Stat(path); err == nil {
			size = info.Size()
		}

		_ = os.Remove(path)
		if _, err := s.db.ExecContext(ctx, `UPDATE job_runs SET output_path = NULL WHERE output_path = ?`, path); err != nil {
			return LogCapResult{}, err
		}

		deletedFiles++
		totalBytes -= size
		freedBytes += size
	}

	return LogCapResult{
		DeletedOutputFiles: deletedFiles,
		FreedBytes:         freedBytes,
	}, nil
}

func (s *Service) StorageUsage(ctx context.Context, retentionDays int, maxLogBytes int64) (StorageUsage, error) {
	dbBytes, err := dbSizeBytes(ctx, s.db)
	if err != nil {
		return StorageUsage{}, err
	}

	outputBytes, err := runOutputBytes(ctx, s.db)
	if err != nil {
		return StorageUsage{}, err
	}

	return StorageUsage{
		DBBytes:        dbBytes,
		RunOutputBytes: outputBytes,
		TotalBytes:     dbBytes + outputBytes,
		RetentionDays:  retentionDays,
		MaxLogBytes:    maxLogBytes,
	}, nil
}

func (s *Service) Vacuum(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `VACUUM`)
	return err
}

func (s *Service) deleteOrphanedPaths(ctx context.Context, paths []string) (int, error) {
	var deleted int
	for _, path := range paths {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}

		var refs int
		if err := s.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM job_runs WHERE output_path = ?`, path).Scan(&refs); err != nil {
			return deleted, err
		}
		if refs > 0 {
			continue
		}

		if err := os.Remove(path); err == nil || os.IsNotExist(err) {
			deleted++
			continue
		} else {
			return deleted, err
		}
	}
	return deleted, nil
}

func dbSizeBytes(ctx context.Context, db *sql.DB) (int64, error) {
	var (
		pageSize  int64
		pageCount int64
	)

	if err := db.QueryRowContext(ctx, `PRAGMA page_size`).Scan(&pageSize); err != nil {
		return 0, err
	}
	if err := db.QueryRowContext(ctx, `PRAGMA page_count`).Scan(&pageCount); err != nil {
		return 0, err
	}

	return pageSize * pageCount, nil
}

func runOutputBytes(ctx context.Context, db *sql.DB) (int64, error) {
	rows, err := db.QueryContext(ctx, `SELECT DISTINCT output_path FROM job_runs WHERE output_path IS NOT NULL AND output_path != ''`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var total int64
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return 0, err
		}

		info, err := os.Stat(path)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return 0, fmt.Errorf("stat output file %s: %w", path, err)
		}
		total += info.Size()
	}

	return total, rows.Err()
}
