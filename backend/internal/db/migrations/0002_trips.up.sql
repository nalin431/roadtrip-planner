CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id),
    name TEXT NOT NULL,
    start_location TEXT NOT NULL,
    start_lat DOUBLE PRECISION NOT NULL,
    start_lng DOUBLE PRECISION NOT NULL,
    end_location TEXT NOT NULL,
    end_lat DOUBLE PRECISION NOT NULL,
    end_lng DOUBLE PRECISION NOT NULL,
    is_return_trip BOOLEAN NOT NULL DEFAULT false,
    total_days INTEGER NOT NULL,
    max_driving_hours_per_day NUMERIC NOT NULL DEFAULT 8,
    detour_budget_pct NUMERIC NOT NULL DEFAULT 10,
    budget NUMERIC,
    preferred_attraction_types TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trips_session_id ON trips(session_id);

CREATE TABLE trip_waypoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    location TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    sequence INTEGER NOT NULL
);

CREATE INDEX idx_trip_waypoints_trip_id ON trip_waypoints(trip_id);
