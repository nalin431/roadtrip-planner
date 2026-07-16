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

Planned shape (see the plan doc for full detail -- left unimplemented
deliberately, the algorithm design is being finalized separately):
  1. Candidate generation / corridor filtering (may happen before this call,
     via app.places.cache -- solve() may just receive pre-filtered candidates).
  2. Greedy insertion by fun_score / delta_distance ratio, respecting the
     detour budget.
  3. Optional bounded local search (2-opt) to reduce wasted distance.
  4. Day-splitting: a separate post-processing function, not part of the
     core optimization loop (see split_into_days below).

No HTTP/DB dependencies here -- pure function of MfpInput -> MfpResult, so
it's independently unit-testable per the plan's testing exception.
"""

from app.algorithm.types import MfpInput, MfpResult


def solve(input: MfpInput, max_solve_time_ms: int = 3000) -> MfpResult:
    """Runs the greedy detour-budgeted insertion heuristic and returns the
    final stop sequence, selected candidates, and solve stats.

    max_solve_time_ms bounds the optional local-search refinement step (not
    the initial greedy pass, which is fast/deterministic) so the whole call
    comfortably fits within the API's request timeout.
    """
    raise NotImplementedError


def split_into_days(result: MfpResult, total_days: int, max_driving_hours_per_day: float) -> list[list]:  # type: ignore[type-arg]
    """Post-processing step, not part of the core solve: splits the final
    stop sequence into `total_days` legs, each bounded by
    max_driving_hours_per_day. Deliberately simple/greedy -- this is not
    where the interesting algorithmic complexity lives.
    """
    raise NotImplementedError
