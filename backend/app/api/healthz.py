from fastapi import APIRouter

router = APIRouter()


@router.get("/api/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
