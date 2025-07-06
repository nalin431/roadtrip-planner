'use client';

import { useState } from 'react';
import MapComponent from '@/components/MapComponent';
import TripForm from '@/components/TripForm';
import TripInfo from '@/components/TripInfo';

export default function Home() {
  const [startPoint, setStartPoint] = useState('');
  const [destination, setDestination] = useState('');
  const [route, setRoute] = useState<any>(null);
  const [pois, setPois] = useState<any[]>([]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          🗺️ Roadtrip Planner
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Trip Form */}
          <div className="lg:col-span-1">
            <TripForm 
              startPoint={startPoint}
              destination={destination}
              onStartPointChange={setStartPoint}
              onDestinationChange={setDestination}
              onRouteUpdate={setRoute}
              onPoisUpdate={setPois}
            />
          </div>

          {/* Right Panel - Map and Info */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <MapComponent 
                startPoint={startPoint}
                destination={destination}
                route={route}
                pois={pois}
              />
            </div>
            
            {route && (
              <div className="mt-6">
                <TripInfo route={route} pois={pois} />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}