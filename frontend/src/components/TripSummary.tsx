'use client';

import type { Trip } from '@/types/trip';

interface TripSummaryProps {
  trip: Trip;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
};

export default function TripSummary({ trip }: TripSummaryProps) {
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

      <div className="mt-6 rounded-md border border-dusk/30 bg-parchment px-4 py-3 text-sm text-canopy/70">
        The route solver isn&apos;t wired up yet — this trip is logged, and the map shows the
        direct path through your stops in order.
      </div>
    </div>
  );
}
