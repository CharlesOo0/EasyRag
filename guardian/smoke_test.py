"""Manual, one-off smoke test against a REAL Azure Table Storage account -
not part of the pytest suite (needs live credentials + a real resource).
Run once before trusting TableStateStore, then delete the test resource
group. See docs/azure-deployment-plan.md for the run this validated.

    python smoke_test.py <storage_account_name>
"""

from __future__ import annotations

import sys
from datetime import timedelta

from app.guard_logic import utcnow
from app.state import Flags, TableStateStore


def check(label: str, condition: bool) -> None:
    status = "OK" if condition else "FAIL"
    print(f"[{status}] {label}")
    if not condition:
        raise SystemExit(1)


def main() -> None:
    account_name = sys.argv[1]
    store = TableStateStore(account_name, "guardianstate")

    now = utcnow()

    # --- sessions -----------------------------------------------------
    check("no sessions initially", store.list_sessions() == [])

    store.open_session(now)
    sessions = store.list_sessions()
    check("one session after open_session", len(sessions) == 1)
    check("the session is open (end is None)", sessions[0].end is None)

    store.open_session(now + timedelta(seconds=1))
    sessions = store.list_sessions()
    check(
        "opening a second session while one is open is a no-op",
        len(sessions) == 1,
    )

    close_time = now + timedelta(minutes=5)
    store.close_open_session(close_time)
    sessions = store.list_sessions()
    check("still exactly one session after closing", len(sessions) == 1)
    check(
        "the real 'End eq null' query found and closed it",
        sessions[0].end is not None and sessions[0].end == close_time,
    )

    store.close_open_session(now)
    check(
        "closing with no open session left is a safe no-op",
        len(store.list_sessions()) == 1,
    )

    # --- flags ----------------------------------------------------------
    flags = Flags(
        budget_exceeded_at=now,
        last_request_at=now,
        expected_running=True,
        last_eviction_at=now - timedelta(minutes=1),
    )
    store.set_flags(flags)
    round_tripped = store.get_flags()
    check("budget_exceeded_at round-trips", round_tripped.budget_exceeded_at == now)
    check("last_request_at round-trips", round_tripped.last_request_at == now)
    check("expected_running round-trips", round_tripped.expected_running is True)
    check(
        "last_eviction_at round-trips",
        round_tripped.last_eviction_at == now - timedelta(minutes=1),
    )

    print("\nAll smoke checks passed against a real Table Storage account.")


if __name__ == "__main__":
    main()
