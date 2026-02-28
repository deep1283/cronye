package events

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/cronye/daemon/internal/idgen"
)

type Record struct {
	ID        string          `json:"id"`
	Level     string          `json:"level"`
	Category  string          `json:"category"`
	Message   string          `json:"message"`
	MetaJSON  json.RawMessage `json:"meta_json,omitempty"`
	CreatedAt string          `json:"created_at"`
}

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Log(ctx context.Context, level, category, message string, meta any) error {
	eventID, err := idgen.New("evt")
	if err != nil {
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)

	var metaJSON any
	if meta != nil {
		encoded, err := json.Marshal(meta)
		if err != nil {
			return err
		}
		metaJSON = string(encoded)
	}

	_, err = r.db.ExecContext(
		ctx,
		`INSERT INTO events (id, level, category, message, meta_json, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		eventID, level, category, message, metaJSON, now,
	)
	return err
}

func (r *Repository) ListRecent(ctx context.Context, limit int) ([]Record, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := r.db.QueryContext(
		ctx,
		`SELECT id, level, category, message, meta_json, created_at
		FROM events
		ORDER BY created_at DESC
		LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Record, 0)
	for rows.Next() {
		var (
			item     Record
			metaJSON sql.NullString
		)

		if err := rows.Scan(
			&item.ID,
			&item.Level,
			&item.Category,
			&item.Message,
			&metaJSON,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}

		if metaJSON.Valid {
			item.MetaJSON = json.RawMessage(metaJSON.String)
		}
		items = append(items, item)
	}

	return items, rows.Err()
}
