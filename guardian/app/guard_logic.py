"""Pure decision logic for the guardian - no I/O, no Azure SDK, no clock reads.
Everything here takes `now` as an explicit argument so it's fully deterministic
and unit-testable. This is the part that decides whether real money gets
spent (starting a VM) or an app stays unreachable (refusing to), so it is
kept small and isolated on purpose - see tests/test_guard_logic.py.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass(frozen=True)
class Session:
    """One VM run, start to end. `end=None` means still running - its
    duration is computed by clamping to `now` at query time, never stored,
    so a guardian restart mid-session can't lose or double count time."""

    start: datetime
    end: datetime | None = None

    def __post_init__(self) -> None:
        if self.start.tzinfo is None:
            raise ValueError("Session.start must be timezone-aware (UTC)")
        if self.end is not None and self.end.tzinfo is None:
            raise ValueError("Session.end must be timezone-aware (UTC)")


@dataclass(frozen=True)
class WakeDecision:
    allowed: bool
    reason: str  # "ok" | "budget_exceeded" | "hour_cap_reached"


def month_bounds(now: datetime) -> tuple[datetime, datetime]:
    """[start, end) of now's UTC calendar month."""
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def hours_used_in_month(sessions: list[Session], now: datetime) -> float:
    """Sum of session time that overlaps now's calendar month, in hours.
    Open sessions are clamped to `now`; sessions are clamped to the month
    window on both ends - a VM left running across a month boundary only
    counts the portion inside the current month, so there is no explicit
    "reset the counter" step to ever get wrong or forget."""
    month_start, month_end = month_bounds(now)
    total = timedelta()
    for session in sessions:
        session_end = session.end if session.end is not None else now
        overlap_start = max(session.start, month_start)
        overlap_end = min(session_end, month_end, now)
        if overlap_end > overlap_start:
            total += overlap_end - overlap_start
    return total.total_seconds() / 3600.0


def budget_flag_active(budget_exceeded_at: datetime | None, now: datetime) -> bool:
    """A budget-exceeded alert is only meaningful for the month it fired in -
    Azure's budget itself tracks spend per calendar month, so a flag left
    over from last month must not keep blocking forever. There is no
    explicit "clear the flag" step to forget on rollover; like the hour
    cap, it's just recomputed from `now` each time."""
    if budget_exceeded_at is None:
        return False
    return month_bounds(budget_exceeded_at) == month_bounds(now)


def can_wake(
    sessions: list[Session],
    *,
    budget_exceeded_at: datetime | None,
    max_monthly_hours: float,
    now: datetime,
) -> WakeDecision:
    """Should the guardian start the VM for an incoming request right now?
    Checked BEFORE calling the Azure start API - never the other way round."""
    if budget_flag_active(budget_exceeded_at, now):
        return WakeDecision(False, "budget_exceeded")
    used = hours_used_in_month(sessions, now)
    if used >= max_monthly_hours:
        return WakeDecision(False, "hour_cap_reached")
    return WakeDecision(True, "ok")


def is_idle(last_request_at: datetime | None, now: datetime, idle_minutes: float) -> bool:
    """No traffic recorded at all counts as idle - a running VM with no
    known last-request timestamp should not be able to stay up forever by
    default."""
    if last_request_at is None:
        return True
    if last_request_at.tzinfo is None:
        raise ValueError("last_request_at must be timezone-aware (UTC)")
    return (now - last_request_at) >= timedelta(minutes=idle_minutes)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
