"""Reverse-proxies an already-running VM. Only called once the caller has
decided the VM is (believed) up - this module has no opinion on wake/idle
logic."""

from __future__ import annotations

import httpx
from fastapi import Request
from fastapi.responses import StreamingResponse

_HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
}


class UpstreamUnreachable(RuntimeError):
    """The VM is believed running but didn't actually answer - treat this as
    a signal the cached power state may be stale, not as a normal HTTP error."""


async def forward(request: Request, origin: str, timeout_seconds: float) -> StreamingResponse:
    url = origin.rstrip("/") + request.url.path
    if request.url.query:
        url += "?" + request.url.query

    headers = {k: v for k, v in request.headers.items() if k.lower() not in _HOP_BY_HOP_HEADERS}
    body = await request.body()

    client = httpx.AsyncClient(timeout=timeout_seconds)
    try:
        upstream_request = client.build_request(
            request.method, url, headers=headers, content=body
        )
        upstream_response = await client.send(upstream_request, stream=True)
    except httpx.HTTPError as exc:
        await client.aclose()
        raise UpstreamUnreachable(str(exc)) from exc

    async def stream_and_close():
        try:
            async for chunk in upstream_response.aiter_raw():
                yield chunk
        finally:
            await upstream_response.aclose()
            await client.aclose()

    response_headers = {
        k: v
        for k, v in upstream_response.headers.items()
        if k.lower() not in _HOP_BY_HOP_HEADERS
    }
    return StreamingResponse(
        stream_and_close(),
        status_code=upstream_response.status_code,
        headers=response_headers,
    )
