import unittest

from app.vectorstore.store import VectorStore


class SourceIsolationTests(unittest.TestCase):

    def test_get_by_source_returns_only_requested_document(self):
        store = VectorStore(
            path="data/test_isolation_chroma",
            collection_name="isolation_test",
        )

        store.collection.delete(
            where={"source": "document-a.pdf"}
        )
        store.collection.delete(
            where={"source": "document-b.pdf"}
        )

        store.collection.upsert(
            ids=[
                "a:0",
                "b:0",
            ],
            documents=[
                "Document A: seal leakage detected.",
                "Document B: bearing temperature was normal.",
            ],
            embeddings=[
                [1.0] + [0.0] * 383,
                [0.0, 1.0] + [0.0] * 382,
            ],
            metadatas=[
                {
                    "source": "document-a.pdf",
                    "document_id": "A-000001",
                },
                {
                    "source": "document-b.pdf",
                    "document_id": "B-000001",
                },
            ],
        )

        results = store.get_by_source("document-a.pdf")

        self.assertEqual(len(results), 1)
        self.assertEqual(
            results[0]["metadata"]["document_id"],
            "A-000001",
        )
        self.assertIn(
            "seal leakage",
            results[0]["text"],
        )


if __name__ == "__main__":
    unittest.main()
