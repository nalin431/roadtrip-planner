# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project layout

The Next.js app lives in the `roadtrip-planner/` subdirectory, not the repo root. Run all commands from `roadtrip-planner/`. The repo-root `package-lock.json` is a stray artifact — ignore it.

## Commands

```bash
cd roadtrip-planner
npm install
npm run dev      # dev server (Next 15 + Turbopack) on http://localhost:3000
npm run build    # production build
npm run start    # serve production build
npm run lint     # next lint (ESLint 9, eslint-config-next)
```

There is no test runner configured. `test-basic.html` and `STATUS.md` are manual browser-based debugging aids, not automated tests.

## Environment variables

Both keys are `NEXT_PUBLIC_*`, meaning they are **exposed to the browser**. Put them in `roadtrip-planner/.env.local`:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_OPENAI_API_KEY=...
```

The OpenAI client runs client-side with `dangerouslyAllowBrowser: true` (`src/utils/aiService.ts`). This is a demo/prototype pattern — the API key ships to every visitor. Any move toward production should relocate OpenAI calls behind a server route or Server Action and drop the `NEXT_PUBLIC_` prefix.

## Architecture

Single-page client app. `src/app/page.tsx` owns all shared state — `tripPlan: TripPlan | null` and `dayPlans: DayPlan[]` — and passes it plus updater callbacks down to every component. There is no global store, router, or persistence; refreshing the page loses everything.

Two independent planning paths, chosen by the `useAI` checkbox in `TripForm`:

- **Basic path** (`useAI` off): `TripForm` synchronously calls `createBasicTripPlan` (`src/utils/basicTripPlanner.ts`), which slices the user's stops evenly across days and attaches hardcoded mock attractions/accommodations. No API keys needed.
- **AI path** (`useAI` on, the default): `TripForm` only builds the skeleton `TripPlan`. The `AITripPlanner` component (rendered only when `tripPlan.useAI`) has a separate "Generate" button that calls `generateAITripPlan` → GPT-4, then maps the AI response (`AIDayPlan`/`AIAttraction` shapes in `aiService.ts`) into the app's `DayPlan`/`Attraction` types via `convertAIDayPlanToDayPlan`.

Both paths converge on the same `DayPlan[]`, which flows to `TripSummary` (budget/stats) and `MapComponent`.

### Key type distinction

`src/types/trip.ts` defines the canonical app types (`TripPlan`, `DayPlan`, `Attraction`, ...). `src/utils/aiService.ts` defines a **separate** parallel set (`AITripPlan`, `AIDayPlan`, `AIAttraction`) matching the JSON structure requested from GPT-4. These are deliberately different shapes; `AITripPlanner.convertAIDayPlanToDayPlan` is the bridge. When changing the AI JSON schema, update the prompt string, the `AI*` interfaces, and the converter together.

### Map behavior — important gotcha

`MapComponent` loads the Google Maps JS SDK by injecting a `<script>` tag, then draws routes with `DirectionsService`/`DirectionsRenderer` and searches POIs with `PlacesService`. Its per-day route calculation reads `dayPlan.stops`, **but AI-generated day plans set `stops: []`** (see the converter). So for AI plans the day-route calculation no-ops and only `showBasicRoute()` (driven by top-level `tripPlan.stops`) actually renders a line. This is a known rough edge — the map does not reflect AI day-by-day routing.

### Data-flow contract

Components never mutate `tripPlan`/`dayPlans` directly; they call the `onTripPlanUpdate` / `onDayPlansUpdate` callbacks threaded from `page.tsx`. Preserve this pattern when adding features rather than introducing local copies of the plan.

## Conventions

- App Router, all components are `'use client'`. Path alias `@/*` → `src/*`.
- Google Maps objects are typed as `any` (no `@types/google.maps` usage in `MapComponent` despite the dep); TypeScript is otherwise `strict`.
- The codebase is heavily instrumented with `console.log` for debugging the plan/day-plan/map flow (see `STATUS.md`). Leave or extend these when debugging the same paths.
