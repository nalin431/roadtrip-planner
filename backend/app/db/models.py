import uuid
from datetime import datetime

from sqlalchemy import (
    ARRAY,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (Index("idx_trips_session_id", "session_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sessions.id"))
    name: Mapped[str] = mapped_column(Text)
    start_location: Mapped[str] = mapped_column(Text)
    start_lat: Mapped[float]
    start_lng: Mapped[float]
    end_location: Mapped[str] = mapped_column(Text)
    end_lat: Mapped[float]
    end_lng: Mapped[float]
    is_return_trip: Mapped[bool] = mapped_column(Boolean, default=False)
    total_days: Mapped[int] = mapped_column(Integer)
    max_driving_hours_per_day: Mapped[float] = mapped_column(Numeric, default=8)
    detour_budget_pct: Mapped[float] = mapped_column(Numeric, default=10)
    budget: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    preferred_attraction_types: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    status: Mapped[str] = mapped_column(Text, default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    waypoints: Mapped[list["TripWaypoint"]] = relationship(
        back_populates="trip", order_by="TripWaypoint.sequence", cascade="all, delete-orphan"
    )


class TripWaypoint(Base):
    __tablename__ = "trip_waypoints"
    __table_args__ = (Index("idx_trip_waypoints_trip_id", "trip_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"))
    location: Mapped[str] = mapped_column(Text)
    lat: Mapped[float]
    lng: Mapped[float]
    sequence: Mapped[int] = mapped_column(Integer)

    trip: Mapped["Trip"] = relationship(back_populates="waypoints")


class Poi(Base):
    __tablename__ = "pois"
    __table_args__ = (
        Index("idx_pois_geocell", "geocell"),
        Index("idx_pois_category", "category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    google_place_id: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(Text)
    lat: Mapped[float]
    lng: Mapped[float]
    geocell: Mapped[str] = mapped_column(Text)
    rating: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    user_ratings_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fun_score: Mapped[float] = mapped_column(Numeric)
    raw_places_json: Mapped[dict] = mapped_column(JSONB)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PoiCacheQuery(Base):
    __tablename__ = "poi_cache_queries"
    __table_args__ = (UniqueConstraint("geocell", "category", "radius_m"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    geocell: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(Text)
    radius_m: Mapped[int] = mapped_column(Integer)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    result_count: Mapped[int] = mapped_column(Integer)


class TripPlan(Base):
    __tablename__ = "trip_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id"))
    algorithm_version: Mapped[str] = mapped_column(String(32))
    total_fun_score: Mapped[float] = mapped_column(Numeric)
    total_distance_m: Mapped[float] = mapped_column(Numeric)
    total_duration_s: Mapped[float] = mapped_column(Numeric)
    solve_time_ms: Mapped[int] = mapped_column(Integer)
    day_plans_json: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
