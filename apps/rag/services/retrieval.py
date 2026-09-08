"""Vector search over embedded chunks (pgvector cosine distance).

`search("some question")` embeds the query and returns the nearest chunks,
ranked, capped at `RAG_TOP_K`, and filtered to those at least
`RAG_SIMILARITY_THRESHOLD` similar. PostgreSQL + pgvector only.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings
from pgvector.django import CosineDistance

from apps.rag.models import Chunk
from apps.rag.services.embeddings import embed_query


@dataclass(frozen=True)
class RetrievedChunk:
    chunk: Chunk
    distance: float      # cosine distance, 0 (identical) .. 2 (opposite)
    similarity: float    # 1 - distance, 1 (identical) .. -1 (opposite)

    @property
    def document(self):
        return self.chunk.document


def search(query: str, *, k: int | None = None, threshold: float | None = None) -> list[RetrievedChunk]:
    """Embed `query` and return the most similar chunks."""
    return search_by_vector(embed_query(query), k=k, threshold=threshold)


def search_by_vector(
    vector,
    *,
    k: int | None = None,
    threshold: float | None = None,
) -> list[RetrievedChunk]:
    k = settings.RAG_TOP_K if k is None else k
    threshold = settings.RAG_SIMILARITY_THRESHOLD if threshold is None else threshold

    rows = (
        Chunk.objects
        .annotate(distance=CosineDistance("embedding", vector))
        .order_by("distance")
        .select_related("document")[:k]
    )

    results: list[RetrievedChunk] = []
    for chunk in rows:
        distance = float(chunk.distance)
        similarity = 1.0 - distance
        if similarity < threshold:
            break  # rows are distance-ordered, so the rest are worse
        results.append(RetrievedChunk(chunk=chunk, distance=distance, similarity=similarity))
    return results
