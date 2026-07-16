"""Pure data shapes for the Most-Fun-Path solver. No HTTP/DB dependencies --
this module and mfp.py should be importable and testable in complete
isolation from the rest of the app.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Point:
    lat: float
    lng: float


@dataclass(frozen=True)
class Waypoint:
    """A user-specified stop, visited in fixed order (sequence is never
    changed by the solver).
    """

    location: str
    point: Point
    sequence: int


@dataclass(frozen=True)
class Candidate:
    """A cached POI eligible for detour-insertion into the route."""

    poi_id: str
    name: str
    point: Point
    category: str
    fun_score: float


@dataclass(frozen=True)
class MfpInput:
    start: Point
    end: Point
    waypoints: list[Waypoint]  # fixed order, start -> waypoints -> end
    candidates: list[Candidate]
    detour_budget_pct: float  # e.g. 10.0 for 10%
    total_days: int
    max_driving_hours_per_day: float


@dataclass(frozen=True)
class SelectedStop:
    """A candidate that was inserted into the route, plus where."""

    candidate: Candidate
    insert_after_index: int  # position in the stop sequence it was inserted after


@dataclass(frozen=True)
class MfpResult:
    stop_sequence: list[Point]  # start -> ...inserted + fixed waypoints (in final order... -> end
    selected_stops: list[SelectedStop]
    total_fun_score: float
    total_distance_m: float
    total_duration_s: float
    detour_used_pct: float
    unassigned_candidate_count: int
    solve_time_ms: int
