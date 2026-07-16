import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.session import require_session
from app.db.models import Trip, TripWaypoint
from app.db.session import get_session

router = APIRouter(prefix="/api/trips", tags=["trips"])


class WaypointIn(BaseModel):
    location: str
    lat: float
    lng: float


class WaypointOut(BaseModel):
    location: str
    lat: float
    lng: float

    model_config = {"from_attributes": True}


class CreateTripRequest(BaseModel):
    name: str
    start_location: str = Field(alias="startLocation")
    start_lat: float = Field(alias="startLat")
    start_lng: float = Field(alias="startLng")
    end_location: str = Field(alias="endLocation")
    end_lat: float = Field(alias="endLat")
    end_lng: float = Field(alias="endLng")
    is_return_trip: bool = Field(default=False, alias="isReturnTrip")
    total_days: int = Field(alias="totalDays", ge=1)
    max_driving_hours_per_day: float = Field(default=8, alias="maxDrivingHoursPerDay")
    detour_budget_pct: float = Field(default=10, alias="detourBudgetPct")
    budget: float | None = None
    preferred_attraction_types: list[str] = Field(default_factory=list, alias="preferredAttractionTypes")
    waypoints: list[WaypointIn] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class UpdateTripRequest(BaseModel):
    name: str
    total_days: int = Field(alias="totalDays", ge=1)
    max_driving_hours_per_day: float = Field(alias="maxDrivingHoursPerDay")
    detour_budget_pct: float = Field(alias="detourBudgetPct")
    budget: float | None = None
    preferred_attraction_types: list[str] = Field(default_factory=list, alias="preferredAttractionTypes")
    status: str

    model_config = {"populate_by_name": True}


class TripResponse(BaseModel):
    id: str
    name: str
    start_location: str = Field(serialization_alias="startLocation")
    start_lat: float = Field(serialization_alias="startLat")
    start_lng: float = Field(serialization_alias="startLng")
    end_location: str = Field(serialization_alias="endLocation")
    end_lat: float = Field(serialization_alias="endLat")
    end_lng: float = Field(serialization_alias="endLng")
    is_return_trip: bool = Field(serialization_alias="isReturnTrip")
    total_days: int = Field(serialization_alias="totalDays")
    max_driving_hours_per_day: float = Field(serialization_alias="maxDrivingHoursPerDay")
    detour_budget_pct: float = Field(serialization_alias="detourBudgetPct")
    budget: float | None = None
    preferred_attraction_types: list[str] = Field(serialization_alias="preferredAttractionTypes")
    status: str
    waypoints: list[WaypointOut]
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")

    model_config = {"populate_by_name": True}


def _to_response(trip: Trip) -> TripResponse:
    return TripResponse(
        id=str(trip.id),
        name=trip.name,
        start_location=trip.start_location,
        start_lat=trip.start_lat,
        start_lng=trip.start_lng,
        end_location=trip.end_location,
        end_lat=trip.end_lat,
        end_lng=trip.end_lng,
        is_return_trip=trip.is_return_trip,
        total_days=trip.total_days,
        max_driving_hours_per_day=float(trip.max_driving_hours_per_day),
        detour_budget_pct=float(trip.detour_budget_pct),
        budget=float(trip.budget) if trip.budget is not None else None,
        preferred_attraction_types=trip.preferred_attraction_types,
        status=trip.status,
        waypoints=[WaypointOut.model_validate(w) for w in trip.waypoints],
        created_at=trip.created_at,
        updated_at=trip.updated_at,
    )


@router.post("", status_code=201, response_model=TripResponse, response_model_by_alias=True)
async def create_trip(
    body: CreateTripRequest,
    session_id: uuid.UUID = Depends(require_session),
    db: AsyncSession = Depends(get_session),
) -> TripResponse:
    trip = Trip(
        session_id=session_id,
        name=body.name,
        start_location=body.start_location,
        start_lat=body.start_lat,
        start_lng=body.start_lng,
        end_location=body.end_location,
        end_lat=body.end_lat,
        end_lng=body.end_lng,
        is_return_trip=body.is_return_trip,
        total_days=body.total_days,
        max_driving_hours_per_day=body.max_driving_hours_per_day,
        detour_budget_pct=body.detour_budget_pct,
        budget=body.budget,
        preferred_attraction_types=body.preferred_attraction_types,
    )
    trip.waypoints = [
        TripWaypoint(location=wp.location, lat=wp.lat, lng=wp.lng, sequence=i)
        for i, wp in enumerate(body.waypoints)
    ]

    db.add(trip)
    await db.commit()
    await db.refresh(trip, attribute_names=["waypoints"])

    return _to_response(trip)


@router.get("/{trip_id}", response_model=TripResponse, response_model_by_alias=True)
async def get_trip(
    trip_id: uuid.UUID,
    session_id: uuid.UUID = Depends(require_session),
    db: AsyncSession = Depends(get_session),
) -> TripResponse:
    result = await db.execute(select(Trip).where(Trip.id == trip_id).options(selectinload(Trip.waypoints)))
    trip = result.scalar_one_or_none()
    if trip is None:
        raise HTTPException(status_code=404, detail={"error": "trip not found", "code": "trip_not_found"})

    return _to_response(trip)


@router.patch("/{trip_id}", response_model=TripResponse, response_model_by_alias=True)
async def update_trip(
    trip_id: uuid.UUID,
    body: UpdateTripRequest,
    session_id: uuid.UUID = Depends(require_session),
    db: AsyncSession = Depends(get_session),
) -> TripResponse:
    result = await db.execute(select(Trip).where(Trip.id == trip_id).options(selectinload(Trip.waypoints)))
    trip = result.scalar_one_or_none()
    if trip is None:
        raise HTTPException(status_code=404, detail={"error": "trip not found", "code": "trip_not_found"})

    trip.name = body.name
    trip.total_days = body.total_days
    trip.max_driving_hours_per_day = body.max_driving_hours_per_day
    trip.detour_budget_pct = body.detour_budget_pct
    trip.budget = body.budget
    trip.preferred_attraction_types = body.preferred_attraction_types
    trip.status = body.status

    await db.commit()
    await db.refresh(trip, attribute_names=["waypoints"])

    return _to_response(trip)
