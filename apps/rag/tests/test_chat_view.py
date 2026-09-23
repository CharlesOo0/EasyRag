import json
from unittest import mock

from django.conf import settings
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.rag.models import Chunk, Document
from apps.rag.services.llm import OllamaError
from apps.rag.services.retrieval import RetrievedChunk
from apps.rag.views import _chat_slots


def fake_hit(title, heading, content, sim=0.8, url="https://example.org/x"):
    doc = Document(title=title, source_path="p.md", content_hash="h", metadata={"source_url": url})
    chunk = Chunk(document=doc, heading_path=heading, content=content, position=0)
    return RetrievedChunk(chunk=chunk, distance=1 - sim, similarity=sim)


def configured_rate(scope: str) -> int:
    """The integer request count for a DRF scoped-throttle rate like '10/min'."""
    return int(settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"][scope].split("/")[0])


def read_events(response):
    body = b"".join(response.streaming_content).decode()
    events = []
    for block in filter(None, body.strip().split("\n\n")):
        name = data = None
        for line in block.splitlines():
            if line.startswith("event: "):
                name = line[len("event: "):]
            elif line.startswith("data: "):
                data = json.loads(line[len("data: "):])
        events.append((name, data))
    return events


class ChatViewTests(APITestCase):
    url = reverse("rag_chat")

    def setUp(self):
        cache.clear()  # reset the scoped-throttle counter between tests
        self.hits = [
            fake_hit("Brazil", "Brazil > People and Society", "Languages: Portuguese (official).", sim=0.74),
            fake_hit("Portugal", "Portugal > People and Society", "Languages: Portuguese.", sim=0.6),
        ]

    def run_chat(self, *, question="hi", history=None, search=None, stream=None):
        """POST to the endpoint and fully consume the SSE stream while the
        service mocks are still active (the response body is lazy)."""
        search = search or (lambda *a, **k: self.hits)
        stream = stream or (lambda *a, **k: iter(["Port", "uguese"]))
        body = {"question": question}
        if history is not None:
            body["history"] = history
        with mock.patch("apps.rag.services.retrieval.search", side_effect=search), \
             mock.patch("apps.rag.services.llm.stream_chat", side_effect=stream):
            response = self.client.post(self.url, body, format="json")
            events = read_events(response) if response.status_code == 200 else None
        return response, events

    def test_streams_sources_then_tokens_then_done(self):
        response, events = self.run_chat(question="What language is spoken in Brazil?")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/event-stream")
        self.assertEqual([name for name, _ in events], ["sources", "token", "token", "done"])

        src = events[0][1][0]
        self.assertEqual(src["slug"], "p")
        self.assertEqual(src["title"], "Brazil")
        self.assertEqual(src["heading_path"], "Brazil > People and Society")
        self.assertEqual(src["similarity"], 0.74)
        self.assertEqual(src["source_url"], "https://example.org/x")
        self.assertEqual([e[1]["text"] for e in events[1:3]], ["Port", "uguese"])

    def test_question_is_required(self):
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("question", response.json())

    def test_blank_question_rejected(self):
        response = self.client.post(self.url, {"question": "   "}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_endpoint_is_public(self):
        response, _ = self.run_chat()
        self.assertEqual(response.status_code, 200)

    def test_history_is_forwarded_to_prompt(self):
        history = [{"role": "user", "content": "earlier"}, {"role": "assistant", "content": "reply"}]
        with mock.patch(
            "apps.rag.services.prompt.build_messages", return_value=[{"role": "user", "content": "x"}]
        ) as build:
            self.run_chat(question="follow up", history=history)
        self.assertEqual(build.call_args.kwargs["history"], history)

    def test_ollama_error_becomes_an_error_event(self):
        def boom(*a, **k):
            yield "partial "
            raise OllamaError("cannot reach Ollama at http://ollama:11434")

        _, events = self.run_chat(stream=boom)
        self.assertEqual([n for n, _ in events], ["sources", "token", "error"])
        self.assertIn("cannot reach Ollama", events[-1][1]["detail"])

    def test_retrieval_failure_becomes_an_error_event(self):
        def kaboom(*a, **k):
            raise RuntimeError("db down")

        with self.assertLogs("apps.rag.views", level="ERROR"):
            _, events = self.run_chat(search=kaboom)
        self.assertEqual(events, [("error", {"detail": "retrieval failed"})])

    def test_no_retrieved_passages_still_streams(self):
        _, events = self.run_chat(question="something obscure", search=lambda *a, **k: [])
        self.assertEqual(events[0], ("sources", []))
        self.assertEqual(events[-1][0], "done")

    def test_throttled_after_the_scope_rate(self):
        limit = configured_rate("rag_chat")
        statuses = [self.run_chat()[0].status_code for _ in range(limit + 1)]
        self.assertEqual(statuses.count(200), limit)
        self.assertEqual(statuses[-1], 429)

    def test_generation_is_capped_by_num_predict(self):
        captured = {}

        def stream(messages, **kwargs):
            captured.update(kwargs)
            return iter(["hi"])

        self.run_chat(stream=stream)
        self.assertEqual(captured["options"], {"num_predict": settings.RAG_MAX_TOKENS})

    def test_returns_503_at_the_concurrency_limit(self):
        # Drain every slot to simulate the server already at capacity, rather
        # than spinning up RAG_MAX_CONCURRENT_CHATS real concurrent requests.
        held = 0
        while _chat_slots.acquire(blocking=False):
            held += 1
        try:
            response, events = self.run_chat()
            self.assertEqual(response.status_code, 503)
            self.assertIsNone(events)
        finally:
            for _ in range(held):
                _chat_slots.release()

    def test_the_concurrency_slot_is_freed_after_a_request(self):
        """A finished request must not leak its slot - otherwise the server
        would permanently lose capacity after RAG_MAX_CONCURRENT_CHATS uses."""
        for _ in range(settings.RAG_MAX_CONCURRENT_CHATS + 2):
            response, _ = self.run_chat()
            self.assertEqual(response.status_code, 200)
