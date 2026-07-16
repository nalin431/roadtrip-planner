import pytest

from app.places.geohash import GEOHASH_PRECISION_5KM, encode, neighbor_cells


@pytest.mark.parametrize(
    ("lat", "lng", "precision", "expected"),
    [
        # Reference value from geohash.org for San Francisco.
        (37.7749, -122.4194, 9, "9q8yyk8yt"),
        # Reference value for (0, 0).
        (0, 0, 5, "s0000"),
    ],
)
def test_encode(lat: float, lng: float, precision: int, expected: str) -> None:
    assert encode(lat, lng, precision) == expected


def test_encode_consistent_precision() -> None:
    result = encode(37.7749, -122.4194, GEOHASH_PRECISION_5KM)
    assert len(result) == GEOHASH_PRECISION_5KM


def test_neighbor_cells_includes_center() -> None:
    lat, lng = 37.7749, -122.4194
    center = encode(lat, lng, GEOHASH_PRECISION_5KM)
    neighbors = neighbor_cells(lat, lng, GEOHASH_PRECISION_5KM)
    assert center in neighbors
