'use client';

import { useState } from 'react';
import MapComponent from '@/components/MapComponent';
import TripForm from '@/components/TripForm';
import TripSummary from '@/components/TripSummary';
import type { Trip } from '@/types/trip';

export default function Home() {
  const [trip, setTrip] = useState<Trip | null>(null);

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
            <TripForm onTripCreated={setTrip} />
          </div>

          <div className="space-y-6 lg:col-span-3">
            <div className="h-[420px]">
              <MapComponent trip={trip} />
            </div>
            {trip && <TripSummary trip={trip} />}
          </div>
        </div>
      </div>
    </main>
  );
}
