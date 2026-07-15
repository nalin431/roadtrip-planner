-- name: CreateTrip :one
INSERT INTO trips (
    session_id, name, start_location, start_lat, start_lng,
    end_location, end_lat, end_lng, is_return_trip, total_days,
    max_driving_hours_per_day, detour_budget_pct, budget, preferred_attraction_types
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
)
RETURNING *;

-- name: GetTrip :one
SELECT * FROM trips
WHERE id = $1;

-- name: UpdateTrip :one
UPDATE trips
SET name = $2,
    total_days = $3,
    max_driving_hours_per_day = $4,
    detour_budget_pct = $5,
    budget = $6,
    preferred_attraction_types = $7,
    status = $8,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: CreateTripWaypoint :one
INSERT INTO trip_waypoints (trip_id, location, lat, lng, sequence)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListTripWaypoints :many
SELECT * FROM trip_waypoints
WHERE trip_id = $1
ORDER BY sequence ASC;
