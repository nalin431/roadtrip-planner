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
