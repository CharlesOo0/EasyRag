import tempfile
from io import StringIO
from pathlib import Path
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.rag.models import EMBEDDING_DIMENSIONS, Chunk, Document

FRANCE = """---
title: France
source_url: https://example.org/fr
tags: [country, europe]
---

## Geography

Western Europe, bordering the Bay of Biscay.

## Government

Capital: Paris. Government type: semi-presidential republic.
"""

CHAD = """---
title: Chad
---

## Geography

North-Central Africa, landlocked.
"""


def fake_embed_texts(texts, **kwargs):
    return [[0.1] * EMBEDDING_DIMENSIONS for _ in texts]


@mock.patch(
    "apps.rag.management.commands.ingest_corpus.embed_texts",
    side_effect=fake_embed_texts,
)
class IngestCorpusTests(TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.write("france.md", FRANCE)
        self.write("chad.md", CHAD)
        (self.root / "README.md").write_text("not ingested", encoding="utf-8")

    def write(self, name, text):
        (self.root / name).write_text(text, encoding="utf-8")

    def run_ingest(self, *args):
        out = StringIO()
        call_command("ingest_corpus", "--path", str(self.root), *args, stdout=out)
        return out.getvalue()

    def test_creates_documents_and_chunks(self, _embed):
        self.run_ingest()
        self.assertEqual(Document.objects.count(), 2)
        self.assertGreater(Chunk.objects.count(), 0)
        france = Document.objects.get(source_path="france.md")
        self.assertEqual(france.title, "France")
        self.assertEqual(france.metadata, {"source_url": "https://example.org/fr", "tags": ["country", "europe"]})
        self.assertTrue(france.chunks.exists())

    def test_document_body_is_stored(self, _embed):
        self.run_ingest()
        france = Document.objects.get(source_path="france.md")
        self.assertIn("## Geography", france.body)
        self.assertIn("semi-presidential republic", france.body)
        self.assertNotIn("title: France", france.body)  # frontmatter stripped

    def test_missing_body_is_backfilled_without_touching_content_hash(self, embed):
        self.run_ingest()
        Document.objects.filter(source_path="france.md").update(body="")
        embed.reset_mock()

        output = self.run_ingest()

        self.assertTrue(Document.objects.get(source_path="france.md").body)
        self.assertIn("updated  france.md", output)
        self.assertIn("1 unchanged", output)  # chad still skipped
        embed.assert_called_once()

    def test_chunks_are_embedded(self, _embed):
        self.run_ingest()
        chunk = Chunk.objects.first()
        self.assertIsNotNone(chunk.embedding)
        self.assertEqual(len(list(chunk.embedding)), EMBEDDING_DIMENSIONS)

    def test_second_run_is_a_no_op(self, embed):
        self.run_ingest()
        ids = set(Chunk.objects.values_list("id", flat=True))
        embed.reset_mock()

        output = self.run_ingest()

        self.assertEqual(set(Chunk.objects.values_list("id", flat=True)), ids)
        embed.assert_not_called()
        self.assertIn("2 unchanged", output)

    def test_editing_one_file_reingests_only_that_document(self, _embed):
        self.run_ingest()
        chad_ids = set(Document.objects.get(source_path="chad.md").chunks.values_list("id", flat=True))
        france_ids = set(Document.objects.get(source_path="france.md").chunks.values_list("id", flat=True))

        self.write("france.md", FRANCE + "\n## Economy\n\nLarge and diversified.\n")
        output = self.run_ingest()

        self.assertEqual(
            set(Document.objects.get(source_path="chad.md").chunks.values_list("id", flat=True)),
            chad_ids,
        )
        self.assertNotEqual(
            set(Document.objects.get(source_path="france.md").chunks.values_list("id", flat=True)),
            france_ids,
        )
        self.assertIn("updated  france.md", output)
        self.assertIn("1 unchanged", output)

    def test_reset_wipes_and_rebuilds(self, _embed):
        self.run_ingest()
        Document.objects.filter(source_path="chad.md").update(content_hash="stale")

        self.run_ingest("--reset")

        self.assertEqual(Document.objects.count(), 2)
        self.assertNotEqual(Document.objects.get(source_path="chad.md").content_hash, "stale")

    def test_removed_file_is_pruned(self, _embed):
        self.run_ingest()
        (self.root / "chad.md").unlink()

        output = self.run_ingest()

        self.assertEqual(Document.objects.count(), 1)
        self.assertFalse(Document.objects.filter(source_path="chad.md").exists())
        self.assertIn("1 removed", output)

    def test_dry_run_changes_nothing(self, embed):
        output = self.run_ingest("--dry-run")
        self.assertEqual(Document.objects.count(), 0)
        self.assertEqual(Chunk.objects.count(), 0)
        embed.assert_not_called()
        self.assertIn("2 to create", output)

    def test_missing_directory_raises(self, _embed):
        with self.assertRaises(CommandError):
            call_command("ingest_corpus", "--path", str(self.root / "nope"))

    def test_empty_directory_raises(self, _embed):
        with tempfile.TemporaryDirectory() as empty:
            with self.assertRaises(CommandError):
                call_command("ingest_corpus", "--path", empty)
