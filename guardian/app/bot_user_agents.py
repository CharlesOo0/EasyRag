"""Reject obviously scripted/non-browser clients before considering a wake -
a scanner hitting a real route (the allowlist in wake_paths.py only helps
against unreal ones) still shouldn't wake the VM. Cheap and easily bypassed
by a motivated attacker (spoofing a browser User-Agent takes one line), but
stops the common case: most vulnerability scanners and bulk crawlers use
their tool's default User-Agent verbatim, or send none at all - they don't
bother disguising."""

from __future__ import annotations

_BLOCKED_SIGNATURES = (
    "curl/",
    "wget/",
    "python-requests/",
    "python-urllib",
    "go-http-client",
    "libwww-perl",
    "okhttp",
    "scrapy",
    "masscan",
    "nmap",
    "postmanruntime",
)


def is_blocked_user_agent(user_agent: str | None) -> bool:
    if not user_agent:
        return True
    lowered = user_agent.lower()
    return any(signature in lowered for signature in _BLOCKED_SIGNATURES)
