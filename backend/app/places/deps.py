from functools import lru_cache

from app.core.config import settings
from app.places.cache import PlacesCache
from app.places.client import PlacesClient


@lru_cache(maxsize=1)
def get_places_cache() -> PlacesCache:
    """Process-wide singleton: one httpx client reused across requests/Lambda
    invocations within the same warm instance, mirroring the DB engine's
    module-level lifecycle in app/db/session.py.
    """
    client = PlacesClient(settings.google_places_api_key)
    return PlacesCache(client)
