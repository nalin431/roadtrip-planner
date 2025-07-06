'use client';

import { useState } from 'react';

interface TripFormProps {
  startPoint: string;
  destination: string;
  onStartPointChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onRouteUpdate: (route: any) => void;
  onPoisUpdate: (pois: any[]) => void;
}

export default function TripForm({
  startPoint,
  destination,
  onStartPointChange,
  onDestinationChange,
  onRouteUpdate,
  onPoisUpdate
}: TripFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePlanTrip = async () => {
    if (!startPoint || !destination) {
      alert('Please enter both start and destination points');
      return;
    }

    setIsLoading(true);
    
    try {
      // This will be handled by the MapComponent
      // For now, we'll just trigger the route planning
      onRouteUpdate({ startPoint, destination });
    } catch (error) {
      console.error('Error planning trip:', error);
      alert('Error planning trip. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">
        Plan Your Trip
      </h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="startPoint" className="block text-sm font-medium text-gray-700 mb-2">
            Starting Point
          </label>
          <input
            type="text"
            id="startPoint"
            value={startPoint}
            onChange={(e) => onStartPointChange(e.target.value)}
            placeholder="Enter starting location..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-2">
            Destination
          </label>
          <input
            type="text"
            id="destination"
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
            placeholder="Enter destination..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={handlePlanTrip}
          disabled={isLoading || !startPoint || !destination}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Planning...' : 'Plan Trip'}
        </button>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-md">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Features:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Interactive Google Maps</li>
          <li>• Hiking trails along route</li>
          <li>• Campgrounds and camping sites</li>
          <li>• Hotels, hostels, and motels</li>
          <li>• Route optimization</li>
        </ul>
      </div>
    </div>
  );
} 