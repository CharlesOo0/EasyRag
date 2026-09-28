"""Reverse-proxies an already-running VM. Only called once the caller has
decided the VM is (believed) up - this module has no opinion on wake/idle
logic."""

from __future__ import annotations

import httpx
from fastapi import Request
from fastapi.responses import StreamingResponse

# RFC 7230 hop-by-hop headers - Host is deliberately NOT here. It's an
# end-to-end header, and stripping it was a real bug: httpx would then set
# it from the VM's own address (e.g. "20.19.121.97:8080") instead of the
# public domain the visitor actually used, so Django's ALLOWED_HOSTS check
# rejected every request through the guardian with a generic 400. Missed
# by every earlier manual test against the VM directly, because those all
# passed an explicit `-H 'Host: easyrag.dev'` to simulate the real domain -
# which happened to paper over the guardian stripping that exact header
# instead of forwarding it.
_HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
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
