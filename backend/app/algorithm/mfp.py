"""Most-Fun-Path solver.

Problem: waypoints are visited in fixed, user-given order. Compute the
shortest-path baseline (distance/time) through start -> waypoints (in order)
-> end. The route may deviate from this baseline to visit optional POIs
("candidates"), but total added distance/time is capped at
detour_budget_pct * baseline. Within that hard budget, maximize
sum(fun_score(selected candidates)).

This is a budgeted prize-collecting insertion problem: still NP-hard in
general, but a much smaller, cleaner formulation than open-ended multi-day
TSP (one global budget constraint instead of per-day time windows plus free
waypoint reordering).

Approach:
  1. Baseline: distance of the fixed route with no detours. The detour
     budget is detour_budget_pct% of that baseline, in meters.
  2. Greedy insertion: repeatedly find the (candidate, edge) pair that
     yields the best fun_score / delta_distance ratio, insert it if its
     delta_distance still fits in the remaining budget, and repeat -- each
     iteration recomputes cheapest-insertion cost against the *current*
     route, since inserting a stop changes the edges available to later
     candidates.
  3. Optional bounded 2-opt: wall-clock-limited local search that reverses
     sub-segments of the resulting route to shed wasted distance, freeing
     leftover budget for another greedy pass.
  4. Day-splitting: a separate post-processing function, not part of the
     core optimization loop (see split_into_days below).

No HTTP/DB dependencies here -- pure function of MfpInput -> MfpResult, so
it's independently unit-testable per the plan's testing exception.
"""

import time

from app.algorithm.geo import distance_m, duration_s
from app.algorithm.types import (
    Candidate,
    MfpInput,
    MfpResult,
    Point,
    SelectedStop,
)


def _route_distance_m(route: list[Point]) -> float:
    return sum(distance_m(route[i], route[i + 1]) for i in range(len(route) - 1))


def _best_insertion(candidate: Candidate, route: list[Point]) -> tuple[int, float]:
    """Cheapest edge in `route` to insert `candidate` into.

    Returns (index, delta_distance_m) where `index` means "insert after
    route[index]" -- i.e. the new stop goes between route[index] and
    route[index + 1].
    """
    best_index = 0
    best_delta = float("inf")
    for i in range(len(route) - 1):
        a, b = route[i], route[i + 1]
        delta = distance_m(a, candidate.point) + distance_m(candidate.point, b) - distance_m(a, b)
        if delta < best_delta:
            best_delta = delta
            best_index = i
    return best_index, best_delta


def _two_opt(route: list[Point], deadline: float) -> list[Point]:
    """Bounded 2-opt: repeatedly reverse sub-segments that shorten the
    route, stopping as soon as no improving swap is found or the wall-clock
    deadline is hit. Endpoints (route[0], route[-1]) are never moved --
    2-opt here only reorders *positions*, and start/end are fixed by
    definition, so reversal candidates are restricted to the interior.
    """
    improved = True
    while improved and time.monotonic() < deadline:
        improved = False
        for i in range(1, len(route) - 2):
            if time.monotonic() >= deadline:
                break
            for j in range(i + 1, len(route) - 1):
                a, b = route[i - 1], route[i]
                c, d = route[j], route[j + 1]
                current = distance_m(a, b) + distance_m(c, d)
                swapped = distance_m(a, c) + distance_m(b, d)
                if swapped < current:
                    route[i : j + 1] = reversed(route[i : j + 1])
                    improved = True
    return route


def solve(input: MfpInput, max_solve_time_ms: int = 3000) -> MfpResult:
    """Runs the greedy detour-budgeted insertion heuristic and returns the
    final stop sequence, selected candidates, and solve stats.

    max_solve_time_ms bounds the optional local-search refinement step (not
    the initial greedy pass, which is fast/deterministic) so the whole call
    comfortably fits within the API's request timeout.
    """
    start_time = time.monotonic()

    route: list[Point] = [input.start, *(wp.point for wp in input.waypoints), input.end]
    baseline_distance_m = _route_distance_m(route)
    budget_m = baseline_distance_m * input.detour_budget_pct / 100

    remaining = list(input.candidates)
    selected: list[SelectedStop] = []
    used_m = 0.0
    total_fun_score = 0.0

    while remaining:
        best_candidate: Candidate | None = None
        best_index = 0
        best_delta = float("inf")
        best_ratio = -1.0

        for c in remaining:
            index, delta = _best_insertion(c, route)
            if delta <= 0:
                # Degenerate/duplicate point sitting on the existing route --
                # free to insert, always worth it.
                ratio = float("inf")
            else:
                ratio = c.fun_score / delta
            if ratio > best_ratio:
                best_ratio = ratio
                best_candidate = c
                best_index = index
                best_delta = delta

        if best_candidate is None or used_m + best_delta > budget_m:
            break

        route.insert(best_index + 1, best_candidate.point)
        selected.append(SelectedStop(candidate=best_candidate, insert_after_index=best_index))
        used_m += best_delta
        total_fun_score += best_candidate.fun_score
        remaining.remove(best_candidate)

    deadline = start_time + max_solve_time_ms / 1000
    route = _two_opt(route, deadline)

    total_distance_m = _route_distance_m(route)
    solve_time_ms = int((time.monotonic() - start_time) * 1000)

    return MfpResult(
        stop_sequence=route,
        selected_stops=selected,
        total_fun_score=total_fun_score,
        total_distance_m=total_distance_m,
        total_duration_s=duration_s(total_distance_m),
        detour_used_pct=(used_m / baseline_distance_m * 100) if baseline_distance_m > 0 else 0.0,
        unassigned_candidate_count=len(remaining),
        solve_time_ms=solve_time_ms,
    )


def split_into_days(
    result: MfpResult, total_days: int, max_driving_hours_per_day: float
) -> list[list[Point]]:
    """Post-processing step, not part of the core solve: splits the final
    stop sequence into `total_days` legs, each bounded by
    max_driving_hours_per_day. Deliberately simple/greedy -- this is not
    where the interesting algorithmic complexity lives.
    """
    route = result.stop_sequence
    if not route:
        return []

    max_seconds_per_day = max_driving_hours_per_day * 3600
    days: list[list[Point]] = [[route[0]]]
    day_seconds = 0.0

    for i in range(1, len(route)):
        leg_seconds = duration_s(distance_m(route[i - 1], route[i]))
        if day_seconds + leg_seconds > max_seconds_per_day and len(days) < total_days:
            days.append([])
            day_seconds = 0.0
        days[-1].append(route[i])
        day_seconds += leg_seconds

    return days
