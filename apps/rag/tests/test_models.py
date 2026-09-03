from django.db import IntegrityError
from django.test import TestCase

from apps.rag.models import Chunk, Document


class DocumentModelTests(TestCase):
    def test_str_prefers_title_then_path(self):
        doc = Document(source_path="a/b.md", title="Getting started")
        self.assertEqual(str(doc), "Getting started")
        self.assertEqual(str(Document(source_path="a/b.md", title="")), "a/b.md")

    def test_source_path_is_unique(self):
        Document.objects.create(source_path="x.md", title="X", content_hash="h")
        with self.assertRaises(IntegrityError):
            Document.objects.create(source_path="x.md", title="X2", content_hash="h2")

    def test_metadata_defaults_to_empty_dict(self):
        doc = Document.objects.create(source_path="x.md", title="X", content_hash="h")
        doc.refresh_from_db()
        self.assertEqual(doc.metadata, {})


class ChunkModelTests(TestCase):
    def setUp(self):
        self.doc = Document.objects.create(source_path="x.md", title="X", content_hash="h")

    def test_position_unique_per_document(self):
        Chunk.objects.create(document=self.doc, position=0, content="a")
        with self.assertRaises(IntegrityError):
            Chunk.objects.create(document=self.doc, position=0, content="b")

    def test_same_position_allowed_across_documents(self):
        other = Document.objects.create(source_path="y.md", title="Y", content_hash="h")
        Chunk.objects.create(document=self.doc, position=0, content="a")
        Chunk.objects.create(document=other, position=0, content="b")
        self.assertEqual(Chunk.objects.filter(position=0).count(), 2)

    def test_embedding_is_optional(self):
        chunk = Chunk.objects.create(document=self.doc, position=0, content="a")
        chunk.refresh_from_db()
        self.assertIsNone(chunk.embedding)

    def test_chunks_related_name_and_cascade(self):
        Chunk.objects.create(document=self.doc, position=0, content="a")
        Chunk.objects.create(document=self.doc, position=1, content="b")
        self.assertEqual(self.doc.chunks.count(), 2)
        self.doc.delete()
        self.assertEqual(Chunk.objects.count(), 0)
