import pytest

from app.algorithm.geo import distance_m
from app.algorithm.mfp import solve, split_into_days
from app.algorithm.types import Candidate, MfpInput, MfpResult, Point, Waypoint

# A straight east-west line along the equator, where 0.01 degrees of
# longitude is ~1.11km -- easy to reason about by hand and avoids
# latitude-dependent distance distortion.
START = Point(lat=0.0, lng=0.0)
END = Point(lat=0.0, lng=1.0)  # ~111km east of START


def make_input(
    candidates: list[Candidate],
    detour_budget_pct: float = 10.0,
    waypoints: list[Waypoint] | None = None,
    total_days: int = 1,
    max_driving_hours_per_day: float = 8.0,
) -> MfpInput:
    return MfpInput(
        start=START,
        end=END,
        waypoints=waypoints or [],
        candidates=candidates,
        detour_budget_pct=detour_budget_pct,
        total_days=total_days,
        max_driving_hours_per_day=max_driving_hours_per_day,
    )


def test_no_candidates_returns_baseline_route() -> None:
    result = solve(make_input(candidates=[]))
    assert result.stop_sequence == [START, END]
    assert result.selected_stops == []
    assert result.total_fun_score == 0.0
    assert result.unassigned_candidate_count == 0


def test_cheap_high_value_candidate_is_selected() -> None:
    # Sits almost exactly on the direct path -- near-zero detour cost.
    near_route = Candidate(
        poi_id="a", name="Diner", point=Point(lat=0.0001, lng=0.5), category="food", fun_score=8.0
    )
    result = solve(make_input(candidates=[near_route], detour_budget_pct=10.0))

    assert len(result.selected_stops) == 1
    assert result.selected_stops[0].candidate.poi_id == "a"
    assert result.total_fun_score == 8.0
    assert near_route.point in result.stop_sequence


def test_candidate_exceeding_budget_is_rejected() -> None:
    # Wildly far off the route -- detour cost should blow any reasonable budget.
    far_away = Candidate(
        poi_id="b", name="Remote Peak", point=Point(lat=20.0, lng=0.5), category="nature", fun_score=100.0
    )
    result = solve(make_input(candidates=[far_away], detour_budget_pct=10.0))

    assert result.selected_stops == []
    assert result.unassigned_candidate_count == 1
    assert result.total_fun_score == 0.0


def test_detour_budget_never_exceeded() -> None:
    # A spread of candidates at increasing distance from the route with
    # varying fun_score, so greedy has real choices to make.
    candidates = [
        Candidate(
            poi_id=f"c{i}",
            name=f"Stop {i}",
            point=Point(lat=0.01 * i, lng=0.1 * i),
            category="misc",
            fun_score=float(i),
        )
        for i in range(1, 10)
    ]
    result = solve(make_input(candidates=candidates, detour_budget_pct=10.0))

    baseline = distance_m(START, END)
    budget = baseline * 10.0 / 100
    assert result.detour_used_pct <= 10.0 + 1e-6
    assert (result.detour_used_pct / 100) * baseline <= budget + 1e-6


def test_higher_value_preferred_over_lower_value_at_similar_cost() -> None:
    # Two candidates at (roughly) the same detour cost -- the higher
    # fun_score one should be picked first. Budget is tight enough that
    # only one fits.
    cheap_low_value = Candidate(
        poi_id="low", name="Low", point=Point(lat=0.001, lng=0.3), category="misc", fun_score=1.0
    )
    cheap_high_value = Candidate(
        poi_id="high", name="High", point=Point(lat=0.001, lng=0.7), category="misc", fun_score=9.0
    )
    result = solve(make_input(candidates=[cheap_low_value, cheap_high_value], detour_budget_pct=0.05))

    selected_ids = {s.candidate.poi_id for s in result.selected_stops}
    assert "high" in selected_ids


def test_waypoints_preserved_in_fixed_order() -> None:
    wp1 = Waypoint(location="Wp1", point=Point(lat=0.0, lng=0.3), sequence=0)
    wp2 = Waypoint(location="Wp2", point=Point(lat=0.0, lng=0.6), sequence=1)
    result = solve(make_input(candidates=[], waypoints=[wp1, wp2]))

    indices = [result.stop_sequence.index(p) for p in (START, wp1.point, wp2.point, END)]
    assert indices == sorted(indices)


