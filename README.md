# Most-Fun Path — Road Trip Planner

A road trip planner built around a real routing problem: given a fixed-order
sequence of stops, how far off the direct path is it worth detouring to pick
up something worth seeing? Next.js frontend, Python/FastAPI backend on AWS
Lambda, Postgres via Supabase.

**Status**: the trip-logging flow (create a trip, log stops in order, see the
direct route on a map) is fully working end-to-end. The actual Most-Fun-Path
solver — the algorithmic centerpiece — is designed but not yet implemented;
see `ARCHITECTURE.md` for the problem formulation and planned approach.

## Why this exists

The earlier version of this project called an LLM from the browser to
generate an itinerary. That's a weak engineering story — no algorithm, and
the API key shipped to every visitor. This rebuild replaces that with a real
optimization problem (a budgeted variant of prize-collecting insertion,
NP-hard in general) and a proper client/server split: Next.js is a thin
presentation layer with no direct database access, FastAPI owns all business
logic, and nothing sensitive touches the browser.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 / React 19 | Deployed to Vercel |
| Backend | Python / FastAPI, on AWS Lambda via Mangum | Serverless fits this project's low/bursty traffic honestly, not as a cost dodge |
| Database | Postgres via Supabase | Portable schema, no vendor lock-in beyond the connection string |
| IaC | AWS CDK (TypeScript) | Lambda, API Gateway, Secrets Manager, billing alarm — all reviewable in this repo, not console-clicked |
| POI data | Google Places API, server-side only, geohash-bucketed Postgres cache | Closes the key-exposure hole the old version had; avoids repeat-querying the same corridor |

See `ARCHITECTURE.md` for the reasoning behind each of these, including the
one genuinely tricky part of the stack (running SQLAlchemy/asyncpg against
Supabase's transaction-mode connection pooler from Lambda).

## Repo layout

```
frontend/    Next.js app (presentation only)
backend/     FastAPI app (all business logic: trips API, Places cache, the solver)
infra/       AWS CDK stacks (Lambda, API Gateway, Secrets Manager, budget alarm)
```

## Running locally

### Backend

```bash
cd backend
uv sync
cp .env.example .env   # fill in DATABASE_URL, ALLOWED_ORIGIN, GOOGLE_PLACES_API_KEY
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

Needs a Postgres database — a free Supabase project works, or any local
Postgres. `DATABASE_URL` should point at Supabase's **transaction-mode
pooler** connection string if using Supabase (see `ARCHITECTURE.md` for why).

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend expects the
backend running at `http://localhost:8000` by default
(`NEXT_PUBLIC_API_BASE_URL`).

### Tests

```bash
cd backend && uv run pytest
cd frontend && npx tsc --noEmit && npm run lint
cd infra && npm test
```

## Deployment

Not yet live — `infra/README.md` has the full CDK deploy walkthrough once an
AWS account and Docker are available. Frontend deploys to Vercel; backend
deploys as a Lambda function behind an API Gateway HTTP API.

## License

MIT.
