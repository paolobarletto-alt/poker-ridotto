from __future__ import annotations

import logging
import uuid

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from config import settings
from database import AsyncSessionLocal
from models import ChipsLedger, User

logger = logging.getLogger("ridotto.scheduler")

REFILL_THRESHOLD = settings.DAILY_REFILL_THRESHOLD
REFILL_AMOUNT = settings.DAILY_REFILL_AMOUNT


async def daily_chips_refill() -> int:
    """Refill chips for users below the threshold. Returns count of users refilled."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(
                User.is_active == True,
                User.chips_balance < REFILL_THRESHOLD,
            )
        )
        users = result.scalars().all()
        count = 0
        for user in users:
            added = REFILL_AMOUNT - user.chips_balance
            user.chips_balance = REFILL_AMOUNT
            db.add(
                ChipsLedger(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    amount=added,
                    balance_after=REFILL_AMOUNT,
                    reason="daily_refill",
                    description="Ricarica giornaliera automatica",
                )
            )
            count += 1
        await db.commit()
        logger.info("Daily refill: ricaricati %d utenti", count)
        return count


def start_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="Europe/Rome")
    scheduler.add_job(daily_chips_refill, "cron", hour=6, minute=0)
    scheduler.start()
    logger.info("Scheduler APScheduler avviato (daily refill alle 06:00 Europe/Rome)")
    return scheduler
