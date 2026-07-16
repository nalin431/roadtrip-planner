import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Poi, PoiCacheQuery
from app.places.client import PlacesClient
from app.places.geohash import GEOHASH_PRECISION_5KM, encode, neighbor_cells
from app.places.score import fun_score

logger = logging.getLogger(__name__)

_DEFAULT_TTL = timedelta(days=30)


class PlacesCache:
    def __init__(self, client: PlacesClient) -> None:
        self._client = client

    async def get_candidates(
        self, db: AsyncSession, lat: float, lng: float, radius_m: int, category: str
    ) -> list[Poi]:
        """Returns cached POIs for the given category within radius_m of (lat, lng),
        refreshing from the Places API first if the corresponding cache query
        entry is missing or expired. Read-through, write-on-miss: a fresh entry
        short-circuits straight to the DB read.
        """
        geocell = encode(lat, lng, GEOHASH_PRECISION_5KM)

        fresh = await db.execute(
            select(PoiCacheQuery.id).where(
                PoiCacheQuery.geocell == geocell,
                PoiCacheQuery.category == category,
                PoiCacheQuery.radius_m == radius_m,
                PoiCacheQuery.expires_at > datetime.now(UTC),
            )
        )
        if fresh.scalar_one_or_none() is None:
            await self._refresh(db, lat, lng, radius_m, category, geocell)

        cells = neighbor_cells(lat, lng, GEOHASH_PRECISION_5KM)
        result = await db.execute(
            select(Poi).where(Poi.geocell.in_(cells), Poi.expires_at > datetime.now(UTC))
        )
        return list(result.scalars().all())

    async def _refresh(
        self, db: AsyncSession, lat: float, lng: float, radius_m: int, category: str, geocell: str
    ) -> None:
        results = await self._client.nearby_search(lat, lng, radius_m, category)
        expires_at = datetime.now(UTC) + _DEFAULT_TTL

        for r in results:
            place_id = r.get("place_id")
            if not place_id:
                continue

            geometry = r.get("geometry", {}).get("location", {})
            poi_lat = geometry.get("lat")
            poi_lng = geometry.get("lng")
            if poi_lat is None or poi_lng is None:
                logger.warning("place result missing geometry", extra={"place_id": place_id})
                continue

            rating = r.get("rating", 0.0)
            user_ratings_total = r.get("user_ratings_total", 0)
            score = fun_score(rating, user_ratings_total, category)
            poi_geocell = encode(poi_lat, poi_lng, GEOHASH_PRECISION_5KM)

            stmt = insert(Poi).values(
                google_place_id=place_id,
                name=r.get("name", ""),
                category=category,
                lat=poi_lat,
                lng=poi_lng,
                geocell=poi_geocell,
                rating=rating,
                user_ratings_total=user_ratings_total,
                price_level=r.get("price_level"),
                fun_score=score,
                raw_places_json=r,
                expires_at=expires_at,
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=[Poi.google_place_id],
                set_={
                    "name": stmt.excluded.name,
                    "category": stmt.excluded.category,
                    "lat": stmt.excluded.lat,
                    "lng": stmt.excluded.lng,
                    "geocell": stmt.excluded.geocell,
                    "rating": stmt.excluded.rating,
                    "user_ratings_total": stmt.excluded.user_ratings_total,
                    "price_level": stmt.excluded.price_level,
                    "fun_score": stmt.excluded.fun_score,
                    "raw_places_json": stmt.excluded.raw_places_json,
                    "fetched_at": datetime.now(UTC),
                    "expires_at": stmt.excluded.expires_at,
                },
            )
            try:
                await db.execute(stmt)
            except Exception:
                logger.exception("upsert poi failed", extra={"place_id": place_id})

        cache_query_stmt = insert(PoiCacheQuery).values(
            geocell=geocell,
            category=category,
            radius_m=radius_m,
            expires_at=expires_at,
            result_count=len(results),
        )
        cache_query_stmt = cache_query_stmt.on_conflict_do_update(
            index_elements=[PoiCacheQuery.geocell, PoiCacheQuery.category, PoiCacheQuery.radius_m],
            set_={
                "fetched_at": datetime.now(UTC),
                "expires_at": cache_query_stmt.excluded.expires_at,
                "result_count": cache_query_stmt.excluded.result_count,
            },
        )
        await db.execute(cache_query_stmt)
        await db.commit()
