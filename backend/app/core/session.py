import uuid

from fastapi import Depends, Request, Response
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Session as SessionRow
from app.db.session import get_session

COOKIE_NAME = "session_id"
COOKIE_MAX_AGE = 180 * 24 * 60 * 60  # 180 days


async def _resolve_session(request: Request, db: AsyncSession) -> uuid.UUID | None:
    raw = request.cookies.get(COOKIE_NAME)
    if not raw:
        return None
    try:
        session_id = uuid.UUID(raw)
    except ValueError:
        return None

    result = await db.execute(select(SessionRow.id).where(SessionRow.id == session_id))
    if result.scalar_one_or_none() is None:
        return None
    return session_id


async def require_session(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_session),
) -> uuid.UUID:
    """FastAPI dependency that ensures the request carries a valid session:
    reads the session_id cookie if present and the session still exists,
    otherwise creates a new session row and sets a fresh cookie. Applied only
    to routes that need a session (trips), not globally, so /api/healthz stays
    session-free.
    """
    session_id = await _resolve_session(request, db)

    if session_id is None:
        row = SessionRow()
        db.add(row)
        await db.commit()
        await db.refresh(row)
        session_id = row.id
        response.set_cookie(
            key=COOKIE_NAME,
            value=str(session_id),
            max_age=COOKIE_MAX_AGE,
            path="/",
            httponly=True,
            secure=True,
            samesite="none",
        )
    else:
        await db.execute(
            update(SessionRow).where(SessionRow.id == session_id).values(last_seen_at=func.now())
        )
        await db.commit()

    return session_id
