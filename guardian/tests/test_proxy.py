"""Real end-to-end check with two actual uvicorn servers over real sockets -
same reasoning as the streaming check in this session's history: header/
timing behavior through an ASGI TestClient isn't always representative of
what a real network hop does, so this doesn't use TestClient at all."""

from __future__ import annotations

import asyncio
import threading
import time

import httpx
import uvicorn
from fastapi import FastAPI, Request

from app.proxy import forward

UPSTREAM_PORT = 8766
PROXY_PORT = 8767


def _make_upstream_app() -> FastAPI:
    app = FastAPI()

    @app.get("/whoami")
    async def whoami(request: Request):
        return {"host_header": request.headers.get("host")}

    return app


def _make_proxy_app(origin: str) -> FastAPI:
    app = FastAPI()

    @app.api_route("/{full_path:path}", methods=["GET"])
    async def catch_all(full_path: str, request: Request):
        return await forward(request, origin, 30)

    return app


def _run(app: FastAPI, port: int) -> None:
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


def test_forward_preserves_the_original_host_header():
    """Regression test: proxy.py used to list 'host' as a hop-by-hop header
    and strip it, so a request for 'easyrag.dev' arrived at the upstream
    with Host set to the proxy's own address instead - Django's
    ALLOWED_HOSTS then rejected every real request through the guardian
    with a generic 400. Caught only by testing against the real domain."""
    t1 = threading.Thread(target=_run, args=(_make_upstream_app(), UPSTREAM_PORT), daemon=True)
    t2 = threading.Thread(
        target=_run, args=(_make_proxy_app(f"http://127.0.0.1:{UPSTREAM_PORT}"), PROXY_PORT), daemon=True
    )
    t1.start()
    t2.start()
    time.sleep(1.5)

    async def main():
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"http://127.0.0.1:{PROXY_PORT}/whoami",
                headers={"Host": "easyrag.dev"},
            )
            return resp.json()

    body = asyncio.run(main())
    assert body["host_header"] == "easyrag.dev"
