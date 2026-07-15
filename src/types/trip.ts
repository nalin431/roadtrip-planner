export interface Stop {
  id: string;
  name: string;
  location: string;
  type: 'start' | 'destination' | 'waypoint';
  order: number;
  estimatedDuration?: number; // in minutes
  attractions?: Attraction[];
  accommodation?: Accommodation;
  aiGenerated?: boolean; // Flag to indicate if this was AI-generated
}

export interface Attraction {
  id: string;
  name: string;
  type: 'hiking' | 'scenic' | 'cultural' | 'food' | 'entertainment';
  location: string;
  rating?: number;
  description?: string;
  estimatedDuration: number; // in minutes
  cost?: number;
  priority?: 'high' | 'medium' | 'low'; // AI-generated priority
  aiGenerated?: boolean; // Flag to indicate if this was AI-generated
}

export interface Accommodation {
  id: string;
  name: string;
  type: 'hotel' | 'motel' | 'hostel' | 'campground' | 'bnb';
  location: string;
  rating?: number;
  price?: number;
  amenities?: string[];
  bookingUrl?: string;
  aiGenerated?: boolean; // Flag to indicate if this was AI-generated
}

export interface DayPlan {
  day: number;
  stops: Stop[];
  totalDistance: number; // in miles
  totalDuration: number; // in minutes
  attractions: Attraction[];
  accommodation?: Accommodation;
  notes?: string;
  focus?: string; // AI-generated focus for the day
  drivingDistance?: number; // AI-calculated driving distance
  drivingDuration?: number; // AI-calculated driving duration
  aiGenerated?: boolean; // Flag to indicate if this was AI-generated
}

export interface TripPlan {
  id: string;
  name: string;
  startPoint: string;
  endPoint: string;
  isReturnTrip: boolean;
  totalDays: number; // Total trip duration in days
  stops: Stop[];
  dayPlans: DayPlan[];
  totalDistance: number;
  totalDuration: number;
  preferences: {
    maxDrivingHoursPerDay: number;
    preferredAccommodationTypes: string[];
    preferredAttractionTypes: string[];
    budget?: number;
  };
  useAI?: boolean; // Whether to use AI for planning
  aiGenerated?: boolean; // Flag to indicate if this was AI-generated
  suggestedStops?: string[]; // AI-suggested additional stops
  priorityAreas?: string[]; // Areas where AI suggests spending more time
  totalCost?: number; // AI-estimated total cost
}

export interface RouteSegment {
  from: string;
  to: string;
  distance: number;
  duration: number;
  waypoints?: string[];
}

// AI-specific interfaces
export interface AITripPreferences {
  totalDays: number;
  maxDrivingHoursPerDay: number;
  preferredAttractionTypes: string[];
  budget?: number;
  isReturnTrip: boolean;
  useAI: boolean; // Whether to use AI for planning
  aiFocus?: string; // Specific focus for AI (e.g., "nature", "culture", "adventure")
} 