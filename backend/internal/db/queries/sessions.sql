-- name: CreateSession :one
INSERT INTO sessions (id)
VALUES (gen_random_uuid())
RETURNING *;

-- name: GetSession :one
SELECT * FROM sessions
WHERE id = $1;

-- name: TouchSession :exec
UPDATE sessions
SET last_seen_at = now()
WHERE id = $1;
