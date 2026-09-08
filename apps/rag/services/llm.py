"""Minimal client for a local Ollama server (the /api/chat endpoint).

`stream_chat(messages)` yields assistant tokens as they arrive. Every failure
mode - Ollama unreachable, non-200, an error frame in the stream (e.g. the
model isn't pulled), malformed JSON - surfaces as `OllamaError`.
"""

from __future__ import annotations

import json
from collections.abc import Iterator

import requests
from django.conf import settings


class OllamaError(RuntimeError):
    pass


def _endpoint() -> str:
    return f"{settings.OLLAMA_URL.rstrip('/')}/api/chat"


def stream_chat(
    messages: list[dict],
    *,
    model: str | None = None,
    options: dict | None = None,
) -> Iterator[str]:
    """Yield assistant content tokens for `messages` from Ollama, in order."""
    payload = {
        "model": model or settings.RAG_LLM_MODEL,
        "messages": messages,
        "stream": True,
    }
    if options:
        payload["options"] = options

    timeout = (settings.OLLAMA_CONNECT_TIMEOUT, settings.OLLAMA_READ_TIMEOUT)
    try:
        response = requests.post(_endpoint(), json=payload, stream=True, timeout=timeout)
    except requests.RequestException as exc:
        raise OllamaError(f"cannot reach Ollama at {settings.OLLAMA_URL}: {exc}") from exc

    try:
        if response.status_code != 200:
            detail = response.text.strip()[:300] or f"HTTP {response.status_code}"
            raise OllamaError(f"Ollama error: {detail}")

        for line in response.iter_lines(decode_unicode=True):
            if not line:
                continue
            try:
                frame = json.loads(line)
            except json.JSONDecodeError as exc:
                raise OllamaError(f"malformed frame from Ollama: {line[:200]}") from exc

            if frame.get("error"):
                raise OllamaError(f"Ollama error: {frame['error']}")

            token = frame.get("message", {}).get("content", "")
            if token:
                yield token
            if frame.get("done"):
                return
    finally:
        response.close()


def chat(messages: list[dict], **kwargs) -> str:
    """Non-streaming convenience: the full assistant reply as one string."""
    return "".join(stream_chat(messages, **kwargs))
