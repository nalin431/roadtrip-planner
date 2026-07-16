# Architecture

This document covers the reasoning behind the stack, the database design, and
one genuinely tricky infrastructure problem this project ran into. It's
written for someone deciding whether the engineering here is real — an
interviewer, a reviewer, future-me.

## The problem this project actually solves

Most "AI trip planner" demos call an LLM and print whatever comes back. This
project replaces that with an actual optimization problem:

> Given a fixed, user-specified order of waypoints (start → stop 1 → stop 2 →
> ... → end), and a hard budget on how much extra distance/time you're
> willing to spend (a configurable percentage of the direct-route baseline),
> select which nearby points of interest to detour to, maximizing total "fun
> score" collected, without exceeding the budget.

This is a **budgeted prize-collecting insertion problem** — a variant of the
prize-collecting TSP / orienteering problem family. It's NP-hard in general
(exact solving requires evaluating an exponential number of insertion
subsets), so the practical approach is a polynomial-time greedy
approximation: for each candidate POI, compute the cheapest place to insert
it into the existing route (`Δdistance = dist(prev, poi) + dist(poi, next) -
dist(prev, next)`), rank candidates by `fun_score / Δdistance`, and greedily
insert the best-ranked candidate that still fits the remaining budget. This
is the same idea as the greedy algorithm for fractional knapsack, adapted to
a routing cost instead of a flat weight.

The scoped-down formulation (fixed waypoint order, one global detour budget)
was a deliberate simplification from an initial free-reordering,
per-day-time-window version — smaller, cleaner, and still a real algorithms
story without the combinatorial blowup of open-ended multi-day TSP.

