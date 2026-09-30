"""Known vulnerability-scanner path signatures - mass, opportunistic bots that
hit every public IP looking for leaked secrets or known CMS backdoors, not a
targeted attack. Confirmed via Log Analytics (2026-09-29): 1036 of 1776
non-healthcheck requests matched these patterns, some arriving while the VM
was asleep and needlessly waking it. Matched requests are rejected before the
wake decision - never counted as a real visit, never worth a real VM boot."""

from __future__ import annotations

_SIGNATURES = (
    ".env",
    "/.git",
    ".php",
    "wp-content",
    "wp-admin",
    "wp-login",
    "actuator",
    "phpinfo",
    "/.aws",
    "/.ssh",
    "cgi-bin",
    "eval-stdin",
)


def is_known_scan_path(path: str) -> bool:
    lowered = path.lower()
    return any(signature in lowered for signature in _SIGNATURES)
