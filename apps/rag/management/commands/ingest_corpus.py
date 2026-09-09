"""Load a corpus-format directory into Document / Chunk rows plus embeddings.

Generic: swapping corpora is `ingest_corpus --reset` after replacing the files.
Idempotent - a document is re-ingested only when its file content changes.
"""

from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.rag.models import Chunk, Document
from apps.rag.services.chunking import chunk_document
from apps.rag.services.corpus import CorpusDocument, iter_corpus
from apps.rag.services.embeddings import embed_texts


class Command(BaseCommand):
    help = "Ingest a corpus-format directory into Document/Chunk rows + embeddings."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path", default=None,
            help="Corpus directory (default: <BASE_DIR>/corpus).",
        )
        parser.add_argument(
            "--reset", action="store_true",
            help="Delete all rag data before ingesting.",
        )
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Report what would change without touching the database.",
        )

    def handle(self, *, path, reset, dry_run, **options):
        root = Path(path) if path else Path(settings.BASE_DIR) / "corpus"
        if not root.is_dir():
            raise CommandError(f"Corpus directory not found: {root}")

        documents = list(iter_corpus(root))
        if not documents:
            raise CommandError(f"No .md documents found under {root}")

        if reset and not dry_run:
            removed, _ = Document.objects.all().delete()
            self.stdout.write(f"reset: removed {removed} rows")

        existing = {
            d.source_path: (d.content_hash, bool(d.body))
            for d in Document.objects.all()
        }
        seen: set[str] = set()
        created = updated = skipped = 0

        for doc in documents:
            seen.add(doc.source_path)
            prev = existing.get(doc.source_path)
            unchanged = (
                not reset
                and prev is not None
                and prev == (doc.content_hash, True)  # same content, body already stored
            )
            if unchanged:
                skipped += 1
                continue

            verb = "update" if doc.source_path in existing else "create"
            if verb == "create":
                created += 1
            else:
                updated += 1

            if dry_run:
                self.stdout.write(f"  would {verb}  {doc.source_path}")
            else:
                n_chunks = self._ingest(doc)
                self.stdout.write(f"  {verb}d  {doc.source_path}  ({n_chunks} chunks)")

        stale = sorted(sp for sp in existing if sp not in seen)
        if stale and not dry_run:
            Document.objects.filter(source_path__in=stale).delete()

        if dry_run:
            self.stdout.write(self.style.WARNING(
                f"dry run: {created} to create, {updated} to update, "
                f"{skipped} unchanged, {len(stale)} to remove"
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"done: {created} created, {updated} updated, {skipped} unchanged, "
                f"{len(stale)} removed "
                f"({Document.objects.count()} documents, {Chunk.objects.count()} chunks)"
            ))

    def _ingest(self, doc: CorpusDocument) -> int:
        segments = chunk_document(doc.body, title=doc.title)
        vectors = embed_texts([s.embed_text for s in segments]) if segments else []
        if len(vectors) != len(segments):
            raise CommandError(
                f"{doc.source_path}: embedded {len(vectors)} of {len(segments)} chunks"
            )

        with transaction.atomic():
            row, _ = Document.objects.update_or_create(
                source_path=doc.source_path,
                defaults={
                    "title": doc.title,
                    "body": doc.body,
                    "content_hash": doc.content_hash,
                    "metadata": doc.metadata,
                },
            )
            row.chunks.all().delete()
            Chunk.objects.bulk_create([
                Chunk(
                    document=row,
                    position=seg.position,
                    heading_path=seg.heading_path,
                    content=seg.content,
                    token_count=seg.token_count,
                    embedding=vector,
                )
                for seg, vector in zip(segments, vectors)
            ])
        return len(segments)
