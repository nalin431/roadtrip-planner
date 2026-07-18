# Geocoding + Solved-Plan Rendering — Design

## Problem

Two related gaps between what the backend can do and what the frontend exposes:

1. **No real geocoding.** `TripForm.tsx` requires the user to manually type numeric
   lat/lng into separate text boxes next to every location field (start, end, each
   waypoint) — there's no autocomplete, no click-on-map, no address resolution. The
   component's own comment flags this as deliberately deferred.
2. **The solver's output is invisible.** `POST/GET /api/trips/{id}/plan` exist and work
   (verified manually end-to-end against live Supabase + Google Places), but nothing in
   the frontend calls them. `MapComponent.tsx` only ever draws the user's raw
   start/end/waypoints; `TripSummary.tsx` has a literal placeholder string saying the
   solver "isn't wired up yet."

This spec covers closing both gaps in one pass, since they touch the same components
(`TripForm`, `MapComponent`, `TripSummary`, `page.tsx`) and fixing geocoding removes the
main reason the manual-coordinate workaround existed.

## Decisions made (see brainstorming session for full rationale)

- **Geocoding: Google Places Autocomplete**, not Nominatim or Photon. The project
  already pays for and integrates Google Maps JS SDK + Places API elsewhere
  (`MapComponent.tsx`, `app/places/client.py`); reusing that billing/config is marginal
  work, versus a free OSM-family geocoder being a brand-new integration with its own
  rate-limit or reliability tradeoffs (same category of decision as the earlier
  Overpass/OSRM discussion, resolved the same direction).
- **Solve trigger: explicit "Solve route" button**, not automatic-on-create or
  debounced-on-change. The solve is not instant (live Places API call on cache miss +
  greedy/2-opt compute) and there's no per-session Places quota yet (a known deferred
  gap) — an explicit button makes the wait legible and avoids burning an API call on
  every trip creation regardless of whether the user wants a solve yet.
- **Rendering: both map and summary.** `MapComponent` draws the solved route with
  inserted detour stops visually distinguished from the user's original stops;
  `TripSummary` shows a day-by-day breakdown.
- **Backend response enrichment:** `dayPlans` stops currently carry only `{lat, lng}`.
  This is enriched with optional `name`/`category`/`funScore` for inserted POI stops, so
  the UI can show what the algorithm actually picked rather than unlabeled dots.

## Design

### 1. Geocoding (`frontend/src/components/`)

New `LocationAutocomplete.tsx`: wraps the Google Maps JS SDK's `places` library
`PlaceAutocompleteElement` (loaded via `importLibrary('places')`, the same
loader pattern `MapComponent.tsx` already uses for `maps`/`routes` — no new API key, no
new loader setup). Props: `onPlaceSelected: (name: string, lat: number, lng: number) => void`.
As the user types, Google's own dropdown of address matches appears; selecting one fires
the callback with name + coordinates together, atomically.

`TripForm.tsx` changes:
- Replace the 3-input group (`text` name + `text` lat + `text` lng) for **start** and
  **end** with one `LocationAutocomplete` each. `startLat`/`startLng`/`endLat`/`endLng`
  state stays (still needed for the `CreateTripRequest` payload), just no longer
  hand-typed — set via `onPlaceSelected`.
