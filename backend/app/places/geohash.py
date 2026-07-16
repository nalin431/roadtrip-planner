"""Geohash encoding for POI cache bucketing. Ported from the Go implementation
(backend/internal/places/geohash.go in an earlier iteration of this project),
which was unit-tested against known reference values from geohash.org -- the
algorithm itself is unchanged, only the language.
"""

_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"

# Geohash string length whose cells are roughly 5km x 5km, used to bucket POI
# cache lookups/writes.
GEOHASH_PRECISION_5KM = 5


def encode(lat: float, lng: float, precision: int) -> str:
    """Returns the geohash for (lat, lng) truncated to `precision` characters."""
    lat_range = [-90.0, 90.0]
    lng_range = [-180.0, 180.0]

    hash_chars: list[str] = []
    bit = 0
    ch = 0
    even_bit = True

    while len(hash_chars) < precision:
        if even_bit:
            mid = (lng_range[0] + lng_range[1]) / 2
            if lng >= mid:
                ch |= 1 << (4 - bit)
                lng_range[0] = mid
            else:
                lng_range[1] = mid
        else:
            mid = (lat_range[0] + lat_range[1]) / 2
            if lat >= mid:
                ch |= 1 << (4 - bit)
                lat_range[0] = mid
            else:
                lat_range[1] = mid

        even_bit = not even_bit
        if bit < 4:
            bit += 1
        else:
            hash_chars.append(_BASE32[ch])
            bit, ch = 0, 0

    return "".join(hash_chars)


def _cell_bounds(lat: float, lng: float, precision: int) -> tuple[tuple[float, float], tuple[float, float]]:
    """Returns the (lat_range, lng_range) bounding box of the geohash cell
    that (lat, lng) falls into at the given precision.
    """
    lat_range = [-90.0, 90.0]
    lng_range = [-180.0, 180.0]

    bit = 0
    chars = 0
    even_bit = True

    while chars < precision:
        if even_bit:
            mid = (lng_range[0] + lng_range[1]) / 2
            if lng >= mid:
                lng_range[0] = mid
            else:
                lng_range[1] = mid
        else:
            mid = (lat_range[0] + lat_range[1]) / 2
            if lat >= mid:
                lat_range[0] = mid
            else:
                lat_range[1] = mid

        even_bit = not even_bit
        if bit < 4:
            bit += 1
        else:
            chars += 1
            bit = 0

    return (lat_range[0], lat_range[1]), (lng_range[0], lng_range[1])


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(v, hi))


def _wrap_lng(lng: float) -> float:
    while lng < -180:
        lng += 360
    while lng > 180:
        lng -= 360
    return lng


def neighbor_cells(lat: float, lng: float, precision: int) -> list[str]:
    """Returns the geocell covering (lat, lng) plus its 8 surrounding cells at
    the same precision, so a corridor search doesn't miss POIs just across a
    cell boundary.
    """
    (lat_lo, lat_hi), (lng_lo, lng_hi) = _cell_bounds(lat, lng, precision)
    lat_span = lat_hi - lat_lo
    lng_span = lng_hi - lng_lo

    seen: set[str] = set()
    cells: list[str] = []
    for d_lat in (-1, 0, 1):
        for d_lng in (-1, 0, 1):
            neighbor_lat = _clamp(lat + d_lat * lat_span, -90, 90)
            neighbor_lng = _wrap_lng(lng + d_lng * lng_span)
            cell = encode(neighbor_lat, neighbor_lng, precision)
            if cell not in seen:
                seen.add(cell)
                cells.append(cell)
    return cells
