import asyncio
from datetime import timedelta

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse
from fastapi.testclient import TestClient

from app.config import Settings
from app.guard_logic import Session, utcnow
from app.main import GuardianRuntime
from app.state import Flags, InMemoryStateStore
from app.vm_control import VmPowerState
from tests.fakes import FakeVmControl


def make_settings(**overrides) -> Settings:
    base = dict(
        vm_resource_id="/subscriptions/s/resourceGroups/r/providers/Microsoft.Compute/virtualMachines/v",
        vm_origin="http://vm.internal:8080",
        storage_account_name="acct",
        table_name="guardianstate",
        max_monthly_hours=10.0,
        idle_shutdown_minutes=12.0,
        poll_interval_seconds=30.0,
        proxy_timeout_seconds=60.0,
        budget_webhook_token="",
    )
    base.update(overrides)
    return Settings(**base)


def make_client(runtime: GuardianRuntime) -> TestClient:
    test_app = FastAPI()

    @test_app.api_route("/{full_path:path}", methods=["GET", "POST"])
    async def catch_all(full_path: str, request: Request):
        return await runtime.handle_request(request)

    return TestClient(test_app)


def make_runtime(*, vm_state=VmPowerState.DEALLOCATED, **settings_overrides) -> tuple[GuardianRuntime, FakeVmControl, InMemoryStateStore]:
    settings = make_settings(**settings_overrides)
    state = InMemoryStateStore()
    vm = FakeVmControl(state=vm_state)
    runtime = GuardianRuntime(settings, state, vm)
    return runtime, vm, state


# --- wake path ----------------------------------------------------------


def test_first_request_starts_the_vm_and_serves_waiting_html():
    runtime, vm, state = make_runtime()
    client = make_client(runtime)

    resp = client.get("/chat")

    assert vm.start_calls == 1
    assert resp.status_code == 503
    assert "Démarrage" in resp.text
    assert len(state.list_sessions()) == 1
    assert state.list_sessions()[0].end is None
    assert state.get_flags().expected_running is True


def test_first_api_request_gets_json_not_html():
    runtime, vm, state = make_runtime()
    client = make_client(runtime)

    resp = client.post("/api/rag/chat/", json={"question": "hi"})

    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "waking_up"
    assert body["reason"] == "cold_start"


def test_concurrent_requests_only_start_the_vm_once():
    runtime, vm, state = make_runtime()

    async def fire():
        test_app = FastAPI()

        @test_app.api_route("/{full_path:path}", methods=["GET"])
        async def catch_all(full_path: str, request: Request):
            return await runtime.handle_request(request)

        from httpx import ASGITransport, AsyncClient

        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as client:
            return await asyncio.gather(client.get("/a"), client.get("/b"), client.get("/c"))

    responses = asyncio.run(fire())
    assert all(r.status_code == 503 for r in responses)
    assert vm.start_calls == 1
    assert len(state.list_sessions()) == 1


def test_already_running_vm_is_proxied_without_starting(monkeypatch):
    runtime, vm, state = make_runtime(vm_state=VmPowerState.RUNNING)
    runtime.cached_power_state = VmPowerState.RUNNING

    async def fake_forward(request, origin, timeout):
        return PlainTextResponse("upstream ok")

    monkeypatch.setattr("app.main.forward", fake_forward)
    client = make_client(runtime)

    resp = client.get("/chat")

    assert resp.status_code == 200
    assert resp.text == "upstream ok"
    assert vm.start_calls == 0


# --- refusal --------------------------------------------------------------


def test_wake_refused_past_hour_cap_does_not_start_vm():
    runtime, vm, state = make_runtime(max_monthly_hours=10.0)
    now = utcnow()
    state._sessions.append(Session(start=now - timedelta(hours=11), end=now - timedelta(hours=1)))

    client = make_client(runtime)
    resp = client.get("/chat")

    assert resp.status_code == 503
    assert "quota d'heures" in resp.text
    assert vm.start_calls == 0


def test_wake_refused_json_reason_is_hour_cap_reached():
    runtime, vm, state = make_runtime(max_monthly_hours=10.0)
    now = utcnow()
    state._sessions.append(Session(start=now - timedelta(hours=11), end=now - timedelta(hours=1)))

    client = make_client(runtime)
    resp = client.post("/api/rag/chat/", json={})

    assert resp.status_code == 503
    assert resp.json() == {"status": "refused", "reason": "hour_cap_reached"}


def test_wake_refused_when_budget_flag_set_this_month():
    runtime, vm, state = make_runtime()
    state.set_flags(Flags(budget_exceeded_at=utcnow()))

    client = make_client(runtime)
    resp = client.get("/chat")

    assert resp.status_code == 503
    assert vm.start_calls == 0


def test_stale_budget_flag_from_last_month_does_not_block():
    runtime, vm, state = make_runtime()
    state.set_flags(Flags(budget_exceeded_at=utcnow() - timedelta(days=40)))

    client = make_client(runtime)
    resp = client.get("/chat")

    # Should proceed to the normal wake path, not the refusal path.
    assert vm.start_calls == 1


# --- idle shutdown / eviction (tick) ---------------------------------------


def test_tick_shuts_down_an_idle_running_vm():
    runtime, vm, state = make_runtime(vm_state=VmPowerState.RUNNING, idle_shutdown_minutes=12)
    now = utcnow()
    state.set_flags(Flags(last_request_at=now - timedelta(minutes=20), expected_running=True))
    open_session_start = now - timedelta(hours=1)
    state._sessions.append(Session(start=open_session_start, end=None))

    asyncio.run(runtime.tick())

    assert vm.deallocate_calls == 1
    assert state.get_flags().expected_running is False
    sessions = state.list_sessions()
    assert len(sessions) == 1
    assert sessions[0].end is not None


def test_tick_does_not_shut_down_a_recently_active_vm():
    runtime, vm, state = make_runtime(vm_state=VmPowerState.RUNNING, idle_shutdown_minutes=12)
    now = utcnow()
    state.set_flags(Flags(last_request_at=now - timedelta(minutes=1), expected_running=True))

    asyncio.run(runtime.tick())

    assert vm.deallocate_calls == 0


def test_tick_detects_eviction_and_closes_the_open_session():
    runtime, vm, state = make_runtime(vm_state=VmPowerState.DEALLOCATED)
    now = utcnow()
    state.set_flags(Flags(expected_running=True, last_request_at=now))
    state._sessions.append(Session(start=now - timedelta(minutes=5), end=None))

    asyncio.run(runtime.tick())

    flags = state.get_flags()
    assert flags.expected_running is False
    assert flags.last_eviction_at is not None
    assert vm.deallocate_calls == 0  # we did not stop it - it was already down
    sessions = state.list_sessions()
    assert sessions[0].end is not None


def test_request_after_eviction_reports_evicted_reason():
    runtime, vm, state = make_runtime(vm_state=VmPowerState.DEALLOCATED)
    state.set_flags(Flags(last_eviction_at=utcnow()))

    client = make_client(runtime)
    resp = client.post("/api/rag/chat/", json={})

    assert resp.json()["reason"] == "evicted"


def test_deallocate_failure_keeps_expected_running_true():
    runtime, vm, state = make_runtime(vm_state=VmPowerState.RUNNING, idle_shutdown_minutes=12)
    now = utcnow()
    state.set_flags(Flags(last_request_at=now - timedelta(minutes=20), expected_running=True))
    vm.fail_next = True

    asyncio.run(runtime.tick())

    assert state.get_flags().expected_running is True
