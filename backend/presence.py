"""
In-memory presence tracker.
Touched on every authenticated request via get_current_user.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List

_presence: Dict[str, datetime] = {}

ONLINE_THRESHOLD_SECONDS: int = 300  # 5 minutes


def touch(user_id: uuid.UUID) -> None:
    _presence[str(user_id)] = datetime.now(timezone.utc)


def get_online_ids() -> List[str]:
    threshold = datetime.now(timezone.utc) - timedelta(seconds=ONLINE_THRESHOLD_SECONDS)
    return [uid for uid, last_seen in _presence.items() if last_seen > threshold]
