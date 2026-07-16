package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/nalin431/roadtrip-planner/backend/internal/db/sqlc"
	"github.com/nalin431/roadtrip-planner/backend/internal/session"
)

type Server struct {
	logger  *slog.Logger
	queries *sqlc.Queries
}

func NewRouter(logger *slog.Logger, allowedOrigin string, queries *sqlc.Queries) http.Handler {
	s := &Server{logger: logger, queries: queries}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(requestLogger(logger))
	r.Use(middleware.Recoverer)
	r.Use(cors(allowedOrigin))

	r.Get("/api/healthz", s.handleHealthz)

	r.Group(func(r chi.Router) {
		r.Use(session.Middleware(logger, queries))
		r.Post("/api/trips", s.handleCreateTrip)
		r.Get("/api/trips/{id}", s.handleGetTrip)
		r.Patch("/api/trips/{id}", s.handleUpdateTrip)
	})

	return r
}

func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": message, "code": code})
}
