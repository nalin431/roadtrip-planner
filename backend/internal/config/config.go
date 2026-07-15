package config

import (
	"fmt"
	"log/slog"
	"os"
)

type Config struct {
	Env            string // "local" | "lambda"
	Port           string // local server only
	DatabaseURL    string
	AllowedOrigin  string
	GooglePlacesKey string
}

func Load() (*Config, error) {
	cfg := &Config{
		Env:             getEnv("APP_ENV", "local"),
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		AllowedOrigin:   os.Getenv("ALLOWED_ORIGIN"),
		GooglePlacesKey: os.Getenv("GOOGLE_PLACES_API_KEY"),
	}

	var missing []string
	if cfg.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if cfg.AllowedOrigin == "" {
		missing = append(missing, "ALLOWED_ORIGIN")
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("missing required env vars: %v", missing)
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func NewLogger(env string) *slog.Logger {
	if env == "local" {
		return slog.New(slog.NewTextHandler(os.Stdout, nil))
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, nil))
}
