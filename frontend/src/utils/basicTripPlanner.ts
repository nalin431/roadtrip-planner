import { TripPlan, DayPlan, Stop, Attraction, Accommodation } from '@/types/trip';

export interface BasicDayPlan {
  day: number;
  stops: Stop[];
  totalDistance: number;
  totalDuration: number;
  attractions: Attraction[];
  accommodation?: Accommodation;
  notes: string;
}

// Mock attractions for basic planning
const mockAttractions: Attraction[] = [
  {
    id: 'att-1',
    name: 'Scenic Overlook',
    type: 'scenic',
    location: 'Route',
    rating: 4.5,
    description: 'Beautiful panoramic views',
    estimatedDuration: 30,
    cost: 0
  },
  {
    id: 'att-2',
    name: 'Local Restaurant',
    type: 'food',
    location: 'Route',
    rating: 4.2,
    description: 'Local cuisine and dining',
    estimatedDuration: 60,
    cost: 25
  },
  {
    id: 'att-3',
    name: 'Hiking Trail',
    type: 'hiking',
    location: 'Route',
    rating: 4.0,
    description: 'Nature trail and outdoor activity',
    estimatedDuration: 90,
    cost: 0
  },
  {
    id: 'att-4',
    name: 'Museum',
    type: 'cultural',
    location: 'Route',
    rating: 4.3,
    description: 'Cultural and historical exhibits',
    estimatedDuration: 120,
    cost: 15
  }
];

// Mock accommodations
const mockAccommodations: Accommodation[] = [
  {
    id: 'acc-1',
    name: 'Comfort Inn',
    type: 'hotel',
    location: 'Route',
    rating: 4.2,
    price: 120,
    amenities: ['WiFi', 'Pool', 'Breakfast'],
    bookingUrl: 'https://booking.com'
  },
  {
    id: 'acc-2',
    name: 'Riverside Campground',
    type: 'campground',
    location: 'Route',
    rating: 4.0,
    price: 25,
    amenities: ['Fire Pit', 'Bathrooms', 'Hiking Trails'],
    bookingUrl: 'https://recreation.gov'
  },
  {
    id: 'acc-3',
    name: 'Downtown Motel',
    type: 'motel',
    location: 'Route',
    rating: 3.8,
    price: 65,
    amenities: ['Parking', 'TV', 'AC'],
    bookingUrl: 'https://booking.com'
  }
];

export function createBasicTripPlan(tripPlan: TripPlan): DayPlan[] {
  const { stops, totalDays, preferences } = tripPlan;
  const dayPlans: DayPlan[] = [];

  // Calculate basic route information
  const totalStops = stops.length;
  const stopsPerDay = Math.max(1, Math.ceil(totalStops / totalDays));

  for (let day = 1; day <= totalDays; day++) {
    const startIndex = (day - 1) * stopsPerDay;
    const endIndex = Math.min(startIndex + stopsPerDay, totalStops);
    const dayStops = stops.slice(startIndex, endIndex);

    // Calculate estimated distance and duration
    const estimatedDistance = dayStops.length * 50; // Rough estimate: 50 miles per stop
    const estimatedDuration = Math.min(
      estimatedDistance * 1.2, // 1.2 minutes per mile average
      preferences.maxDrivingHoursPerDay * 60
    );

    // Get attractions based on preferences
    const dayAttractions = mockAttractions
      .filter(attraction => preferences.preferredAttractionTypes.includes(attraction.type))
      .slice(0, 2); // 2 attractions per day

    // Get accommodation for the last stop of the day
    const lastStop = dayStops[dayStops.length - 1];
    const accommodation = mockAccommodations.find(acc => 
      preferences.preferredAccommodationTypes.includes(acc.type)
    );

    const dayPlan: DayPlan = {
      day,
      stops: dayStops,
      totalDistance: estimatedDistance,
      totalDuration: estimatedDuration,
      attractions: dayAttractions,
      accommodation,
      notes: `Day ${day} of your ${tripPlan.name} trip. ${dayStops.length} stops planned.`,
      aiGenerated: false
    };

    dayPlans.push(dayPlan);
  }

  return dayPlans;
}

export function calculateBasicTripStats(tripPlan: TripPlan, dayPlans: DayPlan[]) {
  const totalDistance = dayPlans.reduce((sum, day) => sum + day.totalDistance, 0);
  const totalDuration = dayPlans.reduce((sum, day) => sum + day.totalDuration, 0);
  const totalAttractions = dayPlans.reduce((sum, day) => sum + day.attractions.length, 0);
  const totalAccommodations = dayPlans.filter(day => day.accommodation).length;

  return {
    totalDistance,
    totalDuration,
    totalAttractions,
    totalAccommodations
  };
} 