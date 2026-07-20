'use client';

import { useState } from 'react';
import type { Trip, Waypoint } from '@/types/trip';
import { apiClient, ApiRequestError } from '@/lib/apiClient';
import DetourDial from './DetourDial';
import LocationAutocomplete from './LocationAutocomplete';

interface TripFormProps {
  onTripCreated: (trip: Trip) => void;
}

const ATTRACTION_TYPES = [
  { value: 'tourist_attraction', label: 'Landmarks' },
  { value: 'natural_feature', label: 'Scenic & Nature' },
  { value: 'park', label: 'Parks & Trails' },
  { value: 'museum', label: 'Museums' },
  { value: 'restaurant', label: 'Food' },
  { value: 'cafe', label: 'Coffee & Cafes' },
];

// Start/end/waypoint coordinates are resolved via Google Places Autocomplete
// (LocationAutocomplete) rather than manual entry — selecting a suggestion
// atomically sets both the location name and lat/lng.
export default function TripForm({ onTripCreated }: TripFormProps) {
  const [name, setName] = useState('');
  const [startLocation, setStartLocation] = useState('');
  const [startLat, setStartLat] = useState('');
  const [startLng, setStartLng] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [endLat, setEndLat] = useState('');
  const [endLng, setEndLng] = useState('');
  const [isReturnTrip, setIsReturnTrip] = useState(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [waypointDraft, setWaypointDraft] = useState<{ location: string; lat: number; lng: number } | null>(
    null
  );
  const [totalDays, setTotalDays] = useState(5);
  const [maxDrivingHoursPerDay, setMaxDrivingHoursPerDay] = useState(6);
  const [detourBudgetPct, setDetourBudgetPct] = useState(10);
  const [budget, setBudget] = useState('');
  const [attractionTypes, setAttractionTypes] = useState<string[]>(['tourist_attraction', 'natural_feature']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAttractionType = (value: string) => {
    setAttractionTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const addWaypoint = () => {
    if (!waypointDraft) return;
    setWaypoints((prev) => [...prev, waypointDraft]);
    setWaypointDraft(null);
  };

  const removeWaypoint = (index: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  };

  const moveWaypoint = (index: number, direction: -1 | 1) => {
    setWaypoints((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const isValid =
    name.trim() &&
    startLocation.trim() &&
    endLocation.trim() &&
    startLat &&
    startLng &&
    endLat &&
    endLng;

  const handleSubmit = async () => {
    if (!isValid) {
      setError('Fill in trip name, start, and end before logging the route.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const trip = await apiClient.createTrip({
        name,
        startLocation,
        startLat: parseFloat(startLat),
        startLng: parseFloat(startLng),
        endLocation,
        endLat: parseFloat(endLat),
        endLng: parseFloat(endLng),
        isReturnTrip,
        totalDays,
        maxDrivingHoursPerDay,
        detourBudgetPct,
        budget: budget ? parseFloat(budget) : undefined,
        preferredAttractionTypes: attractionTypes,
        waypoints,
      });
      onTripCreated(trip);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not log this trip. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-dusk/30 bg-parchment-deep/60 p-6 shadow-sm">
      <p className="font-mono text-xs uppercase tracking-widest text-ranger">Trail Log</p>
      <h2 className="mt-1 font-display text-2xl font-medium text-canopy">Plot the route</h2>

      <div className="mt-6 space-y-6">
        <div>
          <label htmlFor="tripName" className="mb-1.5 block text-sm font-medium text-canopy/80">
            Trip name
          </label>
          <input
            id="tripName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pacific Coast, week two"
            className="w-full rounded-md border border-dusk/40 bg-parchment px-3 py-2 text-canopy placeholder:text-canopy/40 focus:border-trail-rust focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset className="min-w-0 space-y-2 rounded-md border border-dusk/30 p-3">
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

          <fieldset className="min-w-0 space-y-2 rounded-md border border-dusk/30 p-3">
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
        </div>

        <label className="flex items-center gap-2 text-sm text-canopy/80">
          <input
            type="checkbox"
            checked={isReturnTrip}
            onChange={(e) => {
              setIsReturnTrip(e.target.checked);
              if (e.target.checked) {
                setEndLocation(startLocation);
                setEndLat(startLat);
                setEndLng(startLng);
              }
            }}
            className="h-4 w-4 rounded border-dusk text-trail-rust focus:ring-trail-rust"
          />
          Loop back to the start
        </label>

        {/* Waypoints — a stamped trail log, order carries real meaning here */}
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-ranger">
            Stops, in order
          </p>
          <ol className="space-y-2">
            {waypoints.map((wp, i) => (
              <li
                key={`${wp.location}-${i}`}
                className="flex items-center gap-3 rounded-md border border-dusk/30 bg-parchment px-3 py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-trail-rust font-mono text-xs font-semibold text-trail-rust">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 text-sm text-canopy">{wp.location}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveWaypoint(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${wp.location} earlier`}
                    className="rounded px-2 py-1 text-xs text-ranger hover:bg-ranger/10 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveWaypoint(i, 1)}
                    disabled={i === waypoints.length - 1}
                    aria-label={`Move ${wp.location} later`}
                    className="rounded px-2 py-1 text-xs text-ranger hover:bg-ranger/10 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeWaypoint(i)}
                    aria-label={`Remove ${wp.location}`}
                    className="rounded px-2 py-1 text-xs text-trail-rust hover:bg-trail-rust/10"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>

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
        </div>

        {/* Detour budget — the signature control. How far this trip is
            willing to wander for something worth seeing. */}
        <div className="flex flex-col items-center gap-2 border-t border-dusk/20 pt-6">
          <DetourDial value={detourBudgetPct} onChange={setDetourBudgetPct} />
          <p className="max-w-[16rem] text-center text-xs text-canopy/60">
            How far the route can wander off the direct path to pick up worthwhile stops
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="totalDays" className="mb-1.5 block text-sm font-medium text-canopy/80">
              Days
            </label>
            <input
              id="totalDays"
              type="number"
              min={1}
              max={30}
              value={totalDays}
              onChange={(e) => setTotalDays(parseInt(e.target.value, 10) || 1)}
              className="w-full rounded-md border border-dusk/40 bg-parchment px-3 py-2 font-mono text-canopy focus:border-trail-rust focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="maxHours" className="mb-1.5 block text-sm font-medium text-canopy/80">
              Max driving hrs/day
            </label>
            <input
              id="maxHours"
              type="number"
              min={1}
              max={14}
              value={maxDrivingHoursPerDay}
              onChange={(e) => setMaxDrivingHoursPerDay(parseInt(e.target.value, 10) || 1)}
              className="w-full rounded-md border border-dusk/40 bg-parchment px-3 py-2 font-mono text-canopy focus:border-trail-rust focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="budget" className="mb-1.5 block text-sm font-medium text-canopy/80">
            Budget (optional)
          </label>
          <input
            id="budget"
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="1200"
            className="w-full rounded-md border border-dusk/40 bg-parchment px-3 py-2 font-mono text-canopy placeholder:text-canopy/40 focus:border-trail-rust focus:outline-none"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-canopy/80">What&apos;s worth the detour</p>
          <div className="grid grid-cols-2 gap-2">
            {ATTRACTION_TYPES.map((t) => (
              <label key={t.value} className="flex items-center gap-2 text-sm text-canopy/80">
                <input
                  type="checkbox"
                  checked={attractionTypes.includes(t.value)}
                  onChange={() => toggleAttractionType(t.value)}
                  className="h-4 w-4 rounded border-dusk text-trail-rust focus:ring-trail-rust"
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-trail-rust/40 bg-trail-rust/10 px-3 py-2 text-sm text-trail-rust">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !isValid}
          className="w-full rounded-md bg-trail-rust py-3 font-medium text-parchment transition-colors hover:bg-trail-rust/90 disabled:cursor-not-allowed disabled:bg-dusk/40"
        >
          {isSubmitting ? 'Logging route…' : 'Log this route'}
        </button>
      </div>
    </div>
  );
}
