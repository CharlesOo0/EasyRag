"""The guardian: a single always-on Container App that fronts the target VM,
wakes it on demand, sleeps it when idle, and refuses to wake it past the
configured hour/budget caps.

Deployment constraint that the code here relies on and does not itself
enforce: exactly one replica (min=max=1), and uvicorn run with a single
worker. The in-process lock and cached power state below are only a valid
"single source of truth" under that constraint - see docs/azure-deployment-
plan.md. Table Storage writes are additionally guarded (create-if-absent,
merge-all-open-sessions-on-close) as defense in depth, not as a substitute
for it.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from dataclasses import replace

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse

from app import pages
from app.config import Settings, load_settings
from app.guard_logic import can_wake, is_idle, utcnow
from app.proxy import UpstreamUnreachable, forward
from app.state import Flags, StateStore, TableStateStore
from app.vm_control import VmControl, VmControlError, VmPowerState

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("guardian")

_RUNNING_LIKE = (VmPowerState.RUNNING,)
_TRANSITIONAL = (VmPowerState.STARTING, VmPowerState.DEALLOCATING)


class GuardianRuntime:
    def __init__(self, settings: Settings, state: StateStore, vm: VmControl) -> None:
        self.settings = settings
        self.state = state
        self.vm = vm
        self.lock = asyncio.Lock()
        self.cached_power_state = VmPowerState.UNKNOWN

    def _safe_power_state(self) -> VmPowerState:
        try:
            return self.vm.get_power_state()
        except VmControlError:
            logger.exception("failed to read VM power state")
            return VmPowerState.UNKNOWN

    async def handle_request(self, request: Request):
        now = utcnow()
        is_api = request.url.path.startswith("/api/")

        # Every request counts as activity, including ones we're about to
        # answer with a waiting page - a burst of visits while booting must
        # not make the VM look idle the moment it comes up.
        self.state.set_flags(replace(self.state.get_flags(), last_request_at=now))

        if self.cached_power_state in _RUNNING_LIKE:
            try:
                return await forward(
                    request, self.settings.vm_origin, self.settings.proxy_timeout_seconds
                )
            except UpstreamUnreachable:
                logger.warning("cached state said running but upstream unreachable")
                self.cached_power_state = VmPowerState.UNKNOWN

        async with self.lock:
            real_state = self._safe_power_state()
            self.cached_power_state = real_state

            # DEALLOCATING is treated the same as STARTING (just wait) rather
            # than racing to cancel an in-flight shutdown - a request arriving
            # right as the idle-timeout shutdown fires waits for it to finish
            # and starts fresh on its next attempt. Slightly slower than it
            # could be in that rare race, never incorrect.
            if real_state not in _RUNNING_LIKE and real_state not in _TRANSITIONAL:
                flags = self.state.get_flags()
                evicted = flags.expected_running
                if evicted:
                    self.state.close_open_session(now)
                    flags = replace(flags, expected_running=False, last_eviction_at=now)
                    self.state.set_flags(flags)

                sessions = self.state.list_sessions()
                decision = can_wake(
                    sessions,
                    budget_exceeded_at=flags.budget_exceeded_at,
                    max_monthly_hours=self.settings.max_monthly_hours,
                    now=now,
                )
                if not decision.allowed:
                    logger.info("wake refused: %s", decision.reason)
                    return (
                        pages.refused_json(decision.reason)
                        if is_api
                        else pages.refused(decision.reason)
                    )

                try:
                    self.vm.start()
                except VmControlError:
                    logger.exception("failed to start VM")
                else:
                    self.state.open_session(now)
                    self.state.set_flags(replace(flags, expected_running=True))
                    self.cached_power_state = VmPowerState.STARTING

        if self.cached_power_state not in _RUNNING_LIKE:
            flags = self.state.get_flags()
            recently_evicted = pages.evicted_recently(
                flags.last_eviction_at, now, self.settings.poll_interval_seconds * 3
            )
            return (
                pages.waking_up_json(evicted_recently=recently_evicted)
                if is_api
                else pages.waking_up(evicted_recently=recently_evicted)
            )

        try:
            return await forward(
                request, self.settings.vm_origin, self.settings.proxy_timeout_seconds
            )
        except UpstreamUnreachable:
            self.cached_power_state = VmPowerState.UNKNOWN
            return (
                pages.waking_up_json(evicted_recently=False)
                if is_api
                else pages.waking_up(evicted_recently=False)
            )

    async def tick(self) -> None:
        """Idle shutdown + eviction detection, independent of traffic - a
        forgotten-but-running VM must still get shut down with nobody
        visiting."""
        now = utcnow()
        async with self.lock:
            real_state = self._safe_power_state()
            self.cached_power_state = real_state
            flags = self.state.get_flags()

            if flags.expected_running and real_state not in _RUNNING_LIKE and real_state not in _TRANSITIONAL:
                logger.warning("VM found down while expected running - treating as eviction")
                self.state.close_open_session(now)
                self.state.set_flags(
                    replace(flags, expected_running=False, last_eviction_at=now)
                )
                return

            if real_state in _RUNNING_LIKE and is_idle(
                flags.last_request_at, now, self.settings.idle_shutdown_minutes
            ):
                logger.info("idle timeout reached, shutting down")
                self.state.set_flags(replace(flags, expected_running=False))
                try:
                    self.vm.deallocate()
                except VmControlError:
                    logger.exception("failed to deallocate idle VM")
                    self.state.set_flags(replace(flags, expected_running=True))
                    return
                self.state.close_open_session(now)

    async def run_forever(self) -> None:
        while True:
            try:
                await self.tick()
            except Exception:  # noqa: BLE001 - the loop must never die
                logger.exception("tick failed")
            await asyncio.sleep(self.settings.poll_interval_seconds)


def build_runtime() -> GuardianRuntime:
    settings = load_settings()
    state = TableStateStore(settings.storage_account_name, settings.table_name)
    vm = VmControl(settings.vm_resource_id)
    return GuardianRuntime(settings, state, vm)


@asynccontextmanager
async def lifespan(app: FastAPI):
    runtime = build_runtime()
    app.state.runtime = runtime
    task = asyncio.create_task(runtime.run_forever())
    try:
        yield
    finally:
        task.cancel()


# docs/redoc/openapi disabled: this is a transparent reverse proxy, and
# FastAPI's auto-generated routes for them would otherwise register before
# the catch-all and shadow those same paths on the proxied app.
app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/internal/healthz")
async def healthz():
    return PlainTextResponse("ok")


@app.post("/internal/budget-alert")
async def budget_alert(request: Request):
    runtime: GuardianRuntime = app.state.runtime
    token = request.query_params.get("token", "")
    if runtime.settings.budget_webhook_token and token != runtime.settings.budget_webhook_token:
        return JSONResponse({"detail": "invalid token"}, status_code=403)
    now = utcnow()
    runtime.state.set_flags(replace(runtime.state.get_flags(), budget_exceeded_at=now))
    logger.warning("budget_exceeded flag set via webhook")
    return JSONResponse({"status": "ok"})


@app.get("/internal/status")
async def status():
    runtime: GuardianRuntime = app.state.runtime
    flags = runtime.state.get_flags()
    return JSONResponse(
        {
            "power_state": runtime.cached_power_state.value,
            "expected_running": flags.expected_running,
            "budget_exceeded_at": flags.budget_exceeded_at.isoformat()
            if flags.budget_exceeded_at
            else None,
            "last_eviction_at": flags.last_eviction_at.isoformat()
            if flags.last_eviction_at
            else None,
        }
    )


@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def catch_all(full_path: str, request: Request):
    runtime: GuardianRuntime = app.state.runtime
    return await runtime.handle_request(request)
