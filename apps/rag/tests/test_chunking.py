from django.test import SimpleTestCase, override_settings

from apps.rag.services.chunking import chunk_document, estimate_tokens


class EstimateTokensTests(SimpleTestCase):
    def test_empty(self):
        self.assertEqual(estimate_tokens(""), 0)
        self.assertEqual(estimate_tokens("   \n  "), 0)

    def test_monotonic(self):
        self.assertLess(estimate_tokens("a short bit"), estimate_tokens("a much longer bit of text here"))


@override_settings(RAG_CHUNK_TOKENS=40, RAG_CHUNK_OVERLAP=8)
class ChunkDocumentTests(SimpleTestCase):
    def test_heading_path_from_h2(self):
        body = "## Geography\nParis is the capital.\n\n## Economy\nThe economy is large."
        segments = chunk_document(body, title="France")
        self.assertEqual([s.heading_path for s in segments], ["France > Geography", "France > Economy"])

    def test_nested_heading_path(self):
        body = "## Government\nOverview.\n\n### Legislative branch\nBicameral parliament."
        paths = {s.heading_path for s in chunk_document(body, title="France")}
        self.assertIn("France > Government", paths)
        self.assertIn("France > Government > Legislative branch", paths)

    def test_h1_is_not_part_of_the_path(self):
        body = "# France\n\n## Geography\nWestern Europe."
        segments = chunk_document(body, title="France")
        self.assertEqual(segments[0].heading_path, "France > Geography")

    def test_document_without_headings(self):
        body = "Just some prose with no headings at all. Another sentence here."
        segments = chunk_document(body, title="Notes")
        self.assertTrue(segments)
        self.assertTrue(all(s.heading_path == "Notes" for s in segments))

    def test_positions_are_sequential_from_zero(self):
        body = "## A\n" + " ".join(f"Sentence number {i}." for i in range(40))
        segments = chunk_document(body, title="Doc")
        self.assertGreater(len(segments), 1)
        self.assertEqual([s.position for s in segments], list(range(len(segments))))

    def test_no_segment_exceeds_the_window(self):
        body = "## A\n" + " ".join(f"Fact {i} about the subject matter." for i in range(60))
        for segment in chunk_document(body, title="Doc"):
            self.assertLessEqual(segment.token_count, 40, segment.content)

    def test_long_section_is_split_with_overlap(self):
        sentences = [f"Sentence {i} carries some unique token {i}." for i in range(30)]
        body = "## A\n" + " ".join(sentences)
        segments = chunk_document(body, title="Doc")
        self.assertGreater(len(segments), 1)
        # consecutive chunks in the same section share trailing/leading text
        first_tail = segments[0].content.split()[-3:]
        self.assertTrue(any(w in segments[1].content for w in first_tail))

    def test_never_merges_across_a_heading(self):
        body = "## A\nAlpha content.\n\n## B\nBravo content."
        for segment in chunk_document(body, title="Doc"):
            self.assertFalse("Alpha" in segment.content and "Bravo" in segment.content)

    def test_oversized_single_sentence_is_hard_split(self):
        body = "## A\n" + "word " * 200  # one 200-word "sentence", no punctuation
        segments = chunk_document(body, title="Doc")
        self.assertGreater(len(segments), 1)
        for segment in segments:
            self.assertLessEqual(segment.token_count, 40)

    def test_frontmatter_is_ignored(self):
        body = "---\ntitle: France\ntags: [x]\n---\n\n## Geography\nWestern Europe."
        segments = chunk_document(body, title="France")
        self.assertEqual(len(segments), 1)
        self.assertNotIn("title:", segments[0].content)
        self.assertEqual(segments[0].heading_path, "France > Geography")

    def test_deterministic(self):
        body = "## A\n" + " ".join(f"Item {i} here." for i in range(50))
        a = chunk_document(body, title="Doc")
        b = chunk_document(body, title="Doc")
        self.assertEqual(a, b)

    def test_empty_body(self):
        self.assertEqual(chunk_document("", title="Doc"), [])
        self.assertEqual(chunk_document("   \n\n  ", title="Doc"), [])


class ChunkRealCorpusFileTest(SimpleTestCase):
    def test_a_factbook_file_chunks_cleanly(self):
        from pathlib import Path

        from django.conf import settings

        path = Path(settings.BASE_DIR) / "corpus" / "france.md"
        if not path.exists():
            self.skipTest("corpus not present")
        segments = chunk_document(path.read_text(encoding="utf-8"), title="France")
        self.assertGreater(len(segments), 20)
        self.assertTrue(all(s.heading_path.startswith("France > ") for s in segments))
        self.assertTrue(all(s.content for s in segments))
        for segment in segments:
            self.assertLessEqual(segment.token_count, settings.RAG_CHUNK_TOKENS)
