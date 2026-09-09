import json
from unittest import mock

from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.rag.models import Chunk, Document
from apps.rag.services.llm import OllamaError
from apps.rag.services.retrieval import RetrievedChunk


def fake_hit(title, heading, content, sim=0.8, url="https://example.org/x"):
    doc = Document(title=title, source_path="p.md", content_hash="h", metadata={"source_url": url})
    chunk = Chunk(document=doc, heading_path=heading, content=content, position=0)
    return RetrievedChunk(chunk=chunk, distance=1 - sim, similarity=sim)


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
        statuses = [self.run_chat()[0].status_code for _ in range(21)]
        self.assertEqual(statuses.count(200), 20)
        self.assertEqual(statuses[-1], 429)
