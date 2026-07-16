package session

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nalin431/roadtrip-planner/backend/internal/db/sqlc"
)

const cookieName = "session_id"

type ctxKey struct{}

// Middleware ensures every request carries a valid session: reads the session_id
// cookie if present and the session still exists, otherwise creates a new session
// row and sets a fresh cookie. The resolved session ID is stashed in the request
// context for handlers to read via FromContext.
func Middleware(logger *slog.Logger, queries *sqlc.Queries) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			sessionID, ok := existingSession(ctx, queries, r)

			if !ok {
				created, err := queries.CreateSession(ctx)
				if err != nil {
					logger.Error("create session failed", "error", err)
					http.Error(w, "failed to create session", http.StatusInternalServerError)
					return
				}
				sessionID = created.ID
				setCookie(w, sessionID)
			} else {
				_ = queries.TouchSession(ctx, sessionID)
			}

			ctx = context.WithValue(ctx, ctxKey{}, sessionID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func existingSession(ctx context.Context, queries *sqlc.Queries, r *http.Request) (pgtype.UUID, bool) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return pgtype.UUID{}, false
	}

	var id pgtype.UUID
	if err := id.Scan(cookie.Value); err != nil {
		return pgtype.UUID{}, false
	}

	if _, err := queries.GetSession(ctx, id); err != nil {
		return pgtype.UUID{}, false
	}

	return id, true
}

func setCookie(w http.ResponseWriter, id pgtype.UUID) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    id.String(),
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteNoneMode,
		Expires:  time.Now().Add(180 * 24 * time.Hour),
	})
}

// FromContext returns the current request's session ID, set by Middleware.
func FromContext(ctx context.Context) (pgtype.UUID, bool) {
	id, ok := ctx.Value(ctxKey{}).(pgtype.UUID)
	return id, ok
}
