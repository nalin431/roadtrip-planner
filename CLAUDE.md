# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A road trip planner built around a real optimization problem (the "Most-Fun Path" / MFP solver) rather than an LLM wrapper. Polyglot by design: Next.js/React frontend, Python/FastAPI backend, AWS CDK (TypeScript) infra. See `ARCHITECTURE.md` for the full reasoning and interview-facing writeup; `C:\Users\nalin\.claude\plans\as-you-can-see-nifty-cocoa.md` is the original build plan (largely executed — see "What's not done yet" below).

An earlier iteration was a single-page Next.js app that called OpenAI directly from the browser (`NEXT_PUBLIC_OPENAI_API_KEY`, `dangerouslyAllowBrowser: true`). That code path is fully deleted. If you see references to `aiService.ts`, `basicTripPlanner.ts`, `AITripPlanner.tsx`, or `useAI`, they no longer exist — do not resurrect that pattern.

## Project layout

```
frontend/    Next.js 15 / React 19 app (Vercel-deployed) — presentation only, no DB access
backend/     Python/FastAPI app (deployed as a Lambda via Mangum) — all business logic
infra/       AWS CDK (TypeScript) — Lambda, API Gateway, Secrets Manager, budget alarm stacks
```

Run all commands from the relevant subdirectory, not the repo root. The repo-root `package-lock.json` is a stray artifact — ignore it.

## Commands

**Frontend** (`frontend/`):
```bash
npm install
npm run dev      # dev server (Next 15 + Turbopack) on http://localhost:3000
npm run build    # production build
npm run start    # serve production build
npm run lint     # next lint (ESLint 9, eslint-config-next)
```

**Backend** (`backend/`, Python 3.12, dependency management via `uv`/`pyproject.toml`):
```bash
uvicorn app.main:app --reload --port 8000   # local dev server
pytest                                       # runs app/algorithm and app/places tests
ruff check .                                 # lint
mypy .                                       # type check
alembic upgrade head                         # run migrations (needs DATABASE_URL_MIGRATE, session-mode pooler)
```

**Infra** (`infra/`):
```bash
npm install
npm run build   # tsc
npm test        # jest — infra/test/stacks.test.ts
npx cdk synth   # render CloudFormation without deploying
npx cdk deploy  # deploy (not yet done for real — see below)
```

CI (`.github/workflows/ci.yml`) runs ruff/mypy/pytest for the backend and next lint/tsc for the frontend.

## Environment variables

**Frontend** (`frontend/.env.local`, browser-exposed via `NEXT_PUBLIC_*`):
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...   # restrict by HTTP referrer in Google Cloud Console
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Backend** (`backend/.env`, server-side only, never shipped to the browser):
```
APP_ENV=local
PORT=8000
DATABASE_URL=...            # Supabase pooler, transaction mode (port 6543) — runtime queries
DATABASE_URL_MIGRATE=...    # Supabase pooler, session mode (port 5432) — Alembic only
ALLOWED_ORIGIN=http://localhost:3000
GOOGLE_PLACES_API_KEY=...
```

In production these are meant to come from AWS Secrets Manager (`infra/lib/secrets-stack.ts` references `roadtrip-planner/google-places-api-key` and a database URL secret by name) rather than being hardcoded — but see "What's not done yet," this deploy step hasn't happened.

## Architecture

### Data flow

`frontend/src/app/page.tsx` holds two pieces of state: `trip: Trip | null` and `plan: TripPlan | null` (no global store). `TripForm` calls `apiClient.createTrip()` (`frontend/src/lib/apiClient.ts`, a typed `fetch` wrapper with `credentials: "include"` for the session cookie) which POSTs to the FastAPI backend and gets back the created `Trip`; `page.tsx`'s `handleTripCreated` sets `trip` and resets `plan` to `null` (a new trip invalidates any previously solved plan). `TripSummary` renders a "Find the most fun path" button when `plan` is absent; clicking it calls `apiClient.createPlan(trip.id)` (`POST /api/trips/{id}/plan`) and reports the result up via `onPlanCreated`, which `page.tsx` uses to set `plan`. Both `trip` and `plan` are passed down to `MapComponent` and `TripSummary` as props — components never hold their own copy, they call back up via `onTripCreated`/`onPlanCreated`.

The backend (`backend/app/`) is a normal FastAPI app (`app/main.py`) with `CORSMiddleware` configured for an explicit `allowed_origin` (never `*`, required for the `SameSite=None; Secure` session cookie to work cross-origin). `app/lambda_handler.py` is `Mangum(app)` — the Lambda entrypoint; the FastAPI app itself has zero Lambda-specific code, so `uvicorn app.main:app` works identically for local dev.

