package main

import (
	"context"
	"log"
	"net/http"

	"github.com/joho/godotenv"
	"github.com/nalin431/roadtrip-planner/backend/internal/api"
	"github.com/nalin431/roadtrip-planner/backend/internal/config"
	"github.com/nalin431/roadtrip-planner/backend/internal/db"
	"github.com/nalin431/roadtrip-planner/backend/internal/db/sqlc"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	logger := config.NewLogger(cfg.Env)

	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db pool error: %v", err)
	}
	defer pool.Close()

	queries := sqlc.New(pool)
	router := api.NewRouter(logger, cfg.AllowedOrigin, queries)

	logger.Info("starting local server", "port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
