import json
from unittest import mock

import requests
from django.test import SimpleTestCase, override_settings

from apps.rag.services import llm


class FakeResponse:
    def __init__(self, *, status_code=200, lines=None, text=""):
        self.status_code = status_code
        self._lines = lines or []
        self.text = text
        self.closed = False

    def iter_lines(self, decode_unicode=False):
        yield from self._lines

    def close(self):
        self.closed = True


def frames(*tokens, done_after=True):
    lines = [json.dumps({"message": {"content": t}, "done": False}) for t in tokens]
    if done_after:
        lines.append(json.dumps({"message": {"content": ""}, "done": True}))
    return lines


@override_settings(OLLAMA_URL="http://ollama:11434", RAG_LLM_MODEL="llama3.1")
class StreamChatTests(SimpleTestCase):
    def test_yields_tokens_in_order(self):
        resp = FakeResponse(lines=frames("Hello", ", ", "world"))
        with mock.patch.object(llm.requests, "post", return_value=resp) as post:
            self.assertEqual(list(llm.stream_chat([{"role": "user", "content": "hi"}])),
                             ["Hello", ", ", "world"])
        url, = post.call_args.args
        self.assertEqual(url, "http://ollama:11434/api/chat")
        body = post.call_args.kwargs["json"]
        self.assertEqual(body["model"], "llama3.1")
        self.assertTrue(body["stream"])
        self.assertTrue(resp.closed)

    def test_stops_at_done_frame(self):
        lines = [json.dumps({"message": {"content": "one"}, "done": False}),
                 json.dumps({"message": {"content": ""}, "done": True}),
                 json.dumps({"message": {"content": "leaked"}, "done": False})]
        with mock.patch.object(llm.requests, "post", return_value=FakeResponse(lines=lines)):
            self.assertEqual(list(llm.stream_chat([])), ["one"])

    def test_passes_model_and_options_overrides(self):
        resp = FakeResponse(lines=frames("x"))
        with mock.patch.object(llm.requests, "post", return_value=resp) as post:
            list(llm.stream_chat([], model="mistral", options={"temperature": 0}))
        body = post.call_args.kwargs["json"]
        self.assertEqual(body["model"], "mistral")
        self.assertEqual(body["options"], {"temperature": 0})

    def test_connection_failure_raises_ollama_error(self):
        with mock.patch.object(llm.requests, "post", side_effect=requests.ConnectionError("refused")):
            with self.assertRaises(llm.OllamaError) as ctx:
                list(llm.stream_chat([]))
        self.assertIn("cannot reach Ollama", str(ctx.exception))

    def test_non_200_raises_with_body(self):
        resp = FakeResponse(status_code=404, text="model 'llama3.1' not found")
        with mock.patch.object(llm.requests, "post", return_value=resp):
            with self.assertRaises(llm.OllamaError) as ctx:
                list(llm.stream_chat([]))
        self.assertIn("not found", str(ctx.exception))
        self.assertTrue(resp.closed)

    def test_error_frame_in_stream_raises(self):
        lines = [json.dumps({"message": {"content": "partial"}, "done": False}),
                 json.dumps({"error": "model 'llama3.1' not found, try pulling it first"})]
        with mock.patch.object(llm.requests, "post", return_value=FakeResponse(lines=lines)):
            gen = llm.stream_chat([])
            self.assertEqual(next(gen), "partial")
            with self.assertRaises(llm.OllamaError):
                next(gen)

    def test_malformed_json_raises(self):
        with mock.patch.object(llm.requests, "post", return_value=FakeResponse(lines=["{not json"])):
            with self.assertRaises(llm.OllamaError):
                list(llm.stream_chat([]))

    def test_chat_joins_the_stream(self):
        with mock.patch.object(llm.requests, "post", return_value=FakeResponse(lines=frames("a", "b", "c"))):
            self.assertEqual(llm.chat([]), "abc")