@pytest.mark.parametrize(
    ("num_stops", "max_hours_per_day", "total_days", "expected_day_count"),
    [
        (2, 100.0, 1, 1),  # tiny route, huge daily allowance -> single day
        (2, 100.0, 3, 1),  # nothing to split even if more days are allowed
    ],
)
def test_split_into_days_respects_driving_hours(
    num_stops: int, max_hours_per_day: float, total_days: int, expected_day_count: int
) -> None:
    route = [Point(lat=0.0, lng=float(i)) for i in range(num_stops)]
    result = MfpResult(
        stop_sequence=route,
        selected_stops=[],
        total_fun_score=0.0,
        total_distance_m=0.0,
        total_duration_s=0.0,
        detour_used_pct=0.0,
        unassigned_candidate_count=0,
        solve_time_ms=0,
    )
    days = split_into_days(result, total_days=total_days, max_driving_hours_per_day=max_hours_per_day)
    assert len(days) == expected_day_count


def test_split_into_days_splits_long_route_when_days_available() -> None:
    # Each leg is ~111km -- at 60km/h that's ~1.85 hours. A 2-hour cap
    # means every leg should force a new day if enough days are available.
    route = [Point(lat=0.0, lng=float(i)) for i in range(4)]
    result = MfpResult(
        stop_sequence=route,
        selected_stops=[],
        total_fun_score=0.0,
        total_distance_m=0.0,
        total_duration_s=0.0,
        detour_used_pct=0.0,
        unassigned_candidate_count=0,
        solve_time_ms=0,
    )
    days = split_into_days(result, total_days=4, max_driving_hours_per_day=2.0)

    assert len(days) > 1
    for day in days:
        day_hours = sum(distance_m(day[i], day[i + 1]) for i in range(len(day) - 1)) / 1000 / 60
        assert day_hours <= 2.0 + 1e-6


def test_split_into_days_caps_at_total_days() -> None:
    # Even if driving hours would justify more days, total_days is a hard cap.
    route = [Point(lat=0.0, lng=float(i)) for i in range(10)]
    result = MfpResult(
        stop_sequence=route,
        selected_stops=[],
        total_fun_score=0.0,
        total_distance_m=0.0,
        total_duration_s=0.0,
        detour_used_pct=0.0,
        unassigned_candidate_count=0,
        solve_time_ms=0,
    )
    days = split_into_days(result, total_days=2, max_driving_hours_per_day=0.1)
    assert len(days) <= 2


def test_split_into_days_boundary_point_not_duplicated_across_days() -> None:
    # 5-point route, forced to split at every leg (tiny hourly cap, plenty of
    # days available) -- each boundary point must appear in exactly one day,
    # not as the last stop of day N *and* the first stop of day N+1.
    route = [Point(lat=0.0, lng=float(i)) for i in range(5)]
    result = MfpResult(
        stop_sequence=route,
        selected_stops=[],
        total_fun_score=0.0,
        total_distance_m=0.0,
        total_duration_s=0.0,
        detour_used_pct=0.0,
        unassigned_candidate_count=0,
        solve_time_ms=0,
    )
    days = split_into_days(result, total_days=5, max_driving_hours_per_day=0.1)

    assert len(days) > 1

    all_points = [point for day in days for point in day]
    assert len(all_points) == len(route)
    assert all_points == route

    for prev_day, next_day in zip(days, days[1:], strict=False):
        assert prev_day[-1] != next_day[0]


def test_solve_completes_within_time_budget() -> None:
    import time

    candidates = [
        Candidate(
            poi_id=f"c{i}",
            name=f"Stop {i}",
            point=Point(lat=0.001 * (i % 5), lng=(i % 50) * 0.02),
            category="misc",
            fun_score=float((i * 7) % 20 + 1),
        )
        for i in range(150)
    ]
    start = time.monotonic()
    result = solve(make_input(candidates=candidates, detour_budget_pct=15.0), max_solve_time_ms=3000)
    elapsed_ms = (time.monotonic() - start) * 1000

    assert elapsed_ms < 5000
    assert result.solve_time_ms < 5000
