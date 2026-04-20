"""
Script to initialise dev.db and insert a test user + invite code.
Run from the backend/ directory with the venv active:

  python init_db.py --email you@local --username you --password secret

Requires backend/.env with DATABASE_URL and SECRET_KEY.
"""
from __future__ import annotations

import argparse
import asyncio
import uuid
from datetime import datetime, timezone

from passlib.context import CryptContext
from sqlalchemy import select

from database import AsyncSessionLocal, engine
from models import Base, ChipsLedger, InviteCode, User

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

parser = argparse.ArgumentParser()
parser.add_argument('--email',    default='admin@local')
parser.add_argument('--username', default='admin')
parser.add_argument('--password', default='admin123')
parser.add_argument('--invite',   default=None, help='Custom invite code (auto-generated if omitted)')
args = parser.parse_args()


async def main() -> None:
    # Create all tables from ORM models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created (or already exist).")

    async with AsyncSessionLocal() as db:
        # Check duplicate email
        existing = (await db.execute(select(User).where(User.email == args.email))).scalar_one_or_none()
        if existing:
            print(f"User {args.email} already exists — skipping.")
        else:
            user_id = uuid.uuid4()
            now = datetime.now(timezone.utc)
            user = User(
                id=user_id,
                username=args.username,
                email=args.email,
                password_hash=_pwd.hash(args.password),
                display_name=args.username,
                avatar_initials=args.username[:2].upper(),
                chips_balance=10000,
                is_active=True,
                is_admin=True,
                created_at=now,
                updated_at=now,
            )
            db.add(user)
            await db.flush()
            db.add(ChipsLedger(
                id=uuid.uuid4(),
                user_id=user_id,
                amount=10000,
                balance_after=10000,
                reason="registration_bonus",
                description="Bonus benvenuto al Ridotto",
            ))
            print(f"Created user: {args.username} / {args.email}")

        # Invite code
        code = args.invite or ('LOCAL' + uuid.uuid4().hex[:6].upper())
        inv_existing = (await db.execute(select(InviteCode).where(InviteCode.code == code))).scalar_one_or_none()
        if inv_existing:
            print(f"Invite code {code} already exists — skipping.")
        else:
            creator = (await db.execute(select(User).where(User.email == args.email))).scalar_one_or_none()
            if creator is None:
                creator = (await db.execute(select(User))).scalars().first()
            db.add(InviteCode(
                id=uuid.uuid4(),
                code=code,
                created_by=creator.id,
                max_uses=9999,
                use_count=0,
                is_active=True,
            ))
            print(f"Created invite code: {code}")

        await db.commit()

    print(f"\nDone.")
    print(f"  Email:    {args.email}")
    print(f"  Password: {args.password}")
    print(f"  Invite:   {code}")


asyncio.run(main())

