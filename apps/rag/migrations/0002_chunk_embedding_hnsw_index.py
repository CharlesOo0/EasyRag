"""HNSW index on Chunk.embedding for approximate nearest-neighbour search.

Hand-written rather than a Meta.indexes entry: pgvector's HnswIndex is
PostgreSQL-only and would fail `manage.py check` / `migrate` on the sqlite
backend the test suite uses. Here the index is created only when the backend is
PostgreSQL, and is a no-op everywhere else. Django's migration state is
deliberately left unaware of it - it is managed entirely by this migration.

`vector_cosine_ops` matches the cosine distance used at query time (#15). HNSW
is approximate: it trades a small recall loss for not scanning every row.
`m` / `ef_construction` are pgvector's defaults, spelled out so they are easy to
tune later.
"""

from django.db import migrations

INDEX_NAME = "rag_chunk_embedding_hnsw"

CREATE_INDEX_SQL = f"""
    CREATE INDEX IF NOT EXISTS {INDEX_NAME}
    ON rag_chunk
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
"""

DROP_INDEX_SQL = f"DROP INDEX IF EXISTS {INDEX_NAME}"


def create_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(CREATE_INDEX_SQL)


def drop_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(DROP_INDEX_SQL)


class Migration(migrations.Migration):

    dependencies = [
        ("rag", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_index, drop_index),
    ]
