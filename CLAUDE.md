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

`frontend/src/app/page.tsx` holds a single `trip: Trip | null` in state (no global store). `TripForm` calls `apiClient.createTrip()` (`frontend/src/lib/apiClient.ts`, a typed `fetch` wrapper with `credentials: "include"` for the session cookie) which POSTs to the FastAPI backend and gets back the created `Trip`. That `Trip` is passed down to `MapComponent` and `TripSummary`. There is no `onTripPlanUpdate`/`onDayPlansUpdate` callback threading anymore — components receive `trip` as a prop and the page owns the one `setTrip` call.

The backend (`backend/app/`) is a normal FastAPI app (`app/main.py`) with `CORSMiddleware` configured for an explicit `allowed_origin` (never `*`, required for the `SameSite=None; Secure` session cookie to work cross-origin). `app/lambda_handler.py` is `Mangum(app)` — the Lambda entrypoint; the FastAPI app itself has zero Lambda-specific code, so `uvicorn app.main:app` works identically for local dev.

Current endpoints (`app/api/trips.py`, `app/api/healthz.py`):
```
POST   /api/trips          # create trip
GET    /api/trips/{id}     # fetch trip
PATCH  /api/trips/{id}      # update trip metadata/prefs
GET    /api/healthz         # liveness check
```
`POST/GET /api/trips/{id}/plan` (run the solver, fetch computed plan) is planned but not yet built — it depends on `app/algorithm/mfp.py`, which is unimplemented (see below).

### The Most-Fun Path algorithm — NOT YET IMPLEMENTED

`backend/app/algorithm/mfp.py` has the full problem statement and planned approach in its module docstring, real type signatures (`solve(input: MfpInput, max_solve_time_ms: int = 3000) -> MfpResult`, `split_into_days(...)`), but both functions are `raise NotImplementedError` stubs. This is the actual centerpiece of the project and the main piece of unfinished work — see "What's not done yet."

Planned shape once built: fixed waypoint order (no reordering), shortest-path baseline via a routing API, greedy insertion of nearby POIs ranked by `fun_score / Δdistance` until a detour budget (`trip.detour_budget_pct`, default 10%, adjustable via `DetourDial.tsx` in the frontend) is exhausted, optional bounded 2-opt refinement, then a separate day-splitting post-process. `app/algorithm` is deliberately pure Python with zero HTTP/DB dependencies for easy unit testing (the one place tests exist despite testing being otherwise deferred).

### POI caching (built and working)

`backend/app/places/` — `client.py` (server-side `httpx` client for Google Places, key never reaches the browser), `geohash.py` (5km geocell bucketing), `cache.py` (read-through cache against `pois`/`poi_cache_queries` tables, TTL 30 days), `score.py` (`fun_score = 0.6·normalize(rating) + 0.3·normalize(log(review_count)) + 0.1·categoryBoost(category)`). Has unit tests (`app/places/tests/test_geohash.py`). Not yet wired to any endpoint — nothing calls `cache.py` from `app/api/` yet, since that wiring is part of the unbuilt `/plan` endpoint.

### Database (Supabase Postgres, SQLAlchemy + Alembic)

Five tables — `sessions`, `trips`, `trip_waypoints`, `pois`, `poi_cache_queries`, plus `trip_plans` (migration exists but no code writes to it yet, since the solver that would populate it isn't built). Models in `backend/app/db/models.py`, one baseline Alembic migration in `app/db/migrations/versions/`. Full schema and design rationale in `ARCHITECTURE.md`.

**Lambda + pgbouncer gotcha**: `DATABASE_URL` must point at Supabase's transaction-mode pooler (port 6543) with `connect_args={"statement_cache_size": 0}` in `app/db/session.py` (pgbouncer transaction mode doesn't support asyncpg's server-side prepared statement cache across pooled connections). Migrations use `DATABASE_URL_MIGRATE`, the session-mode pooler (port 5432), since Alembic needs a persistent session. Full explanation in `ARCHITECTURE.md`.

### Frontend components

`TripForm.tsx` (form + `DetourDial.tsx` for the detour-budget-% slider, calls `apiClient.createTrip`), `MapComponent.tsx` (uses `@googlemaps/js-api-loader`'s `importLibrary`/`setOptions` API and real `@types/google.maps` typing — no manual `<script>` injection, no `any`-typed globals), `TripSummary.tsx`. All components are `'use client'`, path alias `@/*` → `src/*`.

Since the `/plan` endpoint doesn't exist yet, the frontend currently only exercises trip create/fetch/update — there's no day-by-day itinerary rendering wired up yet because there's no solver output to render.

## What's not done yet (relative to the build plan)

This is the main gap between the original plan and current state — check here before assuming something is finished:

1. **The MFP algorithm itself** (`app/algorithm/mfp.py`) — stubbed, `raise NotImplementedError`. This is the next real piece of work.
2. **`POST/GET /api/trips/{id}/plan` endpoints** — don't exist yet; blocked on the algorithm.
3. **Places cache is not wired to any endpoint** — `app/places/cache.py` works and is tested in isolation, but nothing in `app/api/` calls it yet.
4. **AWS is not actually deployed.** CDK stacks (`infra/lib/*.ts`) are written and have unit tests (`infra/test/stacks.test.ts`, checked via `cdk synth`-style assertions), but `cdk deploy` has not been run against a real AWS account — no live Lambda, no live API Gateway, no Secrets Manager values set. Locally the backend runs via `uvicorn` against `.env`, not against deployed infra.
5. **Frontend is not deployed to Vercel** — runs locally against `localhost:8000` only.
6. **Per-session/IP daily Places quota** (mentioned in the plan as a cost-control measure) — not implemented, moot until the `/plan` endpoint exists to trigger Places calls.
7. **`route_segments` caching for Directions API calls** — explicitly deferred stretch goal, not started.
8. **Auth** — schema is auth-ready (nullable `user_id` bolt-on) but no `users` table or auth flow exists.

## Conventions

- Backend: `ruff` (`select = ["E", "F", "I", "UP", "B"]`, `B008` ignored deliberately for FastAPI's `Depends(...)` pattern) and `mypy` (`disallow_untyped_defs = false` — type hints encouraged, not strictly enforced everywhere). Line length 110.
- Frontend: TypeScript `strict`. Google Maps is now properly typed via `@types/google.maps` (unlike the old app's `any`-typed approach).
- Error responses from the backend are a flat shape: `{"error": "message", "code": "trip_not_found"}` with a matching HTTP status.
- Components never hold their own copy of trip state — `page.tsx` is the single owner; components call back up via props/callbacks rather than diverging local copies.
