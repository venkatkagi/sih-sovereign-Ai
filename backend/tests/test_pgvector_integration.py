import unittest
from unittest.mock import MagicMock, patch

from backend.vectorstore.pgvector_store import PgVectorStore
from backend.vectorstore.store import VectorStore


class MockCursor:
    def __init__(self):
        self.queries = []
        self.fetched = []

    def execute(self, query, params=None):
        self.queries.append((query, params))

    def fetchall(self):
        return self.fetched

    def fetchone(self):
        return [len(self.fetched)]

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


class MockConnection:
    def __init__(self, cursor: MockCursor):
        self.cursor_obj = cursor

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


class PgVectorStoreTests(unittest.TestCase):

    @patch("backend.vectorstore.pgvector_store.register_vector")
    @patch("backend.vectorstore.pgvector_store.psycopg2.connect")
    def test_pgvector_store_initialization(self, mock_connect, mock_register):
        mock_cur = MockCursor()
        mock_conn = MockConnection(mock_cur)
        mock_connect.return_value = mock_conn

        store = PgVectorStore(connection_string="postgresql://mock:5432/test", table_name="test_chunks")

        # Verify extension and table creation were executed
        queries_str = " ".join(q[0] for q in mock_cur.queries)
        self.assertIn("CREATE EXTENSION IF NOT EXISTS vector", queries_str)
        self.assertIn("CREATE TABLE IF NOT EXISTS test_chunks", queries_str)
        self.assertIn("vector(384)", queries_str)
        self.assertIn("CREATE INDEX IF NOT EXISTS test_chunks_embedding_hnsw_idx", queries_str)

    @patch("backend.vectorstore.pgvector_store.register_vector")
    @patch("backend.vectorstore.pgvector_store.psycopg2.connect")
    def test_pgvector_search_and_source_isolation(self, mock_connect, mock_register):
        mock_cur = MockCursor()
        mock_cur.fetched = [
            ("Pump manual chunk 1", {"source": "pump_manual.pdf", "page": 1, "chunk_id": 0}, 0.12),
            ("Pump manual chunk 2", {"source": "pump_manual.pdf", "page": 2, "chunk_id": 1}, 0.25),
        ]
        mock_conn = MockConnection(mock_cur)
        mock_connect.return_value = mock_conn

        store = PgVectorStore(connection_string="postgresql://mock:5432/test", table_name="test_chunks")

        dummy_emb = [0.1] * 384
        res = store.search(embedding=dummy_emb, n_results=2, source="pump_manual.pdf")

        self.assertEqual(len(res["documents"][0]), 2)
        self.assertEqual(len(res["metadatas"][0]), 2)
        self.assertEqual(len(res["distances"][0]), 2)
        self.assertEqual(res["metadatas"][0][0]["source"], "pump_manual.pdf")

    @patch("backend.vectorstore.pgvector_store.register_vector")
    @patch("backend.vectorstore.pgvector_store.psycopg2.connect")
    def test_pgvector_get_by_metadata(self, mock_connect, mock_register):
        mock_cur = MockCursor()
        mock_cur.fetched = [
            ("Centrifugal pump leak found", {"equipment_tag": "PU-000001", "source": "insp.pdf"}),
        ]
        mock_conn = MockConnection(mock_cur)
        mock_connect.return_value = mock_conn

        store = PgVectorStore(connection_string="postgresql://mock:5432/test", table_name="test_chunks")
        results = store.get_by_metadata("equipment_tag", ["PU-000001"])

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["metadata"]["equipment_tag"], "PU-000001")

    @patch("backend.vectorstore.pgvector_store.register_vector")
    @patch("backend.vectorstore.pgvector_store.psycopg2.connect")
    def test_production_vector_store_selects_postgresql(self, mock_connect, mock_register):
        mock_cur = MockCursor()
        mock_conn = MockConnection(mock_cur)
        mock_connect.return_value = mock_conn

        # Default initialization in production mode
        with patch.dict("os.environ", {"VECTOR_STORE_BACKEND": "postgres"}):
            store = VectorStore()
            self.assertEqual(store.backend_type, "postgresql")
            self.assertTrue(store.is_pgvector)
            self.assertIsInstance(store._impl, PgVectorStore)

    @patch("backend.vectorstore.pgvector_store.psycopg2.connect", side_effect=Exception("Database refused connection"))
    def test_production_postgresql_failure_raises_and_never_falls_back_to_chroma(self, mock_connect):
        # When PostgreSQL fails in production mode, it MUST raise an exception and NOT fall back to Chroma
        with self.assertRaises(RuntimeError) as ctx:
            VectorStore(backend="postgres")
        
        self.assertIn("PostgreSQL + pgvector connection failed", str(ctx.exception))
        self.assertIn("Production must not fall back to Chroma", str(ctx.exception))

    def test_explicit_chroma_override_for_tests(self):
        store = VectorStore(path="data/test_isolation_chroma", collection_name="test_explicit_chroma")
        self.assertEqual(store.backend_type, "chroma")
        self.assertFalse(store.is_pgvector)


if __name__ == "__main__":
    unittest.main()
