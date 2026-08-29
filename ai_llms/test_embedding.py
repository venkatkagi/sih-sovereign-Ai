import asyncio
import unittest
from ai_llms.embedding import (
    DEFAULT_EMBEDDING_DIMENSION,
    EmbeddingPipeline,
    MockEmbeddingPipeline,
    cosine_similarity,
)


class TestEmbeddingPipeline(unittest.TestCase):

    def setUp(self):
        self.mock_embedder = MockEmbeddingPipeline(dimension=384)
        self.pipeline = EmbeddingPipeline(fallback_to_mock=True)

    def test_vector_dimension(self):
        self.assertEqual(self.mock_embedder.dimension, 384)
        vec = self.mock_embedder.embed_text("Sample test document")
        self.assertEqual(len(vec), 384)
        self.assertIsInstance(vec[0], float)

    def test_embed_documents_batch(self):
        docs = [
            "Introduction to safety standard 4.1",
            "Inspection protocol for facility maintenance",
            "Emergency procedure and contact list",
        ]
        vecs = self.mock_embedder.embed_documents(docs)
        self.assertEqual(len(vecs), 3)
        for v in vecs:
            self.assertEqual(len(v), 384)

    def test_cosine_similarity(self):
        # Identical vectors -> similarity = 1.0
        v1 = [1.0, 0.0, 0.0]
        self.assertAlmostEqual(cosine_similarity(v1, v1), 1.0, places=5)

        # Orthogonal vectors -> similarity = 0.0
        v2 = [0.0, 1.0, 0.0]
        self.assertAlmostEqual(cosine_similarity(v1, v2), 0.0, places=5)

        # Opposite vectors -> similarity = -1.0
        v3 = [-1.0, 0.0, 0.0]
        self.assertAlmostEqual(cosine_similarity(v1, v3), -1.0, places=5)

        # Mismatched dimensions
        with self.assertRaises(ValueError):
            cosine_similarity([1.0, 2.0], [1.0, 2.0, 3.0])

    def test_pipeline_embed_text_and_query(self):
        text_vec = self.pipeline.embed_text("Safety guidelines section 4.1")
        self.assertEqual(len(text_vec), DEFAULT_EMBEDDING_DIMENSION)

        query_vec = self.pipeline.embed_query("safety guidelines")
        self.assertEqual(len(query_vec), DEFAULT_EMBEDDING_DIMENSION)

        sim = cosine_similarity(text_vec, query_vec)
        self.assertIsInstance(sim, float)

    def test_async_embedding(self):
        async def run_async():
            vec = await self.pipeline.aembed_text("Async embedding generation")
            self.assertEqual(len(vec), 384)

            batch = await self.pipeline.aembed_documents([
                "Chunk 1 text",
                "Chunk 2 text",
            ])
            self.assertEqual(len(batch), 2)
            self.assertEqual(len(batch[0]), 384)

            q_vec = await self.pipeline.aembed_query("Query test")
            self.assertEqual(len(q_vec), 384)

        asyncio.run(run_async())


if __name__ == "__main__":
    unittest.main()
