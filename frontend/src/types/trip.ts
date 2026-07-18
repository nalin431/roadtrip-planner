// Mirrors backend/app/api/trips.py's Pydantic request/response shapes
// (camelCase aliases, see TripResponse/CreateTripRequest/UpdateTripRequest).

export interface Waypoint {
  location: string;
  lat: number;
  lng: number;
}

export interface Trip {
  id: string;
  name: string;
  startLocation: string;
  startLat: number;
  startLng: number;
  endLocation: string;
  endLat: number;
  endLng: number;
  isReturnTrip: boolean;
  totalDays: number;
  maxDrivingHoursPerDay: number;
  detourBudgetPct: number;
  budget: number | null;
  preferredAttractionTypes: string[];
  status: string;
  waypoints: Waypoint[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTripInput {
  name: string;
  startLocation: string;
  startLat: number;
  startLng: number;
  endLocation: string;
  endLat: number;
  endLng: number;
  isReturnTrip: boolean;
  totalDays: number;
  maxDrivingHoursPerDay: number;
  detourBudgetPct: number;
  budget?: number;
  preferredAttractionTypes: string[];
  waypoints: Waypoint[];
}

export interface UpdateTripInput {
  name: string;
  totalDays: number;
  maxDrivingHoursPerDay: number;
  detourBudgetPct: number;
  budget?: number;
  preferredAttractionTypes: string[];
  status: string;
}

export interface ApiError {
  error: string;
  code: string;
}

export interface PlanStop {
  lat: number;
  lng: number;
  name: string | null;
  category: string | null;
  funScore: number | null;
}

export interface DayPlan {
  stops: PlanStop[];
}

export interface TripPlan {
  id: string;
  tripId: string;
  algorithmVersion: string;
  dayPlans: DayPlan[];
  totalFunScore: number;
  totalDistanceM: number;
  totalDurationS: number;
  solveTimeMs: number;
  createdAt: string;
}
