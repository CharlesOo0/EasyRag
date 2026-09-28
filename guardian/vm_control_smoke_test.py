"""Manual, one-off smoke test of VmControl against a REAL VM - not part of
the pytest suite. Run once before trusting it, then delete the test VM.

    python vm_control_smoke_test.py <vm-resource-id>
"""

from __future__ import annotations

import sys
import time

from app.vm_control import VmControl, VmPowerState


def check(label: str, condition: bool) -> None:
    status = "OK" if condition else "FAIL"
    print(f"[{status}] {label}")
    if not condition:
        raise SystemExit(1)


def wait_for(vm: VmControl, target: VmPowerState, timeout_s: int) -> None:
    deadline = time.monotonic() + timeout_s
    last = None
    while time.monotonic() < deadline:
        last = vm.get_power_state()
        print(f"  ... power state: {last.value}")
        if last == target:
            return
        time.sleep(10)
    raise SystemExit(f"timed out waiting for {target.value}, last seen: {last}")


def main() -> None:
    resource_id = sys.argv[1]
    vm = VmControl(resource_id)

    state = vm.get_power_state()
    print(f"initial state: {state.value}")
    check("initial state is a real, recognized value", state != VmPowerState.UNKNOWN)

    print("deallocating...")
    vm.deallocate()
    wait_for(vm, VmPowerState.DEALLOCATED, timeout_s=180)
    check("VM reached DEALLOCATED after deallocate()", True)

    print("starting...")
    vm.start()
    wait_for(vm, VmPowerState.RUNNING, timeout_s=180)
    check("VM reached RUNNING after start()", True)

    print("\nAll VmControl smoke checks passed against a real VM.")


if __name__ == "__main__":
    main()
