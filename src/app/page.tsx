'use client';

import { useState } from 'react';
import MapComponent from '@/components/MapComponent';
import TripForm from '@/components/TripForm';
import TripSummary from '@/components/TripSummary';
import AITripPlanner from '@/components/AITripPlanner';
import { TripPlan, DayPlan } from '@/types/trip';

export default function Home() {
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);

  const handleTripPlanUpdate = (newTripPlan: TripPlan) => {
    console.log('Trip plan updated:', newTripPlan);
    setTripPlan(newTripPlan);
  };

  const handleDayPlansUpdate = (newDayPlans: DayPlan[]) => {
    console.log('Day plans updated:', newDayPlans);
    setDayPlans(newDayPlans);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          🤖 AI-Powered Road Trip Planner
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Trip Form */}
          <div className="lg:col-span-1">
            <TripForm 
              onTripPlanUpdate={handleTripPlanUpdate}
              onDayPlansUpdate={handleDayPlansUpdate}
            />
            
            {/* Trip Summary */}
            {tripPlan && (
              <div className="mt-6">
                <TripSummary tripPlan={tripPlan} dayPlans={dayPlans} />
              </div>
            )}
          </div>

          {/* Right Panel - Map and Itinerary */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
              <MapComponent 
                tripPlan={tripPlan}
                dayPlans={dayPlans}
              />
            </div>
            
            {tripPlan && tripPlan.useAI && (
              <AITripPlanner 
                tripPlan={tripPlan}
                onDayPlansUpdate={handleDayPlansUpdate}
                onTripPlanUpdate={handleTripPlanUpdate}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}