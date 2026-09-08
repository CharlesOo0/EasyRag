"""Local text embeddings via sentence-transformers.

The model is loaded lazily and once (`_get_model` is cached), so importing this
module is cheap and the test suite can patch `_get_model` without ever pulling
model weights. `sentence_transformers` itself is imported inside `_get_model`
for the same reason - it is not a test dependency.

Passages and queries are embedded through different entry points because e5-style
models expect them prefixed differently (`passage: ` vs `query: `). All vectors
are L2-normalised, so pgvector's cosine distance behaves as expected downstream.
"""

from __future__ import annotations

from functools import lru_cache

from django.conf import settings

from apps.rag.models import EMBEDDING_DIMENSIONS

# Default batch size for encoding many chunks during ingestion.
DEFAULT_BATCH_SIZE = 32


@lru_cache(maxsize=1)
def _get_model():
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(settings.RAG_EMBEDDING_MODEL)
    dim = model.get_embedding_dimension()
    if dim != EMBEDDING_DIMENSIONS:
        raise RuntimeError(
            f"RAG_EMBEDDING_MODEL '{settings.RAG_EMBEDDING_MODEL}' produces "
            f"{dim}-dim vectors, but rag.Chunk.embedding expects "
            f"{EMBEDDING_DIMENSIONS}. Pick a {EMBEDDING_DIMENSIONS}-dim model "
            f"or change EMBEDDING_DIMENSIONS and migrate."
        )
    return model


def reset_model_cache() -> None:
    """Drop the cached model (used by tests, and after a settings change)."""
    _get_model.cache_clear()


def _apply_prefix(prefix: str, text: str) -> str:
    prefix = prefix or ""
    sep = "" if not prefix or prefix.endswith(" ") else " "
    return f"{prefix}{sep}{text}"


def _encode(texts: list[str], prefix: str, batch_size: int) -> list[list[float]]:
    if not texts:
        return []
    prefixed = [_apply_prefix(prefix, text) for text in texts]
    vectors = _get_model().encode(
        prefixed,
        batch_size=batch_size,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return [vector.tolist() for vector in vectors]


def embed_texts(
    texts: list[str],
    *,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> list[list[float]]:
    """Embed corpus passages (used by ingestion). One normalised vector per input."""
    return _encode(list(texts), settings.RAG_EMBEDDING_PASSAGE_PREFIX, batch_size)


def embed_query(text: str) -> list[float]:
    """Embed a single search query."""
    return _encode([text], settings.RAG_EMBEDDING_QUERY_PREFIX, DEFAULT_BATCH_SIZE)[0]
