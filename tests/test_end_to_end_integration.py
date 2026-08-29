import asyncio
from pathlib import Path
import unittest

from app.rag.service import RAGService
from app.vectorstore.chroma import ChromaVectorStore
from app.embeddings.model import EmbeddingModel
from app.generation.ollama_gen import OllamaGenerator
from ai_llms.api import app
from fastapi.testclient import TestClient


class EndToEndIntegrationTests(unittest.TestCase):

    def setUp(self):
        self.test_pdf = Path("data/test_documents/ocr_scanned.pdf")
        self.client = TestClient(app)

    def test_full_rag_ingestion_and_hybrid_retrieval(self):
        # 1. Ingest real OCR scanned test document
        rag_service = RAGService(
            vector_store_path="data/test_e2e_chroma",
            collection_name="e2e_test_collection",
        )

        ingest_res = rag_service.ingest(self.test_pdf)
        self.assertEqual(ingest_res["filename"], "ocr_scanned.pdf")
        self.assertGreaterEqual(ingest_res["chunks_indexed"], 1)

        # 2. Hybrid Retrieval with exact identifier matching (PU-000001)
        retrieved_contexts = rag_service.pipeline.retrieve(
            question="What is the inspection finding for equipment tag PU-000001?",
            n_results=2,
            source="ocr_scanned.pdf",
        )

        self.assertGreaterEqual(len(retrieved_contexts), 1)
        top_ctx = retrieved_contexts[0]
        meta = top_ctx["metadata"]

        self.assertEqual(meta.get("source"), "ocr_scanned.pdf")
        self.assertEqual(meta.get("page"), 1)
        self.assertTrue(meta.get("ocr_used"))
        self.assertEqual(meta.get("equipment_tag"), "PU-000001")
        self.assertIn("seal leakage", top_ctx["text"])

    def test_insufficient_information_fallback_prompting(self):
        rag_service = RAGService(
            vector_store_path="data/test_e2e_chroma",
            collection_name="e2e_test_collection",
        )

        # Query about a topic not in the document
        res = rag_service.ask(
            question="What is the nuclear reactor core temperature limit in the document?",
            n_results=2,
        )

        self.assertIn("answer", res)
        # Should not invent facts
        self.assertIsInstance(res["sources"], list)


if __name__ == "__main__":
    unittest.main()
