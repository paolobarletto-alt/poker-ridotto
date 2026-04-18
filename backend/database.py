from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

from config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    poolclass=NullPool,
    connect_args={"statement_cache_size": 0},
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
