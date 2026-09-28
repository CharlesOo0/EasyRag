from __future__ import annotations

from app.vm_control import VmControlError, VmPowerState


class FakeVmControl:
    """Duck-types VmControl. `start()`/`deallocate()` just flip `state`
    unless `fail_next` is set, to test the "Azure API call itself failed"
    paths without a real error injection framework."""

    def __init__(self, state: VmPowerState = VmPowerState.DEALLOCATED) -> None:
        self.state = state
        self.start_calls = 0
        self.deallocate_calls = 0
        self.fail_next = False

    def get_power_state(self) -> VmPowerState:
        return self.state

    def start(self) -> None:
        self.start_calls += 1
        if self.fail_next:
            self.fail_next = False
            raise VmControlError("boom")
        self.state = VmPowerState.STARTING

    def deallocate(self) -> None:
        self.deallocate_calls += 1
        if self.fail_next:
            self.fail_next = False
            raise VmControlError("boom")
        self.state = VmPowerState.DEALLOCATED
