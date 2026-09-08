import math
from unittest import mock, skipUnless

from django.db import connection
from django.test import TestCase, override_settings

from apps.rag.models import EMBEDDING_DIMENSIONS, Chunk, Document
from apps.rag.services import retrieval


def basis(index: int) -> list[float]:
    v = [0.0] * EMBEDDING_DIMENSIONS
    v[index] = 1.0
    return v


def blend(a: float, b: float) -> list[float]:
    """Unit vector in the basis(0)/basis(1) plane; cosine sim to basis(0) == a/hypot(a, b)."""
    norm = math.hypot(a, b)
    v = [0.0] * EMBEDDING_DIMENSIONS
    v[0], v[1] = a / norm, b / norm
    return v


@skipUnless(connection.vendor == "postgresql", "pgvector cosine search needs PostgreSQL")
class SearchByVectorTests(TestCase):
    def setUp(self):
        doc = Document.objects.create(source_path="d.md", title="Doc", content_hash="h")
        self.identical = Chunk.objects.create(document=doc, position=0, content="identical", embedding=basis(0))
        self.close = Chunk.objects.create(document=doc, position=1, content="close", embedding=blend(0.6, 0.8))
        self.orthogonal = Chunk.objects.create(document=doc, position=2, content="orthogonal", embedding=basis(1))

    def test_ranks_by_cosine_distance(self):
        hits = retrieval.search_by_vector(basis(0), k=5, threshold=-1.0)
        self.assertEqual(
            [h.chunk.id for h in hits],
            [self.identical.id, self.close.id, self.orthogonal.id],
        )

    def test_reports_distance_and_similarity(self):
        hits = retrieval.search_by_vector(basis(0), k=5, threshold=-1.0)
        self.assertAlmostEqual(hits[0].similarity, 1.0, places=4)
        self.assertAlmostEqual(hits[0].distance, 0.0, places=4)
        self.assertAlmostEqual(hits[1].similarity, 0.6, places=4)

    def test_respects_k(self):
        self.assertEqual(len(retrieval.search_by_vector(basis(0), k=2, threshold=-1.0)), 2)

    def test_filters_below_threshold(self):
        hits = retrieval.search_by_vector(basis(0), k=5, threshold=0.7)
        self.assertEqual([h.chunk.id for h in hits], [self.identical.id])

    def test_empty_when_nothing_passes_threshold(self):
        self.assertEqual(retrieval.search_by_vector(basis(0), k=5, threshold=1.1), [])

    def test_document_is_reachable_without_extra_query(self):
        hits = retrieval.search_by_vector(basis(0), k=1, threshold=-1.0)
        with self.assertNumQueries(0):
            self.assertEqual(hits[0].document.title, "Doc")

    @override_settings(RAG_TOP_K=1, RAG_SIMILARITY_THRESHOLD=-1.0)
    def test_defaults_come_from_settings(self):
        self.assertEqual(len(retrieval.search_by_vector(basis(0))), 1)

    def test_search_embeds_the_query_then_delegates(self):
        with mock.patch.object(retrieval, "embed_query", return_value=basis(0)) as embed:
            hits = retrieval.search("where is it", k=5, threshold=-1.0)
        embed.assert_called_once_with("where is it")
        self.assertEqual(hits[0].chunk.id, self.identical.id)

    def test_no_chunks_returns_empty(self):
        Chunk.objects.all().delete()
        self.assertEqual(retrieval.search_by_vector(basis(0)), [])
