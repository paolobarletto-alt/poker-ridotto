import asyncio
import sys
sys.path.insert(0, '.')

async def main():
    from database import AsyncSessionLocal
    from models import User
    from auth import hash_password
    from sqlalchemy import select
    import uuid
    from datetime import datetime
    
    async with AsyncSessionLocal() as db:
        # Check existing users
        result = await db.execute(select(User))
        users = result.scalars().all()
        print('Existing users:', [(u.username, u.email) for u in users])

asyncio.run(main())
