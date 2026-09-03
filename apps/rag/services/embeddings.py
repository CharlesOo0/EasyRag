"""Local text embeddings via sentence-transformers.

The model is loaded lazily and once (`_get_model` is cached), so importing this
module is cheap and the test suite can patch `_get_model` without ever pulling
model weights. `sentence_transformers` itself is imported inside `_get_model`
for the same reason - it is not a test dependency.

All vectors are L2-normalised, so a dot product is the cosine similarity and
pgvector's cosine distance behaves as expected downstream.
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
    dim = model.get_sentence_embedding_dimension()
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


def embed_texts(
    texts: list[str],
    *,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> list[list[float]]:
    """Embed a list of texts. Returns one normalised vector per input."""
    texts = list(texts)
    if not texts:
        return []
    vectors = _get_model().encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return [vector.tolist() for vector in vectors]


def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    return embed_texts([text])[0]
