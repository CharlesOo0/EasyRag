from django.test import SimpleTestCase

from apps.rag.models import Chunk
from apps.rag.services.prompt import SYSTEM_PROMPT, build_messages, format_context
from apps.rag.services.retrieval import RetrievedChunk


def hit(heading_path: str, content: str, similarity: float = 0.8) -> RetrievedChunk:
    return RetrievedChunk(
        chunk=Chunk(heading_path=heading_path, content=content),
        distance=1.0 - similarity,
        similarity=similarity,
    )


CHUNKS = [
    hit("France > Government", "Capital: Paris."),
    hit("France > Geography", "Location: Western Europe."),
]


class FormatContextTests(SimpleTestCase):
    def test_numbered_blocks_with_heading_and_content(self):
        text = format_context(CHUNKS)
        self.assertIn("[1] France > Government\nCapital: Paris.", text)
        self.assertIn("[2] France > Geography\nLocation: Western Europe.", text)

    def test_empty_chunks_note(self):
        self.assertEqual(format_context([]), "(no relevant passages were found)")

    def test_context_is_capped_at_the_budget(self):
        big = [hit(f"Doc {i} > Section", "word " * 400) for i in range(6)]
        text = format_context(big, budget_chars=1200)
        # roughly the budget of passage text, not 6 * 2000 chars
        self.assertLess(len(text), 2000)
        self.assertIn("[1]", text)
        self.assertNotIn("[6]", text)

    def test_last_passage_is_truncated_to_fit(self):
        text = format_context([hit("A > B", "word " * 200)], budget_chars=300)
        self.assertTrue(text.endswith("…"))
        self.assertIn("[1] A > B", text)
        self.assertLess(len(text), 400)


class BuildMessagesTests(SimpleTestCase):
    def test_shape(self):
        messages = build_messages("What is the capital of France?", CHUNKS)
        self.assertEqual([m["role"] for m in messages], ["system", "user"])
        self.assertEqual(messages[0]["content"], SYSTEM_PROMPT)
        self.assertIn("What is the capital of France?", messages[1]["content"])
        self.assertIn("[1] France > Government", messages[1]["content"])

    def test_system_prompt_demands_grounding_and_citations(self):
        lowered = SYSTEM_PROMPT.lower()
        self.assertIn("only", lowered)
        self.assertIn("cite", lowered)
        self.assertIn("do not guess", lowered)

    def test_history_is_threaded_between_system_and_user(self):
        history = [
            {"role": "user", "content": "earlier question"},
            {"role": "assistant", "content": "earlier answer"},
        ]
        messages = build_messages("follow up", CHUNKS, history=history)
        self.assertEqual([m["role"] for m in messages], ["system", "user", "assistant", "user"])
        self.assertEqual(messages[1:3], history)

    def test_question_is_stripped(self):
        messages = build_messages("  padded question  ", CHUNKS)
        self.assertTrue(messages[-1]["content"].endswith("Question: padded question"))

    def test_no_chunks_still_builds_a_valid_prompt(self):
        messages = build_messages("anything", [])
        self.assertEqual([m["role"] for m in messages], ["system", "user"])
        self.assertIn("(no relevant passages were found)", messages[1]["content"])

    def test_snapshot(self):
        messages = build_messages("What is the capital of France?", CHUNKS)
        self.assertEqual(messages, [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Context passages:\n\n"
                    "[1] France > Government\nCapital: Paris.\n\n"
                    "[2] France > Geography\nLocation: Western Europe.\n\n"
                    "---\n"
                    "Question: What is the capital of France?"
                ),
            },
        ])