Current endpoints (`app/api/trips.py`, `app/api/plan.py`, `app/api/healthz.py`):
```
POST   /api/trips               # create trip
GET    /api/trips/{id}          # fetch trip
PATCH  /api/trips/{id}          # update trip metadata/prefs
POST   /api/trips/{id}/plan     # run the MFP solver, persist + return a trip_plans row
GET    /api/trips/{id}/plan     # fetch the most recent computed plan
GET    /api/healthz             # liveness check
```
`POST /api/trips/{id}/plan` loads the trip + waypoints, gathers candidate POIs via `PlacesCache.get_candidates_along_route()` (new method — queries the existing read-through cache around the midpoint of each route leg, deduped by `google_place_id`), builds an `MfpInput`, calls `solve()` + `split_into_days()`, and persists the result as a `TripPlan` row. Each stop in the persisted `day_plans_json` is enriched with `name`/`category`/`funScore` when it's a solver-inserted POI (matched from `MfpResult.selected_stops` by point equality — `None` for the user's original waypoints/start/end), so the frontend can render what the algorithm actually picked rather than unlabeled coordinates. `GET` just fetches the latest `TripPlan` for a trip. Verified manually end-to-end against live Supabase + live Google Places — trip create → `/plan` → real detour stop inserted within budget → `GET /plan` returns the persisted result.

### The Most-Fun Path algorithm — IMPLEMENTED and wired to `/plan`

`backend/app/algorithm/mfp.py` implements `solve(input: MfpInput, max_solve_time_ms: int = 3000) -> MfpResult` and `split_into_days(result, total_days, max_driving_hours_per_day) -> list[list[Point]]`. Scope decision made explicitly: **greedy heuristic, not an exact solver** — the candidate-count and Lambda-timeout realities make exponential/exact approaches (ILP, bitmask DP) not worth the complexity here; see `ARCHITECTURE.md` for the full reasoning.

