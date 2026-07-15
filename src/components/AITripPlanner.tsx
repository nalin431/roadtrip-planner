'use client';

import { useState } from 'react';
import { TripPlan, DayPlan, AITripPreferences } from '@/types/trip';
import { generateAITripPlan, AITripPlan, AIDayPlan, AIAttraction } from '@/utils/aiService';

interface AITripPlannerProps {
  tripPlan: TripPlan;
  onDayPlansUpdate: (dayPlans: DayPlan[]) => void;
  onTripPlanUpdate: (tripPlan: TripPlan) => void;
}

export default function AITripPlanner({ tripPlan, onDayPlansUpdate, onTripPlanUpdate }: AITripPlannerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPlan, setAiPlan] = useState<AITripPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const convertAIDayPlanToDayPlan = (aiDayPlan: AIDayPlan, dayIndex: number): DayPlan => {
    const attractions = aiDayPlan.attractions.map((aiAttraction, index) => ({
      id: `attraction-${dayIndex}-${index}`,
      name: aiAttraction.name,
      type: aiAttraction.type,
      location: aiAttraction.location,
      description: aiAttraction.description,
      estimatedDuration: aiAttraction.estimatedDuration,
      cost: aiAttraction.cost,
      priority: aiAttraction.priority,
      aiGenerated: true
    }));

    const accommodation = aiDayPlan.accommodation ? {
      id: `accommodation-${dayIndex}`,
      name: aiDayPlan.accommodation.name,
      type: aiDayPlan.accommodation.type as any,
      location: aiDayPlan.accommodation.location,
      price: aiDayPlan.accommodation.price,
      aiGenerated: true
    } : undefined;

    return {
      day: aiDayPlan.day,
      stops: [], // Will be populated based on route
      totalDistance: aiDayPlan.drivingDistance,
      totalDuration: aiDayPlan.drivingDuration,
      attractions,
      accommodation,
      notes: aiDayPlan.notes,
      focus: aiDayPlan.focus,
      drivingDistance: aiDayPlan.drivingDistance,
      drivingDuration: aiDayPlan.drivingDuration,
      aiGenerated: true
    };
  };

  const handleGenerateAIPlan = async () => {
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      setError('OpenAI API key not configured. Please add NEXT_PUBLIC_OPENAI_API_KEY to your environment variables.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const stops = tripPlan.stops
        .filter(stop => stop.type !== 'start' && stop.type !== 'destination')
        .map(stop => stop.name);

      const aiPreferences: AITripPreferences = {
        totalDays: tripPlan.totalDays,
        maxDrivingHoursPerDay: tripPlan.preferences.maxDrivingHoursPerDay,
        preferredAttractionTypes: tripPlan.preferences.preferredAttractionTypes,
        budget: tripPlan.preferences.budget,
        isReturnTrip: tripPlan.isReturnTrip,
        useAI: true
      };

      const generatedPlan = await generateAITripPlan(
        tripPlan.startPoint,
        tripPlan.endPoint,
        tripPlan.totalDays,
        stops,
        {
          maxDrivingHoursPerDay: tripPlan.preferences.maxDrivingHoursPerDay,
          preferredAttractionTypes: tripPlan.preferences.preferredAttractionTypes,
          budget: tripPlan.preferences.budget,
          isReturnTrip: tripPlan.isReturnTrip
        }
      );

      setAiPlan(generatedPlan);

      // Convert AI plan to regular day plans
      const dayPlans = generatedPlan.dayPlans.map((aiDayPlan, index) => 
        convertAIDayPlanToDayPlan(aiDayPlan, index)
      );

      // Update the trip plan with AI-generated data
      const updatedTripPlan: TripPlan = {
        ...tripPlan,
        dayPlans,
        totalDistance: generatedPlan.totalDistance,
        totalCost: generatedPlan.totalCost,
        suggestedStops: generatedPlan.suggestedStops,
        priorityAreas: generatedPlan.priorityAreas,
        aiGenerated: true
      };

      onDayPlansUpdate(dayPlans);
      onTripPlanUpdate(updatedTripPlan);

    } catch (error) {
      console.error('Error generating AI plan:', error);
      setError('Failed to generate AI plan. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        🤖 AI-Powered Trip Planning
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-md">
          <h4 className="font-medium text-blue-800 mb-2">What AI Can Do:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Suggest interesting attractions along your route</li>
            <li>• Optimize your itinerary to spend more time in priority areas</li>
            <li>• Break down your trip into balanced daily plans</li>
            <li>• Recommend accommodations and dining options</li>
            <li>• Calculate realistic driving times and distances</li>
          </ul>
        </div>

        <button
          onClick={handleGenerateAIPlan}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-md hover:from-blue-700 hover:to-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium"
        >
          {isGenerating ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Generating AI Plan...</span>
            </div>
          ) : (
            'Generate AI-Optimized Trip Plan'
          )}
        </button>

        {aiPlan && (
          <div className="mt-6 space-y-4">
            <div className="bg-green-50 p-4 rounded-md">
              <h4 className="font-medium text-green-800 mb-2">AI Plan Generated!</h4>
              <div className="text-sm text-green-700 space-y-1">
                <p><strong>Total Distance:</strong> {aiPlan.totalDistance} miles</p>
                <p><strong>Total Days:</strong> {aiPlan.totalDays}</p>
                {aiPlan.totalCost && (
                  <p><strong>Estimated Cost:</strong> ${aiPlan.totalCost.toLocaleString()}</p>
                )}
              </div>
            </div>

            {aiPlan.priorityAreas && aiPlan.priorityAreas.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded-md">
                <h4 className="font-medium text-yellow-800 mb-2">Priority Areas:</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {aiPlan.priorityAreas.map((area, index) => (
                    <li key={index}>• {area}</li>
                  ))}
                </ul>
              </div>
            )}

            {aiPlan.suggestedStops && aiPlan.suggestedStops.length > 0 && (
              <div className="bg-purple-50 p-4 rounded-md">
                <h4 className="font-medium text-purple-800 mb-2">Suggested Additional Stops:</h4>
                <ul className="text-sm text-purple-700 space-y-1">
                  {aiPlan.suggestedStops.map((stop, index) => (
                    <li key={index}>• {stop}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 