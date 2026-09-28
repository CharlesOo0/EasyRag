"""Persistent guardian state, independent of the target VM (we need this to
decide whether to turn the VM *on*, so it cannot live on the VM itself).

Two implementations behind the same `StateStore` interface: `TableStateStore`
(real, Azure Table Storage) and `InMemoryStateStore` (tests). Sessions are
append-only - see guard_logic.py for why nothing here ever needs to "reset".
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, replace
from datetime import datetime, timezone

from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
from azure.data.tables import TableServiceClient, UpdateMode
from azure.identity import DefaultAzureCredential

from app.guard_logic import Session

_SESSION_PARTITION = "session"
_FLAGS_PARTITION = "flags"
_FLAGS_ROW = "singleton"


@dataclass(frozen=True)
class Flags:
    # Presence (not a bool) so it carries the month it was set in - see
    # guard_logic.budget_flag_active for why that matters.
    budget_exceeded_at: datetime | None = None
    last_request_at: datetime | None = None
    # True once the guardian has issued (or observed) a start and has not
    # yet intentionally stopped the VM - used to tell an eviction (found
    # stopped while expected_running=True) apart from a shutdown we did
    # ourselves (expected_running is set False *before* calling deallocate).
    expected_running: bool = False
    # Set when the tick loop finds the VM stopped while expected_running was
    # still True (eviction, not our own shutdown) - surfaced to callers so a
    # request arriving shortly after can say "capacity issue, retrying"
    # instead of a generic cold-start message. Not used by guard_logic.
    last_eviction_at: datetime | None = None


class StateStore(ABC):
    @abstractmethod
    def list_sessions(self) -> list[Session]: ...

    @abstractmethod
    def open_session(self, start: datetime) -> None:
        """No-op-safe: if a session is already open, does not open a second
        one (defense in depth alongside the in-process lock in main.py)."""

    @abstractmethod
    def close_open_session(self, end: datetime) -> None:
        """No-op if there is no open session."""

    @abstractmethod
    def get_flags(self) -> Flags: ...

    @abstractmethod
    def set_flags(self, flags: Flags) -> None: ...


class InMemoryStateStore(StateStore):
    """Test double. Not thread-safe by design - tests should not need it to be."""

    def __init__(self) -> None:
        self._sessions: list[Session] = []
        self._flags = Flags()

    def list_sessions(self) -> list[Session]:
        return list(self._sessions)

    def open_session(self, start: datetime) -> None:
        if any(s.end is None for s in self._sessions):
            return
        self._sessions.append(Session(start=start, end=None))

    def close_open_session(self, end: datetime) -> None:
        for i, s in enumerate(self._sessions):
            if s.end is None:
                self._sessions[i] = replace(s, end=end)
                return

    def get_flags(self) -> Flags:
        return self._flags

    def set_flags(self, flags: Flags) -> None:
        self._flags = flags


class TableStateStore(StateStore):
    """Uses the synchronous azure-data-tables client, called directly from
    async handlers in main.py (not via asyncio.to_thread) - each call blocks
    the event loop for its network round-trip. Deliberate simplification:
    this app's expected traffic is a handful of requests at a time (see the
    hour/budget caps in docs/azure-deployment-plan.md), so the added
    complexity of the async table client isn't worth it yet. Revisit if
    traffic ever grows enough for this to matter.

    "Find the open session" is done by fetching the (small) session
    partition and filtering client-side, not via an OData filter - an
    earlier version tried `End eq null` server-side, which a real Table
    Storage account rejects with 400 InvalidInput (caught by smoke_test.py
    before this went anywhere near production). Client-side filtering over
    a whole partition is fine at this app's scale (a session log of maybe a
    few hundred rows a year), so there was no need to chase the "correct"
    server-side syntax.
    """

    def __init__(self, account_name: str, table_name: str) -> None:
        credential = DefaultAzureCredential()
        service = TableServiceClient(
            endpoint=f"https://{account_name}.table.core.windows.net",
            credential=credential,
        )
        try:
            service.create_table(table_name)
        except ResourceExistsError:
            pass
        self._table = service.get_table_client(table_name)

    def list_sessions(self) -> list[Session]:
        entities = self._table.query_entities(
            f"PartitionKey eq '{_SESSION_PARTITION}'"
        )
        sessions = []
        for e in entities:
            sessions.append(
                Session(
                    start=_as_utc(e["Start"]),
                    end=_as_utc(e["End"]) if e.get("End") else None,
                )
            )
        return sessions

    def open_session(self, start: datetime) -> None:
        if any(s.end is None for s in self.list_sessions()):
            return
        row_key = start.isoformat()
        entity = {
            "PartitionKey": _SESSION_PARTITION,
            "RowKey": row_key,
            "Start": start,
        }
        try:
            # create() fails instead of overwriting if the row already
            # exists - a cheap extra guard against a double-start race if
            # this ever runs with more than one replica despite the docs.
            self._table.create_entity(entity)
        except ResourceExistsError:
            pass

    def close_open_session(self, end: datetime) -> None:
        # `End eq null` is NOT valid Table Storage OData (confirmed against a
        # real account: 400 InvalidInput) - filter client-side instead, same
        # as open_session()'s own open-session check just below.
        entities = self._table.query_entities(f"PartitionKey eq '{_SESSION_PARTITION}'")
        open_entities = [e for e in entities if not e.get("End")]
        # There should be exactly one open session; if bookkeeping ever
        # drifted and there is more than one, close all of them rather than
        # silently leaving one open (open sessions count as still-running
        # time forever, which is the unsafe direction to fail in).
        for e in open_entities:
            e["End"] = end
            self._table.update_entity(e, mode=UpdateMode.MERGE)

    def get_flags(self) -> Flags:
        try:
            e = self._table.get_entity(_FLAGS_PARTITION, _FLAGS_ROW)
        except ResourceNotFoundError:
            return Flags()
        return Flags(
            budget_exceeded_at=_as_utc(e["BudgetExceededAt"]) if e.get("BudgetExceededAt") else None,
            last_request_at=_as_utc(e["LastRequestAt"]) if e.get("LastRequestAt") else None,
            expected_running=bool(e.get("ExpectedRunning", False)),
            last_eviction_at=_as_utc(e["LastEvictionAt"]) if e.get("LastEvictionAt") else None,
        )

    def set_flags(self, flags: Flags) -> None:
        entity = {
            "PartitionKey": _FLAGS_PARTITION,
            "RowKey": _FLAGS_ROW,
            "ExpectedRunning": flags.expected_running,
        }
        if flags.last_request_at is not None:
            entity["LastRequestAt"] = flags.last_request_at
        if flags.last_eviction_at is not None:
            entity["LastEvictionAt"] = flags.last_eviction_at
        if flags.budget_exceeded_at is not None:
            entity["BudgetExceededAt"] = flags.budget_exceeded_at
        self._table.upsert_entity(entity, mode=UpdateMode.REPLACE)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
