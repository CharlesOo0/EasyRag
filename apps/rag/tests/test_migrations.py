import importlib
from types import SimpleNamespace

from django.test import TestCase

# The migration module name starts with a digit -> import by string.
m0002 = importlib.import_module("apps.rag.migrations.0002_chunk_embedding_hnsw_index")


def _schema_editor(vendor):
    executed = []
    editor = SimpleNamespace(
        connection=SimpleNamespace(vendor=vendor),
        execute=executed.append,
    )
    return editor, executed


class HnswIndexMigrationTests(TestCase):
    def test_create_index_is_noop_off_postgresql(self):
        editor, executed = _schema_editor("sqlite")
        m0002.create_index(None, editor)
        self.assertEqual(executed, [])

    def test_create_index_runs_on_postgresql(self):
        editor, executed = _schema_editor("postgresql")
        m0002.create_index(None, editor)
        self.assertEqual(len(executed), 1)
        sql = executed[0]
        self.assertIn("USING hnsw", sql)
        self.assertIn("vector_cosine_ops", sql)
        self.assertIn(m0002.INDEX_NAME, sql)

    def test_drop_index_is_noop_off_postgresql(self):
        editor, executed = _schema_editor("sqlite")
        m0002.drop_index(None, editor)
        self.assertEqual(executed, [])

    def test_drop_index_runs_on_postgresql(self):
        editor, executed = _schema_editor("postgresql")
        m0002.drop_index(None, editor)
        self.assertEqual(executed, [f"DROP INDEX IF EXISTS {m0002.INDEX_NAME}"])
