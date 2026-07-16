from typing import Any

import httpx

_NEARBY_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"


class PlacesClient:
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._client = httpx.AsyncClient(timeout=10.0)

    async def nearby_search(
        self, lat: float, lng: float, radius_m: int, category: str
    ) -> list[dict[str, Any]]:
        """Calls Google Places Nearby Search for the given center, radius (meters),
        and category (a Places "type", e.g. "tourist_attraction").
        """
        params: dict[str, str | int] = {
            "location": f"{lat},{lng}",
            "radius": radius_m,
            "type": category,
            "key": self._api_key,
        }

        response = await self._client.get(_NEARBY_SEARCH_URL, params=params)
        response.raise_for_status()
        payload = response.json()

        status = payload.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            raise RuntimeError(f"places API error: {status}")

        results: list[dict[str, Any]] = payload.get("results", [])
        return results

    async def aclose(self) -> None:
        await self._client.aclose()
