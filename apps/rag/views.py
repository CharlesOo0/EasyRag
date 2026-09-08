"""POST /api/rag/chat - public, throttled, streams the answer as SSE.

Event stream (each `event:`/`data:` pair is one Server-Sent Event):

    event: sources        JSON list of the retrieved passages (sent first)
    event: token          {"text": "..."}  - one per streamed model token
    event: done           {}
    event: error          {"detail": "..."} - terminal; no `done` follows

`sources` is emitted before the tokens because retrieval finishes first and the
UI can render the citations while the answer streams.
"""

from __future__ import annotations

import json
import logging

from django.http import StreamingHttpResponse
from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.permissions import AllowAny
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.rag.serializers import ChatRequestSerializer
from apps.rag.services import llm, prompt, retrieval
from apps.rag.services.llm import OllamaError

logger = logging.getLogger(__name__)

SNIPPET_CHARS = 300


class IgnoreClientContentNegotiation(BaseContentNegotiation):
    """The response is either a hand-built SSE stream or a JSON error - the
    client's Accept header (often `text/event-stream`) must not 406 us."""

    def select_parser(self, request, parsers):
        return parsers[0]

    def select_renderer(self, request, renderers, format_suffix=None):
        return renderers[0], renderers[0].media_type


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _source(hit) -> dict:
    return {
        "title": hit.document.title,
        "heading_path": hit.chunk.heading_path,
        "snippet": hit.chunk.content[:SNIPPET_CHARS],
        "similarity": round(hit.similarity, 3),
        "source_url": hit.document.metadata.get("source_url") or "",
    }


class ChatView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]
    renderer_classes = [JSONRenderer]
    content_negotiation_class = IgnoreClientContentNegotiation
    throttle_scope = "rag_chat"

    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        response = StreamingHttpResponse(
            self._events(
                serializer.validated_data["question"],
                serializer.validated_data["history"],
            ),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"  # don't let a proxy buffer the stream
        return response

    @staticmethod
    def _events(question: str, history: list[dict]):
        try:
            hits = retrieval.search(question)
        except Exception:
            logger.exception("rag chat: retrieval failed")
            yield _sse("error", {"detail": "retrieval failed"})
            return

        yield _sse("sources", [_source(h) for h in hits])

        messages = prompt.build_messages(question, hits, history=history)
        try:
            for token in llm.stream_chat(messages):
                yield _sse("token", {"text": token})
        except OllamaError as exc:
            yield _sse("error", {"detail": str(exc)})
            return
        except Exception:
            logger.exception("rag chat: generation failed")
            yield _sse("error", {"detail": "generation failed"})
            return

        yield _sse("done", {})
