"""Response bodies shown while the VM isn't ready to serve a request.
Two shapes for the same situations: HTML (plain browser navigation, e.g.
loading the SPA) and JSON (calls under /api/, so the frontend's own JS can
render its own message instead of an HTML page landing inside a fetch()).
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi.responses import HTMLResponse, JSONResponse

_POLL_SECONDS = 5


def _html(title: str, body: str, *, auto_refresh: bool) -> HTMLResponse:
    refresh_tag = f'<meta http-equiv="refresh" content="{_POLL_SECONDS}">' if auto_refresh else ""
    return HTMLResponse(
        f"""<!doctype html><html><head><meta charset="utf-8">{refresh_tag}
<title>{title}</title>
<style>body{{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#222}}</style>
</head><body><h1>{title}</h1><p>{body}</p></body></html>""",
        status_code=503,
    )


def waking_up(*, evicted_recently: bool) -> HTMLResponse:
    if evicted_recently:
        return _html(
            "Redémarrage en cours",
            "Le serveur a été temporairement indisponible (forte demande sur "
            "l'infrastructure). Nouvelle tentative de démarrage en cours, "
            "cette page se rafraîchit automatiquement.",
            auto_refresh=True,
        )
    return _html(
        "Démarrage en cours",
        "Le serveur se réveille (~1-3 minutes). Cette page se rafraîchit "
        "automatiquement.",
        auto_refresh=True,
    )


def refused(reason: str) -> HTMLResponse:
    message = {
        "hour_cap_reached": "Le quota d'heures de calcul de ce mois est atteint.",
        "budget_exceeded": "Le budget de ce mois est atteint.",
    }.get(reason, "Le service est temporairement indisponible.")
    return _html("Indisponible", message, auto_refresh=False)


def waking_up_json(*, evicted_recently: bool) -> JSONResponse:
    body = {
        "status": "waking_up",
        "reason": "evicted" if evicted_recently else "cold_start",
        "retry_after": _POLL_SECONDS,
    }
    return JSONResponse(body, status_code=503, headers={"Retry-After": str(_POLL_SECONDS)})


def refused_json(reason: str) -> JSONResponse:
    return JSONResponse({"status": "refused", "reason": reason}, status_code=503)


def evicted_recently(last_eviction_at: datetime | None, now: datetime, within_seconds: float) -> bool:
    if last_eviction_at is None:
        return False
    return (now - last_eviction_at).total_seconds() <= within_seconds
