from django.db import models
from pgvector.django import VectorField

# Dimension of the embedding model (intfloat/multilingual-e5-small -> 384).
# Baked into the Chunk.embedding column and its migration; the model name is
# configured via settings (RAG_EMBEDDING_MODEL) and must stay 384-dim.
EMBEDDING_DIMENSIONS = 384


class Document(models.Model):
    """A source file from the fixed corpus, before chunking."""

    source_path = models.CharField(
        max_length=1024,
        unique=True,
        help_text="Path of the source file, relative to the corpus directory.",
    )
    title = models.CharField(max_length=512)
    body = models.TextField(
        blank=True,
        default="",
        help_text="Raw Markdown of the document (frontmatter removed), served by the corpus API.",
    )
    content_hash = models.CharField(
        max_length=64,
        help_text="sha256 of the raw file contents; used to skip re-ingesting unchanged documents.",
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["source_path"]

    def __str__(self):
        return self.title or self.source_path

    @property
    def slug(self) -> str:
        """URL-facing id: the source path without its `.md` suffix."""
        path = self.source_path
        return path[:-3] if path.endswith(".md") else path


class Chunk(models.Model):
    """A contiguous slice of a Document, embedded for vector retrieval."""

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="chunks",
    )
    position = models.PositiveIntegerField(
        help_text="0-based index of this chunk within its document.",
    )
    heading_path = models.CharField(
        max_length=1024,
        blank=True,
        help_text=(
            "Markdown heading trail for the chunk, e.g. 'Setup > Docker'. "
            "Shown as the citation location in answers."
        ),
    )
    content = models.TextField()
    token_count = models.PositiveIntegerField(default=0)
    embedding = VectorField(dimensions=EMBEDDING_DIMENSIONS, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["document", "position"]
        constraints = [
            models.UniqueConstraint(
                fields=["document", "position"],
                name="unique_chunk_position_per_document",
            ),
        ]

    def __str__(self):
        return f"{self.document.title} #{self.position}"
