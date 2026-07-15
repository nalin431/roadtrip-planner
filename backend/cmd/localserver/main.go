package main

import (
	"log"
	"net/http"

	"github.com/joho/godotenv"
	"github.com/nalin431/roadtrip-planner/backend/internal/api"
	"github.com/nalin431/roadtrip-planner/backend/internal/config"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	logger := config.NewLogger(cfg.Env)
	router := api.NewRouter(logger, cfg.AllowedOrigin)

	logger.Info("starting local server", "port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