- Replace `waypointDraft`'s `{location, lat, lng}` text-input row the same way: one
  `LocationAutocomplete` plus the existing "Add stop" button. `waypointDraft` becomes
  `{location: string, lat: number, lng: number} | null` (no selection = null = "Add
  stop" disabled), rather than three separate raw strings.
- `isValid` simplifies from "lat/lng parse as numbers" to "a place was selected"
  (non-null lat/lng state).
- The "loop back to start" checkbox behavior (copying start → end fields) is unchanged,
  just now copies the resolved place instead of raw strings.

No backend changes needed for this part — `CreateTripRequest` already accepts
numeric lat/lng; only how the frontend obtains them changes.

### 2. Solve trigger (`TripSummary.tsx`, `page.tsx`, `apiClient.ts`, `types/trip.ts`)

`frontend/src/types/trip.ts` gains a `TripPlan` interface mirroring the enriched
`PlanResponse` (see part 3):

```ts
export interface PlanStop {
  lat: number;
  lng: number;
  name?: string;
  category?: string;
  funScore?: number;
}

export interface DayPlan {
  stops: PlanStop[];
}

export interface TripPlan {
  id: string;
  tripId: string;
  algorithmVersion: string;
  dayPlans: DayPlan[];
  totalFunScore: number;
  totalDistanceM: number;
  totalDurationS: number;
  solveTimeMs: number;
  createdAt: string;
}
```

`apiClient.ts` gains:
```ts
createPlan(tripId: string): Promise<TripPlan> {
  return request<TripPlan>(`/api/trips/${tripId}/plan`, { method: "POST" });
}
```

`page.tsx` gains a second state slot: `const [plan, setPlan] = useState<TripPlan | null>(null)`.
`onTripCreated` (passed to `TripForm`) is wrapped to also reset `plan` to `null` — a new
trip invalidates any previously solved plan. `TripSummary` and `MapComponent` both
receive `plan` as a new prop.

`TripSummary.tsx` gains:
- A "Find the most fun path" button, shown when `trip` exists and `plan` is `null`.
- On click: call `apiClient.createPlan(trip.id)`, set a local `isSolving` loading state
  (button text → "Solving…", disabled), call `onPlanCreated(plan)` (new callback prop,
  same pattern as `TripForm`'s `onTripCreated`) on success, or render an inline error
  (same `ApiRequestError` → message pattern `TripForm` already uses) on failure.
- Replaces the "solver isn't wired up yet" placeholder block with a day-by-day
  breakdown when `plan` is present (see part 4).

### 3. Backend response enrichment (`backend/app/api/plan.py`)

`PointOut` gains optional fields:
```python
class PointOut(BaseModel):
    lat: float
    lng: float
    name: str | None = None
    category: str | None = None
    fun_score: float | None = Field(default=None, serialization_alias="funScore")
```

`create_plan()`'s day-building step changes from flattening raw `Point`s to looking up
each stop against `result.selected_stops` (keyed by matching `(lat, lng)` — selected
stops' `candidate.point` — since `MfpResult.stop_sequence` and `selected_stops` don't
currently share an index/id linking them, matching on point equality is the simplest
correct approach given the existing data shapes). A stop found in `selected_stops` gets
`name`/`category`/`fun_score` populated from its `Candidate`; a stop not found (i.e. an
original waypoint/start/end) keeps those fields `None`.

`day_plans_json` stores this enriched shape directly (list of lists of dicts with the
new optional keys), so `GET /plan` returns the same enrichment for free with no
recomputation — it's just reading back what was persisted.

`_plan_to_response`'s `DayPlanOut`/`PointOut` construction updates accordingly to pass
the new fields through.

### 4. Rendering (`MapComponent.tsx`, `TripSummary.tsx`)

`MapComponent.tsx` gains a `plan: TripPlan | null` prop. The route-drawing `useEffect`
branches:
- If `plan` is present: flatten `plan.dayPlans[].stops` (in order, across all days) into
  the `DirectionsService` waypoints list instead of `trip.waypoints`. After
  `directionsRenderer.setDirections(result)`, place additional markers for stops where
  `name` is set (i.e. inserted POI stops) using a visually distinct icon/color from the
  default `DirectionsRenderer` markers, so it's clear at a glance which stops were
  user-specified vs. algorithm-inserted. (`suppressMarkers` may need to become `true`
  with manual marker placement for all stops, so POI vs. non-POI styling can be
  controlled directly — exact approach left to implementation, but the visual
  distinction is the requirement.)
- If `plan` is absent: unchanged, draws the direct route through `trip.waypoints` as
  today.

`TripSummary.tsx`'s placeholder block becomes conditional:
- If `plan` is `null`: show the "Solve route" button (part 2).
- If `plan` exists: show total fun score, total distance (converted to a readable
  unit), total duration, and an ordered list per day — each day's stops rendered as
  `name` + `category` badge for POI stops, or the original waypoint/start/end label for
  non-POI stops.

## Data flow summary

```
TripForm (Places Autocomplete) → createTrip → page.tsx sets trip (and clears plan)
TripSummary "Solve route" button → createPlan(trip.id) → page.tsx sets plan
MapComponent(trip, plan) → draws solved route + distinguished POI markers if plan present, else direct route
TripSummary(trip, plan) → shows day-by-day breakdown if plan present, else the solve button
```

## Testing

No existing frontend test suite to extend — per project convention (`CLAUDE.md`:
"Testing/CI deferred" except `app/algorithm`), verification here is manual: drive the
actual UI in a browser, create a trip via autocomplete, click solve, confirm the map and
summary update correctly, confirm a second `GET`-only page load (no re-solve) still
shows the persisted plan.

No existing backend test coverage for `app/api/trips.py` or `app/api/plan.py` either
(only `app/algorithm` and `app/places` are tested per current convention) — the
`plan.py` enrichment change stays manual-verification-only too, consistent with existing
practice, unless broader API test coverage is explicitly requested as separate scope.

## Out of scope

- Re-solving after editing an already-solved trip (e.g. changing the detour budget) —
  today, creating a new plan via the same button after edits would just call `/plan`
  again and get a fresh result, but there's no explicit "your plan is stale, re-solve"
  UI signal. Not required for this pass.
- Per-session/IP Places quota enforcement — already a known, separately-tracked deferred
  gap (`CLAUDE.md` item), not introduced or fixed by this change.
- `PlaceAutocompleteElement` styling/theming to match the app's parchment/trail
  aesthetic beyond whatever default Google provides — cosmetic polish, not blocking.
