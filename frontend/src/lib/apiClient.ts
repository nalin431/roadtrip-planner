import type { ApiError, CreateTripInput, Trip, TripPlan, UpdateTripInput } from "@/types/trip";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

class ApiRequestError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let body: Partial<ApiError> = {};
    try {
      body = await response.json();
    } catch {
      // response body wasn't JSON; fall through to the generic message below
    }
    throw new ApiRequestError(
      body.error || `Request failed with status ${response.status}`,
      body.code || "unknown_error",
      response.status
    );
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  createTrip(input: CreateTripInput): Promise<Trip> {
    return request<Trip>("/api/trips", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getTrip(id: string): Promise<Trip> {
    return request<Trip>(`/api/trips/${id}`);
  },

  updateTrip(id: string, input: UpdateTripInput): Promise<Trip> {
    return request<Trip>(`/api/trips/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  createPlan(tripId: string): Promise<TripPlan> {
    return request<TripPlan>(`/api/trips/${tripId}/plan`, {
      method: "POST",
    });
  },
};

export { ApiRequestError };
