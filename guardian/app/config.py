"""Environment-driven settings for the guardian. No secrets here - VM control
uses the Container App's managed identity (azure-identity DefaultAzureCredential),
not a stored key.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"missing required env var: {name}")
    return value


@dataclass(frozen=True)
class Settings:
    # Target VM, addressed by full ARM resource ID so vm_control needs no
    # extra lookup: /subscriptions/.../resourceGroups/.../providers/Microsoft.Compute/virtualMachines/...
    vm_resource_id: str

    # Where the VM's own reverse proxy (Caddy) listens once it's up.
    vm_origin: str

    # Table Storage backing the guardian's own state (session log, flags).
    # Connection via a storage account name + managed identity, not a key.
    storage_account_name: str
    table_name: str

    # Decision thresholds. No hardcoded default for the hour cap on purpose -
    # this number is a product decision (see docs/azure-deployment-plan.md),
    # not a technical one, and picking a silent default here would bury that
    # decision in code instead of making someone consciously set it.
    max_monthly_hours: float
    idle_shutdown_minutes: float = 12.0

    # How often the background loop re-evaluates idle shutdown / eviction.
    poll_interval_seconds: float = 30.0

    # Upstream request timeout once proxying to a running VM.
    proxy_timeout_seconds: float = 300.0

    # Shared secret the budget Action Group's webhook must present
    # (?token=...) - not real auth, just enough to stop randoms flipping the
    # budget_exceeded flag over the open internet.
    budget_webhook_token: str = ""


def load_settings() -> Settings:
    return Settings(
        vm_resource_id=_require("GUARDIAN_VM_RESOURCE_ID"),
        vm_origin=_require("GUARDIAN_VM_ORIGIN"),
        storage_account_name=_require("GUARDIAN_STORAGE_ACCOUNT"),
        table_name=os.getenv("GUARDIAN_TABLE_NAME", "guardianstate"),
        max_monthly_hours=float(_require("GUARDIAN_MAX_MONTHLY_HOURS")),
        idle_shutdown_minutes=float(os.getenv("GUARDIAN_IDLE_SHUTDOWN_MINUTES", 12.0)),
        poll_interval_seconds=float(os.getenv("GUARDIAN_POLL_INTERVAL_SECONDS", 30.0)),
        proxy_timeout_seconds=float(os.getenv("GUARDIAN_PROXY_TIMEOUT_SECONDS", 300.0)),
        budget_webhook_token=os.getenv("GUARDIAN_BUDGET_WEBHOOK_TOKEN", ""),
    )
