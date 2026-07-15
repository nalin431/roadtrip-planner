'use client';

import { TripPlan, DayPlan } from '@/types/trip';
import { formatDuration, getDayPlanStats, calculateFuelCost } from '@/utils/tripUtils';

interface TripSummaryProps {
  tripPlan: TripPlan;
  dayPlans: DayPlan[];
}

export default function TripSummary({ tripPlan, dayPlans }: TripSummaryProps) {
  console.log('TripSummary received:', { tripPlan, dayPlans });
  
  const stats = dayPlans.length > 0 
    ? getDayPlanStats(dayPlans)
    : { totalDistance: 0, totalDuration: 0, totalAttractions: 0, totalAccommodations: 0 };
  
  const { totalDistance, totalDuration, totalAttractions, totalAccommodations } = stats;



  const getBudgetEstimate = (): number => {
    if (dayPlans.length === 0) {
      // Basic estimate when no day plans exist
      const basicFuelCost = calculateFuelCost(tripPlan.totalDistance || 500);
      const basicFoodCost = tripPlan.totalDays * 50;
      const basicAccommodationCost = tripPlan.totalDays * 100; // $100/night average
      return Math.round(basicFuelCost + basicFoodCost + basicAccommodationCost);
    }

    const accommodationCost = dayPlans.reduce((sum, day) => {
      return sum + (day.accommodation?.price || 0);
    }, 0);
    
    const attractionCost = dayPlans.reduce((sum, day) => {
      return sum + day.attractions.reduce((daySum, attraction) => {
        return daySum + (attraction.cost || 0);
      }, 0);
    }, 0);

    // Estimate fuel cost
    const fuelCost = calculateFuelCost(totalDistance);
    
    // Estimate food cost ($50/day per person)
    const foodCost = dayPlans.length * 50;
    
    return Math.round(accommodationCost + attractionCost + fuelCost + foodCost);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        Trip Summary {dayPlans.length > 0 ? `(${dayPlans.length} days planned)` : '(No day plans yet)'}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Trip Info */}
        <div>
          <h4 className="text-lg font-medium text-gray-700 mb-3">Trip Details</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Trip Name:</span>
              <span className="font-medium">{tripPlan.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium">{dayPlans.length > 0 ? dayPlans.length : tripPlan.totalDays} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Trip Type:</span>
              <span className="font-medium">
                {tripPlan.isReturnTrip ? 'Round Trip' : 'One Way'}
              </span>
            </div>
          </div>
        </div>

        {/* Route Info */}
        <div>
          <h4 className="text-lg font-medium text-gray-700 mb-3">Route Information</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Distance:</span>
              <span className="font-medium">{totalDistance} miles</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Driving Time:</span>
              <span className="font-medium">{formatDuration(totalDuration)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Number of Stops:</span>
              <span className="font-medium">{tripPlan.stops.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Suggested Attractions:</span>
              <span className="font-medium">{totalAttractions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Accommodations:</span>
              <span className="font-medium">{totalAccommodations}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Estimate */}
      <div className="mt-6 p-4 bg-blue-50 rounded-md">
        <h4 className="text-lg font-medium text-blue-800 mb-2">Estimated Budget</h4>
        <div className="text-2xl font-bold text-blue-600">${getBudgetEstimate()}</div>
        <p className="text-sm text-blue-700 mt-1">
          Includes accommodation, attractions, fuel, and food estimates
        </p>
      </div>

      {/* Preferences Summary */}
      <div className="mt-6">
        <h4 className="text-lg font-medium text-gray-700 mb-3">Your Preferences</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h5 className="text-sm font-medium text-gray-600 mb-2">Accommodation Types</h5>
            <div className="flex flex-wrap gap-1">
              {tripPlan.preferences.preferredAccommodationTypes.map(type => (
                <span key={type} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  {type}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h5 className="text-sm font-medium text-gray-600 mb-2">Attraction Types</h5>
            <div className="flex flex-wrap gap-1">
              {tripPlan.preferences.preferredAttractionTypes.map(type => (
                <span key={type} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  {type}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <h5 className="text-sm font-medium text-gray-600 mb-2">Daily Driving Limit</h5>
          <span className="text-sm text-gray-700">{tripPlan.preferences.maxDrivingHoursPerDay} hours per day</span>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-6 p-4 bg-yellow-50 rounded-md">
        <h4 className="text-sm font-semibold text-yellow-800 mb-2">Travel Tips:</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Book accommodations in advance, especially during peak season</li>
          <li>• Check weather forecasts for each destination</li>
          <li>• Pack for varying weather conditions</li>
          <li>• Keep emergency contact information handy</li>
          <li>• Consider purchasing travel insurance</li>
          <li>• Download offline maps for areas with poor cell service</li>
        </ul>
      </div>
    </div>
  );
} 