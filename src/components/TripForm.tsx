'use client';

import { useState, useEffect } from 'react';
import { TripPlan, Stop, AITripPreferences, DayPlan } from '@/types/trip';
import { createBasicTripPlan } from '@/utils/basicTripPlanner';

interface TripFormProps {
  onTripPlanUpdate: (tripPlan: TripPlan) => void;
  onDayPlansUpdate?: (dayPlans: DayPlan[]) => void;
}

export default function TripForm({ onTripPlanUpdate, onDayPlansUpdate }: TripFormProps) {
  const [tripName, setTripName] = useState('');
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const [isReturnTrip, setIsReturnTrip] = useState(true);
  const [stops, setStops] = useState<Stop[]>([]);
  const [newStop, setNewStop] = useState('');
  const [maxDrivingHoursPerDay, setMaxDrivingHoursPerDay] = useState(6);
  const [preferredAccommodationTypes, setPreferredAccommodationTypes] = useState<string[]>(['hotel', 'motel']);
  const [preferredAttractionTypes, setPreferredAttractionTypes] = useState<string[]>(['scenic', 'hiking']);
  const [budget, setBudget] = useState('');
  const [totalDays, setTotalDays] = useState(7);
  const [useAI, setUseAI] = useState(true);
  const [aiFocus, setAiFocus] = useState('nature');
  const [isLoading, setIsLoading] = useState(false);

  const accommodationTypes = [
    { value: 'hotel', label: 'Hotels' },
    { value: 'motel', label: 'Motels' },
    { value: 'hostel', label: 'Hostels' },
    { value: 'campground', label: 'Campgrounds' },
    { value: 'bnb', label: 'B&Bs' }
  ];

  const attractionTypes = [
    { value: 'hiking', label: 'Hiking Trails' },
    { value: 'scenic', label: 'Scenic Views' },
    { value: 'cultural', label: 'Cultural Sites' },
    { value: 'food', label: 'Restaurants' },
    { value: 'entertainment', label: 'Entertainment' }
  ];

  const addStop = () => {
    if (!newStop.trim()) return;
    
    const stop: Stop = {
      id: `stop-${Date.now()}`,
      name: newStop,
      location: newStop,
      type: 'waypoint',
      order: stops.length + 1
    };
    
    setStops([...stops, stop]);
    setNewStop('');
  };

  const removeStop = (stopId: string) => {
    setStops(stops.filter(stop => stop.id !== stopId));
  };

  const moveStop = (stopId: string, direction: 'up' | 'down') => {
    const stopIndex = stops.findIndex(stop => stop.id === stopId);
    if (stopIndex === -1) return;

    const newStops = [...stops];
    if (direction === 'up' && stopIndex > 0) {
      [newStops[stopIndex], newStops[stopIndex - 1]] = [newStops[stopIndex - 1], newStops[stopIndex]];
    } else if (direction === 'down' && stopIndex < newStops.length - 1) {
      [newStops[stopIndex], newStops[stopIndex + 1]] = [newStops[stopIndex + 1], newStops[stopIndex]];
    }

    // Update order numbers
    newStops.forEach((stop, index) => {
      stop.order = index + 1;
    });

    setStops(newStops);
  };

  const handleAccommodationTypeChange = (type: string) => {
    setPreferredAccommodationTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleAttractionTypeChange = (type: string) => {
    setPreferredAttractionTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  // Auto-populate end point when return trip is checked and start point changes
  useEffect(() => {
    if (isReturnTrip && startPoint) {
      setEndPoint(startPoint);
    }
  }, [isReturnTrip, startPoint]);

  const handlePlanTrip = async () => {
    if (!tripName || !startPoint || !endPoint) {
      alert('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    
    try {
      const tripPlan: TripPlan = {
        id: `trip-${Date.now()}`,
        name: tripName,
        startPoint,
        endPoint,
        isReturnTrip,
        totalDays,
        stops: [
          { id: 'start', name: 'Start', location: startPoint, type: 'start', order: 0 },
          ...stops,
          { id: 'end', name: 'End', location: endPoint, type: 'destination', order: stops.length + 1 }
        ],
        dayPlans: [], // Will be populated by the planner
        totalDistance: 0,
        totalDuration: 0,
        preferences: {
          maxDrivingHoursPerDay,
          preferredAccommodationTypes,
          preferredAttractionTypes,
          budget: budget ? parseFloat(budget) : undefined
        },
        useAI
      };

      onTripPlanUpdate(tripPlan);

      // Create basic day plans if AI is disabled
      if (!useAI && onDayPlansUpdate) {
        console.log('Creating basic day plans...');
        const basicDayPlans = createBasicTripPlan(tripPlan);
        console.log('Basic day plans created:', basicDayPlans);
        onDayPlansUpdate(basicDayPlans);
      }
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
        Plan Your Multi-Stop Trip
      </h2>
      
      <div className="space-y-6">
        {/* Basic Trip Info */}
        <div className="space-y-4">
          <div>
            <label htmlFor="tripName" className="block text-sm font-medium text-gray-700 mb-2">
              Trip Name *
            </label>
            <input
              type="text"
              id="tripName"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              placeholder="My Amazing Road Trip"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startPoint" className="block text-sm font-medium text-gray-700 mb-2">
                Starting Point *
              </label>
              <input
                type="text"
                id="startPoint"
                value={startPoint}
                onChange={(e) => setStartPoint(e.target.value)}
                placeholder="Enter starting location..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              />
            </div>

            <div>
              <label htmlFor="endPoint" className="block text-sm font-medium text-gray-700 mb-2">
                End Point *
              </label>
              <input
                type="text"
                id="endPoint"
                value={endPoint}
                onChange={(e) => setEndPoint(e.target.value)}
                placeholder="Enter end location..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="returnTrip"
              checked={isReturnTrip}
              onChange={(e) => {
                setIsReturnTrip(e.target.checked);
                if (e.target.checked && startPoint) {
                  setEndPoint(startPoint);
                }
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="returnTrip" className="text-sm text-gray-700">
              Return to starting point (round trip)
            </label>
          </div>


        </div>

        {/* Stops Management */}
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-3">Stops Along the Way</h3>
          
          <div className="space-y-2">
            {stops.map((stop, index) => (
              <div key={stop.id} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
                <span className="text-sm font-medium text-gray-600 w-6">{stop.order}</span>
                <span className="flex-1 text-sm">{stop.name}</span>
                <div className="flex space-x-1">
                  <button
                    onClick={() => moveStop(stop.id, 'up')}
                    disabled={index === 0}
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded disabled:bg-gray-300"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveStop(stop.id, 'down')}
                    disabled={index === stops.length - 1}
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded disabled:bg-gray-300"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeStop(stop.id)}
                    className="px-2 py-1 text-xs bg-red-500 text-white rounded"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex space-x-2 mt-3">
            <input
              type="text"
              value={newStop}
              onChange={(e) => setNewStop(e.target.value)}
              placeholder="Add a stop..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              onKeyPress={(e) => e.key === 'Enter' && addStop()}
            />
            <button
              onClick={addStop}
              disabled={!newStop.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300"
            >
              Add
            </button>
          </div>
        </div>

        {/* Trip Preferences */}
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-3">Trip Preferences</h3>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="maxDrivingHours" className="block text-sm font-medium text-gray-700 mb-2">
                Max Driving Hours Per Day
              </label>
              <input
                type="range"
                id="maxDrivingHours"
                min="2"
                max="10"
                value={maxDrivingHoursPerDay}
                onChange={(e) => setMaxDrivingHoursPerDay(parseInt(e.target.value))}
                className="w-full"
              />
              <span className="text-sm text-gray-600">{maxDrivingHoursPerDay} hours</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Accommodation Types
              </label>
              <div className="grid grid-cols-2 gap-2">
                {accommodationTypes.map(type => (
                  <label key={type.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={preferredAccommodationTypes.includes(type.value)}
                      onChange={() => handleAccommodationTypeChange(type.value)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Attraction Types
              </label>
              <div className="grid grid-cols-2 gap-2">
                {attractionTypes.map(type => (
                  <label key={type.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={preferredAttractionTypes.includes(type.value)}
                      onChange={() => handleAttractionTypeChange(type.value)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="budget" className="block text-sm font-medium text-gray-700 mb-2">
                Budget (optional)
              </label>
              <input
                type="number"
                id="budget"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Enter budget amount"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              />
            </div>

            <div>
              <label htmlFor="totalDays" className="block text-sm font-medium text-gray-700 mb-2">
                Trip Duration (days)
              </label>
              <input
                type="number"
                id="totalDays"
                min="1"
                max="30"
                value={totalDays}
                onChange={(e) => setTotalDays(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              />
            </div>
          </div>
        </div>

        {/* AI Planning Options */}
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-3">🤖 AI-Powered Planning</h3>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="useAI"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="useAI" className="text-sm text-gray-700">
                Use AI to suggest attractions and optimize route
              </label>
            </div>

            {useAI && (
              <div>
                <label htmlFor="aiFocus" className="block text-sm font-medium text-gray-700 mb-2">
                  Trip Focus
                </label>
                <select
                  id="aiFocus"
                  value={aiFocus}
                  onChange={(e) => setAiFocus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                >
                  <option value="nature">Nature & Outdoors</option>
                  <option value="culture">Culture & History</option>
                  <option value="adventure">Adventure & Sports</option>
                  <option value="food">Food & Dining</option>
                  <option value="relaxation">Relaxation & Wellness</option>
                  <option value="mixed">Mixed Interests</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  AI will prioritize attractions based on your focus
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handlePlanTrip}
          disabled={isLoading || !tripName || !startPoint || !endPoint}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Planning...' : 'Plan Multi-Stop Trip'}
        </button>
      </div>
    </div>
  );
} 