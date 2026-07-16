package db

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool opens a small connection pool sized for Lambda's one-invocation-per-instance
// model: each concurrent invocation gets its own instance, so per-instance pool size
// stays low even though total concurrent DB connections can still grow with traffic.
//
// DATABASE_URL is expected to point at Supabase's transaction-mode pooler (pgbouncer),
// which does not support prepared statements across pooled connections. Disabling pgx's
// statement cache avoids "prepared statement already exists" errors under pooling.
func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}

	poolCfg.MaxConns = 2
	poolCfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	return pgxpool.NewWithConfig(ctx, poolCfg)
}
