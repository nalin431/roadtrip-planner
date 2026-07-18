import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import healthz, plan, trips
from app.core.config import settings
from app.core.logging import configure_logging

configure_logging(settings.app_env)
logger = logging.getLogger(__name__)

app = FastAPI(title="Road Trip Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(healthz.router)
app.include_router(trips.router)
app.include_router(plan.router)


@app.middleware("http")
async def log_requests(request, call_next):  # type: ignore[no-untyped-def]
    response = await call_next(request)
    logger.info("request", extra={"method": request.method, "path": request.url.path})
    return response
