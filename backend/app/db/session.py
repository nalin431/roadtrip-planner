from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# statement_cache_size=0 disables asyncpg's server-side prepared statement cache.
# Required because DATABASE_URL points at Supabase's transaction-mode pooler
# (pgbouncer), which does not support prepared statements across pooled
# connections -- without this, repeated queries fail with
# "prepared statement already exists" once pgbouncer reassigns the underlying
# connection between calls.
engine = create_async_engine(
    settings.database_url,
    pool_size=2,
    max_overflow=0,
    connect_args={"statement_cache_size": 0},
)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
