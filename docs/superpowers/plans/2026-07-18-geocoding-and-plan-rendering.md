# Geocoding + Solved-Plan Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual lat/lng entry in `TripForm` with Google Places Autocomplete, and wire the frontend to call `POST /api/trips/{id}/plan`, then render the solved itinerary (day-by-day stops, including inserted POI detours) on the map and in the trip summary.

**Architecture:** Backend: enrich `TripPlan`'s persisted `day_plans_json` with POI name/category/fun_score for inserted stops (matched from `MfpResult.selected_stops` by point equality), so the API response carries everything the UI needs with no extra round-trips. Frontend: a new `LocationAutocomplete` component wraps the Google Maps `places` library's `PlaceAutocompleteElement`; `page.tsx` gains a second `plan` state slot alongside `trip`; an explicit "Solve route" button in `TripSummary` triggers the solve; `MapComponent` and `TripSummary` both branch their rendering on whether `plan` is present.

**Tech Stack:** FastAPI + Pydantic (backend response shapes), SQLAlchemy (no schema change — `day_plans_json` is already a JSONB column), Next.js/React 19 + TypeScript strict (frontend), `@googlemaps/js-api-loader`'s `importLibrary` (already in use, no new dependency).

## Global Constraints

- Backend: `ruff check .` and `mypy .` must pass (`backend/pyproject.toml`: line length 110, `disallow_untyped_defs = false` but type hints expected throughout).
- Frontend: TypeScript `strict` mode; `next lint` must pass; path alias `@/*` → `src/*`.
- Error responses from the backend are a flat shape: `{"error": "message", "code": "..."}` with a matching HTTP status — follow this for any new error paths.
- Components never hold their own copy of trip/plan state — `page.tsx` is the single owner; components receive `trip`/`plan` as props and call back up via callback props (`onTripCreated`, new `onPlanCreated`).
- No existing frontend or `app/api` test suite to extend — verification for this plan is manual (drive the actual UI in a browser), consistent with current project convention. `app/algorithm` and `app/places` remain the only tested backend packages; this plan does not change that.
- Run frontend commands from `frontend/`, backend commands from `backend/` (using the project's `.venv`, e.g. `./.venv/Scripts/python.exe -m pytest`), never the repo root.

---

## File Structure

**Backend:**
- Modify: `backend/app/api/plan.py` — enrich `PointOut`, change day-building logic in `create_plan()`.

**Frontend:**
- Create: `frontend/src/components/LocationAutocomplete.tsx` — wraps `PlaceAutocompleteElement`.
- Modify: `frontend/src/components/TripForm.tsx` — replace manual lat/lng inputs with `LocationAutocomplete`.
- Modify: `frontend/src/types/trip.ts` — add `PlanStop`, `DayPlan`, `TripPlan` types.
- Modify: `frontend/src/lib/apiClient.ts` — add `createPlan()`.
- Modify: `frontend/src/components/TripSummary.tsx` — add solve button + day-by-day breakdown, replace placeholder.
- Modify: `frontend/src/components/MapComponent.tsx` — accept `plan` prop, draw solved route + POI markers.
- Modify: `frontend/src/app/page.tsx` — add `plan` state, wire callbacks.

---

## Task 1: Backend — enrich plan response with POI name/category/fun_score

**Files:**
- Modify: `backend/app/api/plan.py`

**Interfaces:**
- Consumes: `app.algorithm.types.MfpResult` (`stop_sequence: list[Point]`, `selected_stops: list[SelectedStop]` where `SelectedStop.candidate: Candidate` has `name: str`, `category: str`, `fun_score: float`, and `Candidate.point: Point` has `lat: float`, `lng: float`) — all already defined in `backend/app/algorithm/types.py`, unchanged by this task.
- Produces: `PlanResponse.day_plans[].stops[]` now includes optional `name`, `category`, `funScore` fields (JSON keys), in addition to existing `lat`/`lng`. `GET`/`POST /api/trips/{id}/plan` both return this shape.

- [ ] **Step 1: Update `PointOut` to carry optional POI fields**

In `backend/app/api/plan.py`, replace the `PointOut` class:

```python
class PointOut(BaseModel):
    lat: float
    lng: float
    name: str | None = None
    category: str | None = None
    fun_score: float | None = Field(default=None, serialization_alias="funScore")

    model_config = {"from_attributes": True, "populate_by_name": True}
```

- [ ] **Step 2: Build an enriched day_plans_json in `create_plan`**

In `backend/app/api/plan.py`, replace the line:

```python
    result = solve(mfp_input)
    days = split_into_days(result, trip.total_days, float(trip.max_driving_hours_per_day))

    plan = TripPlan(
        trip_id=trip.id,
        algorithm_version=ALGORITHM_VERSION,
        total_fun_score=result.total_fun_score,
        total_distance_m=result.total_distance_m,
        total_duration_s=result.total_duration_s,
        solve_time_ms=result.solve_time_ms,
        day_plans_json=[[{"lat": p.lat, "lng": p.lng} for p in day] for day in days],
    )
```

with:

```python
    result = solve(mfp_input)
    days = split_into_days(result, trip.total_days, float(trip.max_driving_hours_per_day))

    poi_by_point: dict[tuple[float, float], Candidate] = {
        (s.candidate.point.lat, s.candidate.point.lng): s.candidate for s in result.selected_stops
    }

    def _point_to_dict(p: Point) -> dict[str, str | float | None]:
        poi = poi_by_point.get((p.lat, p.lng))
        if poi is None:
            return {"lat": p.lat, "lng": p.lng, "name": None, "category": None, "fun_score": None}
        return {"lat": p.lat, "lng": p.lng, "name": poi.name, "category": poi.category, "fun_score": poi.fun_score}

    plan = TripPlan(
        trip_id=trip.id,
        algorithm_version=ALGORITHM_VERSION,
        total_fun_score=result.total_fun_score,
        total_distance_m=result.total_distance_m,
        total_duration_s=result.total_duration_s,
        solve_time_ms=result.solve_time_ms,
        day_plans_json=[[_point_to_dict(p) for p in day] for day in days],
    )
```

Add `Candidate` to the existing import from `app.algorithm.types` at the top of the file:

```python
from app.algorithm.types import Candidate, MfpInput, Point, Waypoint
```

(This import already exists with `Candidate` included per the current file — verify it's there; it is as of this plan's writing.)

- [ ] **Step 3: Update `_plan_to_response` to pass through the new fields**

Replace:

```python
        day_plans=[DayPlanOut(stops=[PointOut(**pt) for pt in day]) for day in plan.day_plans_json],
```

with (unchanged — `PointOut(**pt)` already works with the new optional keys since `day_plans_json` now stores `name`/`category`/`fun_score` keys matching `PointOut`'s field names):

```python
        day_plans=[DayPlanOut(stops=[PointOut(**pt) for pt in day]) for day in plan.day_plans_json],
```

No change needed here — confirm by inspection, this line is unchanged since `PointOut(**pt)` naturally picks up the new dict keys added in Step 2.

- [ ] **Step 4: Lint and type-check**

Run: `cd backend && ./.venv/Scripts/python.exe -m ruff check app/api/plan.py`
Expected: `All checks passed!`

Run: `cd backend && ./.venv/Scripts/python.exe -m mypy app/api/plan.py`
Expected: `Success: no issues found in 1 source file`

- [ ] **Step 5: Manually verify against a live trip**

Run: `cd backend && ./.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000` (background)

Using a trip ID from an existing trip (or create one first via `POST /api/trips` as done earlier this session), call:

```bash
curl -s -b /tmp/cookies.txt -X POST http://localhost:8000/api/trips/<trip_id>/plan
```

Expected: response JSON's `dayPlans[].stops[]` entries include `name`/`category`/`funScore` keys — non-null for at least one stop if any candidate was inserted (check `totalFunScore > 0` to confirm an insertion happened), `null` for the original start/end/waypoint stops.

Stop the server afterward (find and kill the uvicorn process, as done earlier this session, rather than leaving it running).

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/plan.py
git commit -m "Enrich plan response stops with POI name/category/fun_score"
```

---

## Task 2: Frontend — add TripPlan types and apiClient.createPlan

**Files:**
- Modify: `frontend/src/types/trip.ts`
- Modify: `frontend/src/lib/apiClient.ts`

**Interfaces:**
- Consumes: nothing from other frontend tasks.
- Produces: `TripPlan`, `DayPlan`, `PlanStop` types (used by Tasks 4, 5, 6); `apiClient.createPlan(tripId: string): Promise<TripPlan>` (used by Task 5).

- [ ] **Step 1: Add plan types to `trip.ts`**

Append to `frontend/src/types/trip.ts`:

```ts
export interface PlanStop {
  lat: number;
  lng: number;
  name: string | null;
  category: string | null;
  funScore: number | null;
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

- [ ] **Step 2: Add `createPlan` to `apiClient.ts`**

In `frontend/src/lib/apiClient.ts`, update the import line:

```ts
import type { ApiError, CreateTripInput, Trip, TripPlan, UpdateTripInput } from "@/types/trip";
```

Add a new method inside the `apiClient` object, after `updateTrip`:

```ts
  createPlan(tripId: string): Promise<TripPlan> {
    return request<TripPlan>(`/api/trips/${tripId}/plan`, {
      method: "POST",
    });
  },
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/trip.ts frontend/src/lib/apiClient.ts
git commit -m "Add TripPlan types and apiClient.createPlan"
```

---

## Task 3: Frontend — LocationAutocomplete component

**Files:**
- Create: `frontend/src/components/LocationAutocomplete.tsx`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` env var (already used by `MapComponent.tsx`); `@googlemaps/js-api-loader`'s `importLibrary`/`setOptions` (already a project dependency).
- Produces: `LocationAutocomplete` component with props `{ id: string; placeholder: string; onPlaceSelected: (name: string, lat: number, lng: number) => void; disabled?: boolean }`, used by Task 4.

- [ ] **Step 1: Write the component**

Create `frontend/src/components/LocationAutocomplete.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

interface LocationAutocompleteProps {
  id: string;
  placeholder: string;
  onPlaceSelected: (name: string, lat: number, lng: number) => void;
  disabled?: boolean;
}

// Wraps Google's PlaceAutocompleteElement (places library) so TripForm can
// resolve a typed address straight to a name + lat/lng pair, atomically —
// no separate manual coordinate entry. Uses the same importLibrary loader
// pattern as MapComponent.tsx (no new API key, no new loader setup).
export default function LocationAutocomplete({
  id,
  placeholder,
  onPlaceSelected,
  disabled,
}: LocationAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !containerRef.current) return;

    setOptions({ key: apiKey, v: 'weekly' });

    let cancelled = false;
    let listener: google.maps.MapsEventListener | null = null;

    importLibrary('places').then(({ PlaceAutocompleteElement }) => {
      if (cancelled || !containerRef.current) return;

      const element = new PlaceAutocompleteElement();
      element.id = id;
      if (placeholder) {
        element.setAttribute('placeholder', placeholder);
      }
      containerRef.current.appendChild(element);
      elementRef.current = element;

      listener = element.addListener(
        'gmp-select',
        async (event: google.maps.places.PlaceAutocompletePlaceSelectEvent) => {
          const place = event.place;
          await place.fetchFields({ fields: ['displayName', 'location'] });
          if (!place.location) return;
          onPlaceSelected(
            place.displayName ?? placeholder,
            place.location.lat(),
            place.location.lng()
          );
        }
      );
    });

    return () => {
      cancelled = true;
      listener?.remove();
      if (elementRef.current && containerRef.current?.contains(elementRef.current)) {
        containerRef.current.removeChild(elementRef.current);
      }
      elementRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onPlaceSelected/placeholder intentionally not deps: element is created once per mount
  }, [id]);

  return (
    <div
      ref={containerRef}
      data-disabled={disabled}
      className="w-full [&>*]:w-full [&>*]:rounded-md [&>*]:border [&>*]:border-dusk/40 [&>*]:bg-parchment [&>*]:px-3 [&>*]:py-2 [&>*]:text-sm [&>*]:text-canopy"
    />
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. (`google.maps.places.PlaceAutocompleteElement`, `PlaceAutocompletePlaceSelectEvent`, and `Place.fetchFields`/`location` are all present in `@types/google.maps@^3.58.1`, already installed.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/LocationAutocomplete.tsx
git commit -m "Add LocationAutocomplete component wrapping PlaceAutocompleteElement"
```

---

## Task 4: Frontend — replace manual lat/lng entry in TripForm

**Files:**
- Modify: `frontend/src/components/TripForm.tsx`

**Interfaces:**
- Consumes: `LocationAutocomplete` (Task 3), props `{ id, placeholder, onPlaceSelected, disabled }`.
- Produces: no change to `TripForm`'s own exported interface (`TripFormProps` unchanged: `{ onTripCreated: (trip: Trip) => void }`).

- [ ] **Step 1: Replace start/end input groups with LocationAutocomplete**

In `frontend/src/components/TripForm.tsx`, add the import:

```tsx
import LocationAutocomplete from './LocationAutocomplete';
```

Replace the "Start" fieldset (currently the `<fieldset>` containing the start name/lat/lng inputs):

```tsx
          <fieldset className="space-y-2 rounded-md border border-dusk/30 p-3">
            <legend className="px-1 font-mono text-xs uppercase tracking-widest text-ranger">Start</legend>
            <LocationAutocomplete
              id="startLocation"
              placeholder="Search a starting point"
              onPlaceSelected={(name, lat, lng) => {
                setStartLocation(name);
                setStartLat(String(lat));
                setStartLng(String(lng));
              }}
            />
          </fieldset>
```

Replace the "End" fieldset:

```tsx
          <fieldset className="space-y-2 rounded-md border border-dusk/30 p-3">
            <legend className="px-1 font-mono text-xs uppercase tracking-widest text-ranger">End</legend>
            <LocationAutocomplete
              id="endLocation"
              placeholder="Search a destination"
              disabled={isReturnTrip}
              onPlaceSelected={(name, lat, lng) => {
                setEndLocation(name);
                setEndLat(String(lat));
                setEndLng(String(lng));
              }}
            />
          </fieldset>
```

`startLocation`/`startLat`/`startLng`/`endLocation`/`endLat`/`endLng` state variables are unchanged — still strings, still used identically in `handleSubmit`'s `apiClient.createTrip` call. Only how they get set changes.

- [ ] **Step 2: Replace the waypoint-draft input row with LocationAutocomplete**

Replace the `waypointDraft` state declaration:

```tsx
  const [waypointDraft, setWaypointDraft] = useState({ location: '', lat: '', lng: '' });
```

with:

```tsx
  const [waypointDraft, setWaypointDraft] = useState<{ location: string; lat: number; lng: number } | null>(
    null
  );
```

Replace `addWaypoint`:

```tsx
  const addWaypoint = () => {
    if (!waypointDraft) return;
    setWaypoints((prev) => [...prev, waypointDraft]);
    setWaypointDraft(null);
  };
```

Replace the waypoint-draft input row:

```tsx
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="min-w-[10rem] flex-1">
              <LocationAutocomplete
                id="waypointDraft"
                placeholder="Search a stop"
                onPlaceSelected={(name, lat, lng) => setWaypointDraft({ location: name, lat, lng })}
              />
            </div>
            <button
              type="button"
              onClick={addWaypoint}
              disabled={!waypointDraft}
              className="rounded-md bg-ranger px-4 py-2 text-sm font-medium text-parchment transition-colors hover:bg-ranger/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add stop
            </button>
          </div>
```

(This replaces the previous `<div className="mt-3 flex flex-wrap gap-2">...</div>` block containing the three raw `<input>` elements for waypoint location/lat/lng plus the "Add stop" button.)

- [ ] **Step 3: Update the "loop back to start" checkbox handler**

Replace:

```tsx
            onChange={(e) => {
              setIsReturnTrip(e.target.checked);
              if (e.target.checked) {
                setEndLocation(startLocation);
                setEndLat(startLat);
                setEndLng(startLng);
              }
            }}
```

This is unchanged — `startLocation`/`startLat`/`startLng` are still plain string state, still copied the same way. Confirm by inspection, no edit needed here.

- [ ] **Step 4: Update `isValid`**

Replace:

```tsx
  const isValid =
    name.trim() &&
    startLocation.trim() &&
    endLocation.trim() &&
    startLat &&
    startLng &&
    endLat &&
    endLng;
```

This is unchanged — `startLat`/`startLng`/`endLat`/`endLng` are still non-empty strings once a place is selected via `LocationAutocomplete`'s `onPlaceSelected`, so the existing truthy-string check still works correctly. Confirm by inspection, no edit needed here.

- [ ] **Step 5: Remove the now-unused `ATTRACTION_TYPES`-adjacent dead code check**

Search `TripForm.tsx` for any remaining references to the old `waypointDraft.location`/`waypointDraft.lat`/`waypointDraft.lng` string-based access (e.g. in `removeWaypoint`, `moveWaypoint`, or the waypoint list rendering `waypoints.map`). These operate on the `waypoints` array (not `waypointDraft`) and are unaffected — `Waypoint` type (`{ location: string; lat: number; lng: number }`) is unchanged. Confirm by inspection, no edit needed.

- [ ] **Step 6: Type-check and lint**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 7: Manually verify in a browser**

Run: `cd frontend && npm run dev` (background)

Also start the backend: `cd backend && ./.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000` (background)

Navigate to `http://localhost:3000`. In the trip form:
- Type a partial address into the Start field — confirm a Google autocomplete dropdown appears.
- Select a suggestion — confirm the field shows the selected place and no manual lat/lng boxes are visible.
- Repeat for End and add at least one waypoint via the stop search box.
- Submit the form — confirm a trip is created successfully (network tab shows `POST /api/trips` returning 201, and `TripSummary` renders with the right route).

Stop both dev servers afterward.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/TripForm.tsx
git commit -m "Replace manual lat/lng entry with Google Places Autocomplete"
```

---

## Task 5: Frontend — solve button and plan state wiring

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/components/TripSummary.tsx`

**Interfaces:**
- Consumes: `apiClient.createPlan` (Task 2), `TripPlan` type (Task 2), `ApiRequestError` (existing, from `apiClient.ts`).
- Produces: `page.tsx` holds `plan: TripPlan | null` state; `TripSummary` gains `plan: TripPlan | null` and `onPlanCreated: (plan: TripPlan) => void` props, used by Task 6 (`MapComponent`'s new `plan` prop comes from the same `page.tsx` state).

- [ ] **Step 1: Add plan state to page.tsx**

Replace `frontend/src/app/page.tsx`'s body:

```tsx
'use client';

import { useState } from 'react';
import MapComponent from '@/components/MapComponent';
import TripForm from '@/components/TripForm';
import TripSummary from '@/components/TripSummary';
import type { Trip, TripPlan } from '@/types/trip';

export default function Home() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [plan, setPlan] = useState<TripPlan | null>(null);

  const handleTripCreated = (newTrip: Trip) => {
    setTrip(newTrip);
    setPlan(null);
  };

  return (
    <main className="min-h-screen">
      <header className="border-b border-dusk/25 px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-trail-rust">
            Most-Fun Path
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium text-canopy sm:text-5xl">
            Plan a road trip worth the detour
          </h1>
          <p className="mt-3 max-w-xl text-canopy/70">
            Log your route, set how far you&apos;re willing to wander for something worth
            seeing, and let the route solver find it.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <TripForm onTripCreated={handleTripCreated} />
          </div>

          <div className="space-y-6 lg:col-span-3">
            <div className="h-[420px]">
              <MapComponent trip={trip} plan={plan} />
            </div>
            {trip && <TripSummary trip={trip} plan={plan} onPlanCreated={setPlan} />}
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add the solve button and day-by-day breakdown to TripSummary**

Replace `frontend/src/components/TripSummary.tsx` in full:

```tsx
'use client';

import { useState } from 'react';
import type { Trip, TripPlan } from '@/types/trip';
import { apiClient, ApiRequestError } from '@/lib/apiClient';

interface TripSummaryProps {
  trip: Trip;
  plan: TripPlan | null;
  onPlanCreated: (plan: TripPlan) => void;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
};

function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export default function TripSummary({ trip, plan, onPlanCreated }: TripSummaryProps) {
  const [isSolving, setIsSolving] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);

  const handleSolve = async () => {
    setIsSolving(true);
    setSolveError(null);
    try {
      const newPlan = await apiClient.createPlan(trip.id);
      onPlanCreated(newPlan);
    } catch (err) {
      setSolveError(err instanceof ApiRequestError ? err.message : 'Could not solve this route. Try again.');
    } finally {
      setIsSolving(false);
    }
  };

  return (
    <div className="rounded-lg border border-dusk/30 bg-parchment-deep/60 p-6 shadow-sm">
      <p className="font-mono text-xs uppercase tracking-widest text-ranger">
        {STATUS_LABEL[trip.status] ?? trip.status}
      </p>
      <h2 className="mt-1 font-display text-2xl font-medium text-canopy">{trip.name}</h2>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-canopy/60">Route</dt>
          <dd className="font-medium text-canopy">
            {trip.startLocation} → {trip.isReturnTrip ? trip.startLocation : trip.endLocation}
          </dd>
        </div>
        <div>
          <dt className="text-canopy/60">Days</dt>
          <dd className="font-mono font-medium text-canopy">{trip.totalDays}</dd>
        </div>
        <div>
          <dt className="text-canopy/60">Stops logged</dt>
          <dd className="font-mono font-medium text-canopy">{trip.waypoints.length}</dd>
        </div>
        <div>
          <dt className="text-canopy/60">Detour budget</dt>
          <dd className="font-mono font-medium text-canopy">{trip.detourBudgetPct}%</dd>
        </div>
        <div>
          <dt className="text-canopy/60">Max driving / day</dt>
          <dd className="font-mono font-medium text-canopy">{trip.maxDrivingHoursPerDay}h</dd>
        </div>
        {trip.budget != null && (
          <div>
            <dt className="text-canopy/60">Budget</dt>
            <dd className="font-mono font-medium text-canopy">${trip.budget}</dd>
          </div>
        )}
      </dl>

      {trip.preferredAttractionTypes.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-canopy/60">
            Worth the detour for
          </p>
          <div className="flex flex-wrap gap-1.5">
            {trip.preferredAttractionTypes.map((t) => (
              <span
                key={t}
                className="rounded-full border border-ranger/40 bg-ranger/10 px-2.5 py-1 text-xs text-ranger"
              >
                {t.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {plan ? (
        <div className="mt-6 space-y-4">
          <dl className="grid grid-cols-3 gap-4 border-t border-dusk/20 pt-4 text-sm">
            <div>
              <dt className="text-canopy/60">Fun score</dt>
              <dd className="font-mono font-medium text-canopy">{plan.totalFunScore.toFixed(1)}</dd>
            </div>
            <div>
              <dt className="text-canopy/60">Distance</dt>
              <dd className="font-mono font-medium text-canopy">{formatDistance(plan.totalDistanceM)}</dd>
            </div>
            <div>
              <dt className="text-canopy/60">Drive time</dt>
              <dd className="font-mono font-medium text-canopy">{formatDuration(plan.totalDurationS)}</dd>
            </div>
          </dl>

          <div className="space-y-3">
            {plan.dayPlans.map((day, i) => (
              <div key={i} className="rounded-md border border-dusk/30 bg-parchment px-4 py-3">
                <p className="mb-2 font-mono text-xs uppercase tracking-widest text-ranger">
                  Day {i + 1}
                </p>
                <ol className="space-y-1 text-sm text-canopy">
                  {day.stops.map((stop, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dusk/40 font-mono text-[10px] text-canopy/70">
                        {j + 1}
                      </span>
                      {stop.name ? (
                        <span>
                          {stop.name}
                          {stop.category && (
                            <span className="ml-1.5 rounded-full bg-ranger/10 px-1.5 py-0.5 text-[10px] text-ranger">
                              {stop.category.replace(/_/g, ' ')}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-canopy/60">
                          {j === 0 && i === 0 ? trip.startLocation : 'Stop'}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-3 border-t border-dusk/20 pt-6">
          <button
            type="button"
            onClick={handleSolve}
            disabled={isSolving}
            className="w-full rounded-md bg-trail-rust py-3 font-medium text-parchment transition-colors hover:bg-trail-rust/90 disabled:cursor-not-allowed disabled:bg-dusk/40"
          >
            {isSolving ? 'Solving…' : 'Find the most fun path'}
          </button>
          {solveError && (
            <p className="rounded-md border border-trail-rust/40 bg-trail-rust/10 px-3 py-2 text-sm text-trail-rust">
              {solveError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/components/TripSummary.tsx
git commit -m "Add solve button and day-by-day plan breakdown to TripSummary"
```

---

## Task 6: Frontend — MapComponent renders the solved route

**Files:**
- Modify: `frontend/src/components/MapComponent.tsx`

**Interfaces:**
- Consumes: `TripPlan`, `PlanStop` types (Task 2).
- Produces: `MapComponent` accepts a new `plan: TripPlan | null` prop (already passed in by Task 5's `page.tsx` edit).

- [ ] **Step 1: Add the `plan` prop and branch the route-drawing effect**

In `frontend/src/components/MapComponent.tsx`, update the import and props:

```tsx
import type { Trip, TripPlan } from '@/types/trip';

interface MapComponentProps {
  trip: Trip | null;
  plan: TripPlan | null;
}
```

Update the component signature:

```tsx
export default function MapComponent({ trip, plan }: MapComponentProps) {
```

Add a new ref to track manually-placed POI markers, alongside the existing `mapRef`/`map`/`directionsRenderer` state:

```tsx
  const poiMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
```

(Add `useRef` usage — `useRef` is already imported at the top of the file from `'react'`.)

Replace the route-drawing `useEffect` (the one keyed on `[map, directionsRenderer, trip]`):

```tsx
  useEffect(() => {
    if (!map || !directionsRenderer || !trip) return;
    if (trip.waypoints.length + 2 < 2) return;

    setRouteError(null);

    // Clear any POI markers from a previous render before drawing the new route.
    poiMarkersRef.current.forEach((marker) => {
      marker.map = null;
    });
    poiMarkersRef.current = [];

    const directionsService = new google.maps.DirectionsService();

    const origin = { lat: trip.startLat, lng: trip.startLng };
    const destination = { lat: trip.endLat, lng: trip.endLng };

    const allStops = plan
      ? plan.dayPlans.flatMap((day) => day.stops)
      : trip.waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng, name: null, category: null, funScore: null }));

    // When a plan exists, allStops includes the route's start/end points too
    // (MfpResult.stop_sequence always starts/ends with them) — drop the
    // first/last entries so they aren't passed as waypoints on top of
    // origin/destination.
    const middleStops = plan ? allStops.slice(1, -1) : allStops;

    const waypoints: google.maps.DirectionsWaypoint[] = middleStops.map((stop) => ({
      location: { lat: stop.lat, lng: stop.lng },
      stopover: true,
    }));

    directionsService.route(
      {
        origin,
        destination,
        waypoints,
        optimizeWaypoints: false, // fixed order — the whole premise of Most-Fun Path
        travelMode: google.maps.TravelMode.DRIVING,
      },
      async (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          directionsRenderer.setDirections(result);

          if (plan) {
            const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary(
              'marker'
            ) as google.maps.MarkerLibrary;
            const poiStops = middleStops.filter((s) => s.name);
            poiMarkersRef.current = poiStops.map((stop) => {
              const pin = new PinElement({ background: '#c1592c', borderColor: '#1f2e23' });
              return new AdvancedMarkerElement({
                map,
                position: { lat: stop.lat, lng: stop.lng },
                title: stop.name ?? undefined,
                content: pin.element,
              });
            });
          }
        } else {
          setRouteError(
            'Could not find a driving route between these stops — check the coordinates.'
          );
        }
      }
    );
  }, [map, directionsRenderer, trip, plan]);
```

- [ ] **Step 2: Type-check and lint**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. (`google.maps.MarkerLibrary`, `AdvancedMarkerElement`, `PinElement` are present in `@types/google.maps@^3.58.1`.)

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manually verify in a browser**

Run both dev servers as in Task 4 Step 7. Create a trip (via the now-autocomplete form), click "Find the most fun path" in `TripSummary`. Confirm:
- The map redraws the route through any inserted detour stops (not just the original waypoints).
- Inserted POI stops show a distinct marker (the rust-colored pin) alongside the default `DirectionsRenderer` markers for origin/destination/original waypoints.
- `TripSummary` shows the day-by-day breakdown with fun score, distance, and duration, and any POI stop shows its name and category badge.
- Reload the page is not expected to persist `trip`/`plan` (no persistence across reloads is in scope — `page.tsx` state is in-memory only, unchanged behavior).

Stop both dev servers afterward.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MapComponent.tsx
git commit -m "Render solved route and POI markers in MapComponent"
```

---

## Self-Review Notes

- **Spec coverage:** Part 1 (geocoding) → Tasks 3, 4. Part 2 (solve trigger) → Task 5. Part 3 (backend enrichment) → Task 1. Part 4 (rendering) → Tasks 5 (summary), 6 (map). Data flow summary from the spec matches the wiring in Task 5 Step 1 (`page.tsx`) and Task 6. All four spec sections have a covering task.
- **Placeholder scan:** no TBD/TODO; all code steps show complete code, not descriptions.
- **Type consistency:** `TripPlan`/`DayPlan`/`PlanStop` (Task 2) are used identically in Tasks 5 and 6. `PointOut`'s `fun_score` (Python, `snake_case` field name, `funScore` serialization alias) matches frontend `PlanStop.funScore` (Task 2) — consistent with the existing alias pattern already used throughout `trips.py`/`plan.py` and `trip.ts`. `apiClient.createPlan(tripId: string): Promise<TripPlan>` (Task 2) signature matches its call site in Task 5's `TripSummary.tsx`. `onPlaceSelected: (name: string, lat: number, lng: number) => void` (Task 3) matches all three call sites in Task 4.
