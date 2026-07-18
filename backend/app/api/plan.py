import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.algorithm.mfp import solve, split_into_days
from app.algorithm.types import Candidate, MfpInput, Point, Waypoint
from app.core.session import require_session
from app.db.models import Trip, TripPlan
from app.db.session import get_session
from app.places.cache import PlacesCache
from app.places.deps import get_places_cache

router = APIRouter(prefix="/api/trips", tags=["plan"])

ALGORITHM_VERSION = "mfp-greedy-v1"


class PointOut(BaseModel):
    lat: float
    lng: float

    model_config = {"from_attributes": True}


class DayPlanOut(BaseModel):
    stops: list[PointOut]


class PlanResponse(BaseModel):
    id: str
    trip_id: str = Field(serialization_alias="tripId")
    algorithm_version: str = Field(serialization_alias="algorithmVersion")
    day_plans: list[DayPlanOut] = Field(serialization_alias="dayPlans")
    total_fun_score: float = Field(serialization_alias="totalFunScore")
    total_distance_m: float = Field(serialization_alias="totalDistanceM")
    total_duration_s: float = Field(serialization_alias="totalDurationS")
    solve_time_ms: int = Field(serialization_alias="solveTimeMs")
    created_at: datetime = Field(serialization_alias="createdAt")

    model_config = {"populate_by_name": True}


async def _load_trip(trip_id: uuid.UUID, db: AsyncSession) -> Trip:
    result = await db.execute(select(Trip).where(Trip.id == trip_id).options(selectinload(Trip.waypoints)))
    trip = result.scalar_one_or_none()
    if trip is None:
        raise HTTPException(status_code=404, detail={"error": "trip not found", "code": "trip_not_found"})
    return trip


def _plan_to_response(plan: TripPlan) -> PlanResponse:
    return PlanResponse(
        id=str(plan.id),
        trip_id=str(plan.trip_id),
        algorithm_version=plan.algorithm_version,
        day_plans=[DayPlanOut(stops=[PointOut(**pt) for pt in day]) for day in plan.day_plans_json],
        total_fun_score=float(plan.total_fun_score),
        total_distance_m=float(plan.total_distance_m),
        total_duration_s=float(plan.total_duration_s),
        solve_time_ms=plan.solve_time_ms,
        created_at=plan.created_at,
    )


@router.post("/{trip_id}/plan", status_code=201, response_model=PlanResponse, response_model_by_alias=True)
async def create_plan(
    trip_id: uuid.UUID,
    session_id: uuid.UUID = Depends(require_session),
    db: AsyncSession = Depends(get_session),
    places: PlacesCache = Depends(get_places_cache),
) -> PlanResponse:
    trip = await _load_trip(trip_id, db)

    stops = [(trip.start_lat, trip.start_lng)]
    stops += [(wp.lat, wp.lng) for wp in trip.waypoints]
    stops.append((trip.end_lat, trip.end_lng))

    pois = await places.get_candidates_along_route(db, stops, trip.preferred_attraction_types)

    mfp_input = MfpInput(
        start=Point(lat=trip.start_lat, lng=trip.start_lng),
        end=Point(lat=trip.end_lat, lng=trip.end_lng),
        waypoints=[
            Waypoint(location=wp.location, point=Point(lat=wp.lat, lng=wp.lng), sequence=wp.sequence)
            for wp in trip.waypoints
        ],
        candidates=[
            Candidate(
                poi_id=str(poi.id),
                name=poi.name,
                point=Point(lat=poi.lat, lng=poi.lng),
                category=poi.category,
                fun_score=float(poi.fun_score),
            )
            for poi in pois
        ],
        detour_budget_pct=float(trip.detour_budget_pct),
        total_days=trip.total_days,
        max_driving_hours_per_day=float(trip.max_driving_hours_per_day),
    )

    result = solve(mfp_input)
    days = split_into_days(result, trip.total_days, float(trip.max_driving_hours_per_day))

    plan = TripPlan(
        trip_id=trip.id,
        algorithm_version=ALGORITHM_VERSION,
        total_fun_score=result.total_fun_score,
        total_distance_m=result.total_distance_m,
        total_duration_s=result.total_duration_s,
        solve_time_ms=result.solve_time_ms,
        day_plans_json=[[{"lat": p.lat, "lng": p.lng} for p in day] for day in days],
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)

    return _plan_to_response(plan)


@router.get("/{trip_id}/plan", response_model=PlanResponse, response_model_by_alias=True)
async def get_plan(
    trip_id: uuid.UUID,
    session_id: uuid.UUID = Depends(require_session),
    db: AsyncSession = Depends(get_session),
) -> PlanResponse:
    await _load_trip(trip_id, db)

    result = await db.execute(
        select(TripPlan).where(TripPlan.trip_id == trip_id).order_by(TripPlan.created_at.desc()).limit(1)
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail={"error": "plan not found", "code": "plan_not_found"})

    return _plan_to_response(plan)
