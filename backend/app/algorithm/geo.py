"""Great-circle distance helper.

There is no cached driving-distance/duration source yet (route_segments /
Directions API caching is a deferred stretch goal -- see ARCHITECTURE.md), so
the solver uses haversine distance as its routing-cost proxy. This
overestimates detour "value" slightly for winding roads, but is a reasonable
stand-in and keeps app/algorithm free of any HTTP dependency.
"""

import math

from app.algorithm.types import Point

EARTH_RADIUS_M = 6_371_000.0

# Rough average speed used to turn distance into a duration estimate for
# day-splitting, in the absence of a real routing API. Not meant to be
# precise -- just enough to bound driving-hours-per-day.
AVERAGE_SPEED_KMH = 60.0


def distance_m(a: Point, b: Point) -> float:
    """Haversine distance between two points, in meters."""
    lat1, lng1 = math.radians(a.lat), math.radians(a.lng)
    lat2, lng2 = math.radians(b.lat), math.radians(b.lng)

    dlat = lat2 - lat1
    dlng = lng2 - lng1

    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def duration_s(distance_meters: float) -> float:
    """Estimated driving duration for a distance, using a flat average speed."""
    speed_m_s = AVERAGE_SPEED_KMH * 1000 / 3600
    return distance_meters / speed_m_s