**Status**: the solver itself (`backend/app/algorithm/mfp.py`) is designed
but not yet implemented — see the module's docstring for the planned
approach in detail. Everything around it (the trip data model, the POI
cache the solver will read from, the API surface it'll be called through) is
built and working.

## Why this stack

**Polyglot on purpose.** An all-TypeScript app (Next.js frontend + Next.js
API routes for the backend too) risks reading as "frontend developer who
added a database." Python/FastAPI for the backend is a different language,
different ecosystem, different deployment story — while still being
something the author can move fast and debug fluently in, which matters more
than the specific language chosen. (An earlier iteration of this backend was
Go; it got as far as working trip CRUD before being scrapped specifically
because debugging unfamiliar Go was costing more time than the "resume
polyglot" signal was worth. A backend you can't explain in an interview is a
worse outcome than a simpler one you can — see the git history around that
decision if you want the full reasoning.)

**Serverless because the traffic profile actually fits it, not as a
cost-cutting trick.** This is a portfolio demo with low, bursty traffic.
AWS Lambda's free tier (1M requests + 400,000 GB-seconds/month) and API
Gateway HTTP API's free tier comfortably cover that — realistically $0-2/mo.
Lambda + API Gateway is also itself a highly recognizable, real production
pattern, not a workaround.

**Supabase, used purely as managed Postgres.** No Supabase Auth/Storage/
Realtime lock-in — the schema is plain, portable Postgres, connection string
only. Free tier is generous enough for this scale, and the schema stays
portable to RDS later if it's ever needed.

**AWS CDK (TypeScript) for infrastructure**, defining Lambda, API Gateway,
IAM roles, and Secrets Manager from the start rather than console-clicking
resources that would need to be reconstructed later. This is a real, valued
skill (infrastructure as code) and keeps the entire AWS setup reviewable in
this repo (`infra/`) rather than tribal knowledge in someone's AWS console.

## Database schema

Five tables, each with one clear job:

- **`sessions`** — anonymous session tracking (no auth yet; `session_id`
  cookie today, a nullable `user_id` FK bolt-on later with no destructive
  migration needed).
- **`trips`** / **`trip_waypoints`** — what the user typed in: start/end
  points, fixed-order waypoints, and trip-level settings (days, detour
  budget %, max driving hours/day, preferred attraction types).
- **`pois`** / **`poi_cache_queries`** — the accumulating Google Places
  cache. `pois` stores individual points (an attraction with a lat/lng and a
  precomputed `fun_score`); `poi_cache_queries` tracks which
  `(geocell, category, radius)` searches have already been done, so repeat
  queries over overlapping corridors become free DB reads instead of new
  Places API calls. Keyed by a 5km geohash cell (`app/places/geohash.py`),
  TTL-based invalidation (30 days).
- **`trip_plans`** *(exists, not yet written to)* — the solver's computed
  output: final stop sequence, day split, total fun score, distance/time
  stats. Denormalized JSONB for the day-by-day breakdown, since it's
  read-mostly and always read whole.

`pois.fun_score` is precomputed at cache-write time as a general
popularity/quality score
(`0.6·normalize(rating) + 0.3·normalize(log(review_count)) +
0.1·categoryBoost(category)`); the solver will apply a *solve-time*
multiplier from the requesting trip's `preferred_attraction_types`, so the
same cached POI data stays reusable across different users' trips with
different preferences.

**Known, deliberately deferred gap**: the driving distance/duration between
two arbitrary points (from Google's Directions API) is not cached anywhere.
The solver's insertion-cost step will call Directions repeatedly — once per
candidate-insertion-point evaluation — which will be the most call-heavy,
least-cached part of the whole system once built. A `route_segments` table
keyed by rounded coordinate pairs would close this gap using the same
caching pattern already proven out for Places, and is the natural first
follow-up once the solver exists.

## The one real infrastructure wrinkle: Lambda + pgbouncer

Each concurrent Lambda invocation can open its own database connection. At
any real scale, that can exhaust Postgres's connection limit — a well-known
failure mode for serverless-plus-relational-database architectures, not
specific to this project.

**Mitigation**: use Supabase's built-in connection pooler (pgbouncer) in
**transaction mode** as the runtime `DATABASE_URL`, with a small connection
pool per Lambda instance (`pool_size=2` in `backend/app/db/session.py`,
mirroring the fact that each Lambda instance handles one invocation at a
time).

That introduces a second, less obvious problem: **pgbouncer's transaction
mode does not support server-side prepared statements across pooled
connections**. `asyncpg` (and SQLAlchemy's async engine on top of it)
defaults to using them, which surfaces as `prepared statement "..." already
exists` errors under load — the query works the first time, then fails
intermittently as pgbouncer reassigns the underlying connection between
calls. The fix, applied in `session.py`:

```python
connect_args={"statement_cache_size": 0}
```

This disables asyncpg's client-side statement cache, which is the direct
equivalent of `pgx`'s `QueryExecModeSimpleProtocol` fix from this project's
earlier Go iteration — same underlying pgbouncer constraint, same fix
shape, different driver.

**Migrations run against a different connection**: a session-mode pooler
connection (`DATABASE_URL_MIGRATE`, port 5432 instead of 6543), since Alembic
needs a persistent session for the duration of a migration run, which
transaction mode doesn't provide.

## API contract

Cross-origin by nature (Vercel's domain vs. API Gateway's `execute-api`
domain) — real CORS handling is required, which is itself a common
real-world deployment shape worth having configured correctly, not a
`localhost`-only demo. FastAPI's `CORSMiddleware` sets an explicit
`allow_origins` (the actual frontend origin, never `*`) with
`allow_credentials=True`; the session cookie is `SameSite=None; Secure`,
required for it to survive a cross-site request at all.

Error responses are a flat shape: `{"error": "message", "code":
"trip_not_found"}` with a matching HTTP status.

## Frontend

Next.js is intentionally a thin presentation layer — no direct database
access, all state flows through the FastAPI backend via
`frontend/src/lib/apiClient.ts`. The map (`MapComponent.tsx`) uses
`@googlemaps/js-api-loader`'s current `importLibrary`/`setOptions` API
(the `Loader` class is deprecated as of v2.1.1) with real
`@types/google.maps` typing throughout, rather than the manual
`<script>`-tag injection and `any`-typed globals a lot of Google-Maps-in-React
tutorials still show.
