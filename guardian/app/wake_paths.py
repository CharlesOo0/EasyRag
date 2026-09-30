"""Which request paths are allowed to wake the VM - an allowlist, not a
blocklist. A blocklist of known scanner signatures (tried first, see git
history) only stops traffic that's already been observed; anything hitting
an unrecognized path - `/`, a bot's own guess, a crawler with no bad intent -
still woke the VM for nothing. Every real route the app serves is small and
known ahead of time, so allowlisting them is both simpler and closes that
gap: only a request that could plausibly be answered by the real app is
worth a VM boot.

Keep in sync with `front/app/routes.ts` (frontend pages) and
`apps/rag/urls.py` (API) - a new real route added there needs to be added
here too, or it'll never wake the VM to serve it."""

from __future__ import annotations

_ALLOWED_EXACT = frozenset(
    {
        "/",
        "/favicon.svg",
        "/favicon.ico",
        "/__manifest",
    }
)

# Segment-boundary prefixes: "/admin" must not also allow "/administrator"
# (a real scanner path, see #89) - only an exact match or a match followed
# by "/" or "." (React Router's own "<route>.data" client-fetch suffix).
_ALLOWED_PREFIXES = (
    "/chat",
    "/corpus",
    "/admin",
)

# Plain prefixes: these already end in "/", so a following segment is
# structurally required - no boundary ambiguity to guard against.
_ALLOWED_PATH_PREFIXES = (
    "/api/rag/",
    "/static/",
    "/assets/",
)


def is_allowed_wake_path(path: str) -> bool:
    if path in _ALLOWED_EXACT:
        return True
    if path.startswith(_ALLOWED_PATH_PREFIXES):
        return True
    return any(
        path == prefix or path.startswith(prefix + "/") or path.startswith(prefix + ".")
        for prefix in _ALLOWED_PREFIXES
    )
