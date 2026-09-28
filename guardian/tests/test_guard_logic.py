from datetime import datetime, timedelta, timezone

import pytest

from app.guard_logic import (
    Session,
    budget_flag_active,
    can_wake,
    hours_used_in_month,
    is_idle,
    month_bounds,
)

UTC = timezone.utc


def dt(y, m, d, h=0, minute=0):
    return datetime(y, m, d, h, minute, tzinfo=UTC)


# --- month_bounds ---------------------------------------------------------


def test_month_bounds_mid_year():
    start, end = month_bounds(dt(2026, 9, 15, 12))
    assert start == dt(2026, 9, 1)
    assert end == dt(2026, 10, 1)


def test_month_bounds_december_rolls_to_next_january():
    start, end = month_bounds(dt(2026, 12, 20))
    assert start == dt(2026, 12, 1)
    assert end == dt(2027, 1, 1)


# --- hours_used_in_month ----------------------------------------------------


def test_no_sessions_is_zero_hours():
    assert hours_used_in_month([], now=dt(2026, 9, 15)) == 0


def test_closed_session_entirely_inside_month():
    sessions = [Session(start=dt(2026, 9, 10, 8), end=dt(2026, 9, 10, 10))]
    assert hours_used_in_month(sessions, now=dt(2026, 9, 15)) == pytest.approx(2.0)


def test_open_session_clamped_to_now():
    sessions = [Session(start=dt(2026, 9, 15, 8), end=None)]
    used = hours_used_in_month(sessions, now=dt(2026, 9, 15, 8, 30))
    assert used == pytest.approx(0.5)


def test_session_spanning_month_boundary_only_counts_current_month_portion():
    # Started 2h before month end, still open 3h into the new month - only
    # the 3h in the new month should count, not the total 5h session.
    sessions = [Session(start=dt(2026, 8, 31, 22), end=None)]
    used = hours_used_in_month(sessions, now=dt(2026, 9, 1, 3))
    assert used == pytest.approx(3.0)


def test_session_entirely_in_a_previous_month_contributes_nothing():
    sessions = [Session(start=dt(2026, 8, 5, 8), end=dt(2026, 8, 5, 12))]
    assert hours_used_in_month(sessions, now=dt(2026, 9, 15)) == 0


def test_multiple_sessions_are_summed():
    sessions = [
        Session(start=dt(2026, 9, 1, 8), end=dt(2026, 9, 1, 9)),  # 1h
        Session(start=dt(2026, 9, 2, 8), end=dt(2026, 9, 2, 8, 30)),  # 0.5h
        Session(start=dt(2026, 9, 15, 10), end=None),  # open, 2h so far
    ]
    used = hours_used_in_month(sessions, now=dt(2026, 9, 15, 12))
    assert used == pytest.approx(3.5)


def test_open_session_never_counts_beyond_now_even_if_end_missing():
    # Guards against a bug where a still-open session could be read as
    # running forever (e.g. clamping to month_end instead of now).
    sessions = [Session(start=dt(2026, 9, 1, 0), end=None)]
    used = hours_used_in_month(sessions, now=dt(2026, 9, 1, 1))
    assert used == pytest.approx(1.0)


def test_session_requires_timezone_aware_datetimes():
    with pytest.raises(ValueError):
        Session(start=datetime(2026, 9, 1))  # naive, no tzinfo


# --- can_wake ---------------------------------------------------------------


def test_can_wake_allows_when_no_usage_yet():
    decision = can_wake(
        [], budget_exceeded_at=None, max_monthly_hours=10, now=dt(2026, 9, 15)
    )
    assert decision.allowed is True
    assert decision.reason == "ok"


def test_can_wake_blocks_on_budget_exceeded_regardless_of_hours():
    decision = can_wake(
        [],
        budget_exceeded_at=dt(2026, 9, 10),
        max_monthly_hours=10,
        now=dt(2026, 9, 15),
    )
    assert decision.allowed is False
    assert decision.reason == "budget_exceeded"


def test_can_wake_allows_just_under_the_cap():
    sessions = [Session(start=dt(2026, 9, 1, 0), end=dt(2026, 9, 1, 9, 59))]
    decision = can_wake(
        sessions, budget_exceeded_at=None, max_monthly_hours=10, now=dt(2026, 9, 15)
    )
    assert decision.allowed is True


def test_can_wake_blocks_exactly_at_the_cap():
    sessions = [Session(start=dt(2026, 9, 1, 0), end=dt(2026, 9, 1, 10))]
    decision = can_wake(
        sessions, budget_exceeded_at=None, max_monthly_hours=10, now=dt(2026, 9, 15)
    )
    assert decision.allowed is False
    assert decision.reason == "hour_cap_reached"


def test_can_wake_blocks_past_the_cap():
    sessions = [Session(start=dt(2026, 9, 1, 0), end=dt(2026, 9, 1, 11))]
    decision = can_wake(
        sessions, budget_exceeded_at=None, max_monthly_hours=10, now=dt(2026, 9, 15)
    )
    assert decision.allowed is False
    assert decision.reason == "hour_cap_reached"


def test_can_wake_resets_naturally_on_new_month_without_explicit_reset():
    # 9h used in August should not block September even though nothing
    # ever "reset" the count - it's a filtered sum, not a mutable counter.
    sessions = [Session(start=dt(2026, 8, 1, 0), end=dt(2026, 8, 1, 9))]
    decision = can_wake(
        sessions,
        budget_exceeded_at=None,
        max_monthly_hours=10,
        now=dt(2026, 9, 1, 0, 1),
    )
    assert decision.allowed is True


def test_can_wake_budget_flag_from_last_month_does_not_block_this_month():
    decision = can_wake(
        [],
        budget_exceeded_at=dt(2026, 8, 20),
        max_monthly_hours=10,
        now=dt(2026, 9, 1, 0, 1),
    )
    assert decision.allowed is True


# --- budget_flag_active -------------------------------------------------


def test_budget_flag_inactive_when_never_set():
    assert budget_flag_active(None, now=dt(2026, 9, 15)) is False


def test_budget_flag_active_same_month():
    assert budget_flag_active(dt(2026, 9, 2), now=dt(2026, 9, 28)) is True


def test_budget_flag_inactive_after_month_rolls_over():
    assert budget_flag_active(dt(2026, 8, 31, 23), now=dt(2026, 9, 1, 0, 1)) is False


# --- is_idle -----------------------------------------------------------------


def test_is_idle_true_when_no_request_ever_seen():
    assert is_idle(None, now=dt(2026, 9, 15), idle_minutes=12) is True


def test_is_idle_false_just_under_threshold():
    last = dt(2026, 9, 15, 12, 0)
    now = last + timedelta(minutes=11, seconds=59)
    assert is_idle(last, now=now, idle_minutes=12) is False


def test_is_idle_true_exactly_at_threshold():
    last = dt(2026, 9, 15, 12, 0)
    now = last + timedelta(minutes=12)
    assert is_idle(last, now=now, idle_minutes=12) is True


def test_is_idle_true_well_past_threshold():
    last = dt(2026, 9, 15, 12, 0)
    now = last + timedelta(hours=2)
    assert is_idle(last, now=now, idle_minutes=12) is True


def test_is_idle_rejects_naive_last_request_at():
    with pytest.raises(ValueError):
        is_idle(datetime(2026, 9, 15), now=dt(2026, 9, 15, 1), idle_minutes=12)
