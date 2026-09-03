import hashlib
import tempfile
from pathlib import Path

from django.test import SimpleTestCase

from apps.rag.services.corpus import iter_corpus, parse_document

WITH_FM = b"""---
title: France
source_url: https://example.org/fr
tags: [country, europe]
---

## Geography

Western Europe.
"""


class ParseDocumentTests(SimpleTestCase):
    def test_frontmatter_extracted(self):
        doc = parse_document(WITH_FM, source_path="france.md")
        self.assertEqual(doc.title, "France")
        self.assertEqual(doc.metadata, {"source_url": "https://example.org/fr", "tags": ["country", "europe"]})
        self.assertNotIn("title", doc.metadata)
        self.assertTrue(doc.body.lstrip().startswith("## Geography"))

    def test_content_hash_is_stable_across_line_endings(self):
        lf = parse_document(WITH_FM, source_path="france.md")
        crlf = parse_document(WITH_FM.replace(b"\n", b"\r\n"), source_path="france.md")
        self.assertEqual(lf.content_hash, crlf.content_hash)
        self.assertEqual(lf.content_hash, hashlib.sha256(WITH_FM).hexdigest())

    def test_title_falls_back_to_first_heading(self):
        doc = parse_document(b"# Chad\n\nSome text.", source_path="x/chad.md")
        self.assertEqual(doc.title, "Chad")
        self.assertEqual(doc.metadata, {})

    def test_title_falls_back_to_filename(self):
        doc = parse_document(b"no heading here", source_path="deep/notes.md")
        self.assertEqual(doc.title, "notes")

    def test_non_mapping_frontmatter_raises(self):
        with self.assertRaises(ValueError):
            parse_document(b"---\n- a\n- b\n---\nbody", source_path="bad.md")


class IterCorpusTests(SimpleTestCase):
    def test_walks_sorted_skips_readme(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "b.md").write_text("# B\n", encoding="utf-8")
            (root / "a.md").write_text("# A\n", encoding="utf-8")
            (root / "README.md").write_text("# ignore me\n", encoding="utf-8")
            (root / "sub").mkdir()
            (root / "sub" / "c.md").write_text("# C\n", encoding="utf-8")

            docs = list(iter_corpus(root))

        self.assertEqual([d.source_path for d in docs], ["a.md", "b.md", "sub/c.md"])
