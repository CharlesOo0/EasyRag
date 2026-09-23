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
import threading

from django.conf import settings
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.permissions import AllowAny
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.rag.models import Document
from apps.rag.serializers import (
    ChatRequestSerializer,
    DocumentDetailSerializer,
    DocumentListSerializer,
)
from apps.rag.services import llm, prompt, retrieval

logger = logging.getLogger(__name__)

SNIPPET_CHARS = 300

# Bounds how many chats can be generating at once (see RAG_MAX_CONCURRENT_CHATS
# in settings). One process-wide semaphore, since gunicorn here runs a single
# worker with several threads sharing one Ollama instance - the thing this
# protects is per-process, not per-request.
_chat_slots = threading.BoundedSemaphore(settings.RAG_MAX_CONCURRENT_CHATS)


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
        "slug": hit.document.slug,
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

        # Past RAG_MAX_CONCURRENT_CHATS in-flight generations, say so instead
        # of accepting the connection and leaving the client waiting behind
        # requests it can't see.
        if not _chat_slots.acquire(blocking=False):
            return Response(
                {"detail": "The server is busy answering other questions. Try again shortly."},
                status=503,
            )

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
            try:
                hits = retrieval.search(question)
            except Exception:
                logger.exception("rag chat: retrieval failed")
                yield _sse("error", {"detail": "retrieval failed"})
                return

            yield _sse("sources", [_source(h) for h in hits])

            messages = prompt.build_messages(question, hits, history=history)
            options = {"num_predict": settings.RAG_MAX_TOKENS}
            try:
                for token in llm.stream_chat(messages, options=options):
                    yield _sse("token", {"text": token})
            except Exception:
                # Covers OllamaError too: its message can include internal
                # details (the Ollama URL, a raw upstream error body) that
                # shouldn't reach an anonymous client - log it, say nothing
                # specific back.
                logger.exception("rag chat: generation failed")
                yield _sse("error", {"detail": "generation failed"})
                return

            yield _sse("done", {})
        finally:
            # Runs on normal completion, an early `return` above, or the
            # generator being closed early (client disconnect) - the slot is
            # always freed.
            _chat_slots.release()


class DocumentListView(generics.ListAPIView):
    """GET /api/rag/documents/ - the whole ingested corpus (195 rows, unpaginated)."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = "rag_read"
    pagination_class = None
    serializer_class = DocumentListSerializer
    queryset = Document.objects.all()


class DocumentDetailView(generics.RetrieveAPIView):
    """GET /api/rag/documents/<slug>/ - one document with its raw Markdown body."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = "rag_read"
    serializer_class = DocumentDetailSerializer

    def get_object(self):
        return get_object_or_404(Document, source_path=f"{self.kwargs['slug']}.md")