Shape: fixed waypoint order (no reordering), shortest-path baseline computed via haversine distance (`app/algorithm/geo.py` — there's no cached routing/Directions API yet, see gap #7 below), then greedy insertion: for each remaining candidate POI, find its cheapest insertion edge in the current route (`Δdistance = dist(prev,poi) + dist(poi,next) - dist(prev,next)`), rank by `fun_score / Δdistance`, insert the best-ranked one that still fits the remaining detour budget (`trip.detour_budget_pct`, default 10%, adjustable via `DetourDial.tsx` in the frontend), repeat — recomputing every candidate's best edge each iteration since the route shape changes. Followed by a wall-clock-bounded 2-opt cleanup pass (bounded by `max_solve_time_ms`), then `split_into_days()` as a separate, simpler post-process — each day boundary point appears exactly once across the output (day N's last stop and day N+1's first stop are geographically adjacent but never the same list entry duplicated across both days; this was a real bug caught during code review and fixed at the source, see `test_split_into_days_boundary_point_not_duplicated_across_days`). `app/algorithm` is deliberately pure Python with zero HTTP/DB dependencies for easy unit testing (the one place tests exist despite testing being otherwise deferred) — `app/algorithm/tests/test_mfp.py`, 12 table-driven cases covering budget-never-exceeded, value-over-cost ranking, waypoint-order preservation, day-splitting (including the boundary-duplication regression test), and a 150-candidate timing check. Duration estimates use a flat average-speed constant in `geo.py` pending real routing data.

### POI caching (built, working, and wired to `/plan`)

`backend/app/places/` — `client.py` (server-side `httpx` client for Google Places, key never reaches the browser), `geohash.py` (5km geocell bucketing), `cache.py` (read-through cache against `pois`/`poi_cache_queries` tables, TTL 30 days, plus `get_candidates_along_route()` for gathering candidates over a whole fixed route), `score.py` (`fun_score = 0.6·normalize(rating) + 0.3·normalize(log(review_count)) + 0.1·categoryBoost(category)`), `deps.py` (new — `get_places_cache()`, an `lru_cache`d singleton `PlacesCache`/`PlacesClient` FastAPI dependency, mirroring the DB engine's module-level lifecycle). Has unit tests (`app/places/tests/test_geohash.py`). Now called from `app/api/plan.py`.

### Database (Supabase Postgres, SQLAlchemy + Alembic)

Five tables — `sessions`, `trips`, `trip_waypoints`, `pois`, `poi_cache_queries`, plus `trip_plans` (in the baseline migration; now actively written to by `POST /api/trips/{id}/plan`). Models in `backend/app/db/models.py`, one baseline Alembic migration in `app/db/migrations/versions/`. Full schema and design rationale in `ARCHITECTURE.md`.

**Lambda + pgbouncer gotcha**: `DATABASE_URL` must point at Supabase's transaction-mode pooler (port 6543) with `connect_args={"statement_cache_size": 0}` in `app/db/session.py` (pgbouncer transaction mode doesn't support asyncpg's server-side prepared statement cache across pooled connections). Migrations use `DATABASE_URL_MIGRATE`, the session-mode pooler (port 5432), since Alembic needs a persistent session. Full explanation in `ARCHITECTURE.md`.

### Frontend components

`TripForm.tsx` (form + `DetourDial.tsx` for the detour-budget-% slider, calls `apiClient.createTrip`), `LocationAutocomplete.tsx` (new — wraps Google's `PlaceAutocompleteElement`, used by `TripForm.tsx` for start/end/waypoint entry instead of manual lat/lng text boxes; selecting a suggestion atomically resolves a name + lat/lng pair), `MapComponent.tsx` (uses `@googlemaps/js-api-loader`'s `importLibrary`/`setOptions` API and real `@types/google.maps` typing — no manual `<script>` injection, no `any`-typed globals), `TripSummary.tsx`. All components are `'use client'`, path alias `@/*` → `src/*`.

**The frontend is now fully wired to `/plan`.** `apiClient.createPlan(tripId)` calls `POST /api/trips/{id}/plan`; `TripSummary.tsx` shows a "Find the most fun path" button that triggers the solve and, once a `TripPlan` exists, renders a day-by-day breakdown (fun score, distance, duration, and per-stop name/category for solver-inserted POI stops). `MapComponent.tsx` accepts a `plan: TripPlan | null` prop — when present, it draws the solved route (flattened `dayPlans` stops, minus the true start/end) instead of the direct route through `trip.waypoints`, and places visually distinct `AdvancedMarkerElement`/`PinElement` markers for inserted POI stops (identified by having a non-null `name`) alongside the default `DirectionsRenderer` markers.

**Real bug found and fixed during this work, worth knowing about**: `LocationAutocomplete.tsx`'s Google Places event handler originally read `event.place` directly, following `@types/google.maps`'s typed shape for `PlaceAutocompletePlaceSelectEvent` — but that type is annotated beta-channel-only in the `.d.ts`, while this app loads the stable `v=weekly` channel. The stable channel's real `gmp-select` event carries `{ placePrediction }` instead, which needs `.toPlace()` called on it to get a `Place`. Fixed to use `event.placePrediction.toPlace()` (matching Google's own current public documentation sample), with a documented `as unknown as {...}` cast since no exported type in this `@types` version models the stable-channel event shape. **Not yet confirmed via a live browser click-through** — verified by static type-level inspection against the `.d.ts` and Google's docs only; a manual test of the actual autocomplete-select flow is still outstanding.

## What's not done yet (relative to the build plan)

This is the main gap between the original plan and current state — check here before assuming something is finished:

1. ~~The MFP algorithm itself~~ — **done**, see `app/algorithm/mfp.py` above.
2. ~~`POST/GET /api/trips/{id}/plan` endpoints~~ — **done**, see `app/api/plan.py` above; verified manually against live Supabase + Places.
3. ~~Places cache is not wired to any endpoint~~ — **done**, called from `app/api/plan.py` via `get_candidates_along_route()`.
4. ~~Frontend not wired to `/plan`~~ — **done**, see "Frontend components" above (`apiClient.createPlan`, solve button, day-by-day rendering, solved-route map drawing). **Still outstanding: a live browser click-through** of the full flow (autocomplete select → solve → rendered map/summary) hasn't been done yet — the Google Places event-shape fix in particular is only verified statically so far.
5. ~~Manual lat/lng entry in TripForm~~ — **done**, replaced with `LocationAutocomplete.tsx` (Google Places Autocomplete). Known gap: the `LocationAutocomplete` component's `disabled` prop is currently inert (applied as a `data-disabled` attribute with no CSS/logic consuming it) — the End field doesn't visually or functionally disable when "loop back to start" is checked, unlike the old manual inputs did.
6. **AWS is not actually deployed.** CDK stacks (`infra/lib/*.ts`) are written and have unit tests (`infra/test/stacks.test.ts`, checked via `cdk synth`-style assertions), but `cdk deploy` has not been run against a real AWS account — no live Lambda, no live API Gateway, no Secrets Manager values set. Locally the backend runs via `uvicorn` against `.env`, not against deployed infra.
7. **Frontend is not deployed to Vercel** — runs locally against `localhost:8000` only.
8. **Per-session/IP daily Places quota** (mentioned in the plan as a cost-control measure) — not implemented, moot until the `/plan` endpoint exists to trigger Places calls.
9. **`route_segments` caching for Directions API calls** — explicitly deferred stretch goal, not started.
10. **Auth** — schema is auth-ready (nullable `user_id` bolt-on) but no `users` table or auth flow exists.

## Conventions

- Backend: `ruff` (`select = ["E", "F", "I", "UP", "B"]`, `B008` ignored deliberately for FastAPI's `Depends(...)` pattern) and `mypy` (`disallow_untyped_defs = false` — type hints encouraged, not strictly enforced everywhere). Line length 110.
- Frontend: TypeScript `strict`. Google Maps is now properly typed via `@types/google.maps` (unlike the old app's `any`-typed approach).
- Error responses from the backend are a flat shape: `{"error": "message", "code": "trip_not_found"}` with a matching HTTP status.
- Components never hold their own copy of trip state — `page.tsx` is the single owner; components call back up via props/callbacks rather than diverging local copies.
