import sys
from contextlib import contextmanager
from types import ModuleType
from unittest import mock

from django.test import TestCase, override_settings

from apps.rag.models import EMBEDDING_DIMENSIONS
from apps.rag.services import embeddings


class FakeModel:
    """Stand-in for a SentenceTransformer: records calls, returns fixed vectors."""

    def __init__(self, dim=EMBEDDING_DIMENSIONS):
        self._dim = dim
        self.encode_calls = []

    def get_embedding_dimension(self):
        return self._dim

    def encode(self, texts, **kwargs):
        import numpy as np

        self.encode_calls.append((list(texts), kwargs))
        return np.ones((len(texts), self._dim), dtype="float32")


@contextmanager
def fake_sentence_transformers(constructor):
    """Inject a stub `sentence_transformers` module so the lazy import in
    `_get_model` resolves without the real (heavy) package installed."""
    module = ModuleType("sentence_transformers")
    module.SentenceTransformer = constructor
    with mock.patch.dict(sys.modules, {"sentence_transformers": module}):
        embeddings.reset_model_cache()
        try:
            yield
        finally:
            embeddings.reset_model_cache()


class EmbeddingServiceTests(TestCase):
    def setUp(self):
        embeddings.reset_model_cache()
        self.addCleanup(embeddings.reset_model_cache)

    def test_embed_texts_returns_one_vector_per_input(self):
        with mock.patch.object(embeddings, "_get_model", return_value=FakeModel()):
            vectors = embeddings.embed_texts(["a", "b", "c"])
        self.assertEqual(len(vectors), 3)
        self.assertEqual(len(vectors[0]), EMBEDDING_DIMENSIONS)
        self.assertIsInstance(vectors[0][0], float)

    def test_embed_texts_empty_input_short_circuits(self):
        with mock.patch.object(embeddings, "_get_model") as get_model:
            self.assertEqual(embeddings.embed_texts([]), [])
        get_model.assert_not_called()

    def test_embed_query_returns_single_vector(self):
        with mock.patch.object(embeddings, "_get_model", return_value=FakeModel()):
            vector = embeddings.embed_query("question")
        self.assertEqual(len(vector), EMBEDDING_DIMENSIONS)

    def test_encode_asks_for_normalised_vectors(self):
        fake = FakeModel()
        with mock.patch.object(embeddings, "_get_model", return_value=fake):
            embeddings.embed_texts(["a"], batch_size=8)
        _, kwargs = fake.encode_calls[0]
        self.assertTrue(kwargs["normalize_embeddings"])
        self.assertEqual(kwargs["batch_size"], 8)

    @override_settings(
        RAG_EMBEDDING_QUERY_PREFIX="query: ",
        RAG_EMBEDDING_PASSAGE_PREFIX="passage: ",
    )
    def test_query_and_passage_get_their_prefixes(self):
        fake = FakeModel()
        with mock.patch.object(embeddings, "_get_model", return_value=fake):
            embeddings.embed_query("where is it")
            embeddings.embed_texts(["a fact", "another"])
        self.assertEqual(fake.encode_calls[0][0], ["query: where is it"])
        self.assertEqual(fake.encode_calls[1][0], ["passage: a fact", "passage: another"])

    @override_settings(RAG_EMBEDDING_QUERY_PREFIX="query:")
    def test_prefix_without_trailing_space_still_separated(self):
        fake = FakeModel()
        with mock.patch.object(embeddings, "_get_model", return_value=fake):
            embeddings.embed_query("hello")
        self.assertEqual(fake.encode_calls[0][0], ["query: hello"])

    @override_settings(RAG_EMBEDDING_QUERY_PREFIX="", RAG_EMBEDDING_PASSAGE_PREFIX="")
    def test_empty_prefix_is_a_noop(self):
        fake = FakeModel()
        with mock.patch.object(embeddings, "_get_model", return_value=fake):
            embeddings.embed_query("hello")
        self.assertEqual(fake.encode_calls[0][0], ["hello"])

    def test_model_is_loaded_once_across_calls(self):
        constructor = mock.Mock(return_value=FakeModel())
        with fake_sentence_transformers(constructor):
            embeddings.embed_texts(["a"])
            embeddings.embed_texts(["b"])
            embeddings.embed_query("c")
        constructor.assert_called_once()

    @override_settings(RAG_EMBEDDING_MODEL="wrong-dims-model")
    def test_dimension_mismatch_raises(self):
        constructor = mock.Mock(return_value=FakeModel(dim=EMBEDDING_DIMENSIONS + 1))
        with fake_sentence_transformers(constructor):
            with self.assertRaises(RuntimeError):
                embeddings.embed_query("x")
