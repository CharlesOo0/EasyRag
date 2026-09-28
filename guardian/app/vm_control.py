"""Thin wrapper around the Azure Compute management API for the one VM the
guardian controls. Auth is via the Container App's managed identity
(DefaultAzureCredential) - no stored key. Start/deallocate are fire-and-forget
(the long-running operation is only *accepted*, not waited out) - callers
poll `get_power_state()` themselves instead of blocking a request on a
multi-minute Azure operation.
"""

from __future__ import annotations

import re
from enum import Enum

from azure.identity import DefaultAzureCredential
from azure.mgmt.compute import ComputeManagementClient

_RESOURCE_ID_RE = re.compile(
    r"^/subscriptions/(?P<sub>[^/]+)/resourceGroups/(?P<rg>[^/]+)"
    r"/providers/Microsoft\.Compute/virtualMachines/(?P<name>[^/]+)$",
    re.IGNORECASE,
)


class VmPowerState(str, Enum):
    RUNNING = "running"
    DEALLOCATED = "deallocated"
    STOPPED = "stopped"  # stopped but still allocated/billed - not a state we want to linger in
    STARTING = "starting"
    DEALLOCATING = "deallocating"
    UNKNOWN = "unknown"


_POWER_STATE_MAP = {
    "running": VmPowerState.RUNNING,
    "deallocated": VmPowerState.DEALLOCATED,
    "stopped": VmPowerState.STOPPED,
    "starting": VmPowerState.STARTING,
    "deallocating": VmPowerState.DEALLOCATING,
}


class VmControlError(RuntimeError):
    """Raised when the Azure API call itself fails. Callers must treat this
    as "state unknown", never assume running or stopped from a failure."""


def _parse_resource_id(resource_id: str) -> tuple[str, str, str]:
    match = _RESOURCE_ID_RE.match(resource_id)
    if not match:
        raise ValueError(f"not a virtual machine resource ID: {resource_id!r}")
    return match["sub"], match["rg"], match["name"]


class VmControl:
    def __init__(self, resource_id: str) -> None:
        subscription_id, resource_group, vm_name = _parse_resource_id(resource_id)
        self._resource_group = resource_group
        self._vm_name = vm_name
        credential = DefaultAzureCredential()
        self._client = ComputeManagementClient(credential, subscription_id)

    def get_power_state(self) -> VmPowerState:
        try:
            instance_view = self._client.virtual_machines.instance_view(
                self._resource_group, self._vm_name
            )
        except Exception as exc:  # noqa: BLE001 - deliberately broad, re-raised as our own type
            raise VmControlError(f"failed to read VM instance view: {exc}") from exc
        for status in instance_view.statuses or []:
            code = status.code or ""
            if code.startswith("PowerState/"):
                return _POWER_STATE_MAP.get(code.split("/", 1)[1], VmPowerState.UNKNOWN)
        return VmPowerState.UNKNOWN

    def start(self) -> None:
        try:
            self._client.virtual_machines.begin_start(self._resource_group, self._vm_name)
        except Exception as exc:  # noqa: BLE001
            raise VmControlError(f"failed to start VM: {exc}") from exc

    def deallocate(self) -> None:
        try:
            self._client.virtual_machines.begin_deallocate(self._resource_group, self._vm_name)
        except Exception as exc:  # noqa: BLE001
            raise VmControlError(f"failed to deallocate VM: {exc}") from exc
