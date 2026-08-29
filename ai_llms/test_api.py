import os
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from ai_llms.api import app
from ai_llms.registry import model_registry


class TestFastAPIEndpoints(unittest.TestCase):

    def setUp(self):
        self._prev_backend = os.environ.get("VECTOR_STORE_BACKEND")
        os.environ["VECTOR_STORE_BACKEND"] = "chroma"
        self.client = TestClient(app)

    def tearDown(self):
        if self._prev_backend is not None:
            os.environ["VECTOR_STORE_BACKEND"] = self._prev_backend
        else:
            os.environ.pop("VECTOR_STORE_BACKEND", None)

    def test_health_check(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertTrue(data["air_gap_compliant"])
        self.assertIn("vector_store", data)
        self.assertIn("pgvector", data)

    def test_list_models(self):
        response = self.client.get("/api/v1/models")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreaterEqual(data["count"], 5)
        model_names = [m["name"] for m in data["models"]]
        self.assertIn("qwen3-4b", model_names)
        self.assertIn("qwen3-8b", model_names)
        self.assertIn("qwen3-vl-4b", model_names)

    def test_list_tools(self):
        response = self.client.get("/api/v1/tools")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 5)
        tool_names = [t["name"] for t in data["tools"]]
        self.assertIn("search_documents", tool_names)
        self.assertIn("calculate_expression", tool_names)
        self.assertIn("run_python_sandbox", tool_names)

    def test_calculator_endpoint(self):
        response = self.client.post(
            "/api/v1/calculator",
            json={"expression": "12 * 12 + 10"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["result"], 154)

    def test_sandbox_execute_endpoint(self):
        response = self.client.post(
            "/api/v1/sandbox/execute",
            json={"code": "x = [5, 15, 25]\nprint(f'Average: {sum(x)/len(x)}')", "timeout_seconds": 3},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["stdout"], "Average: 15.0")

    def test_search_documents_endpoint(self):
        response = self.client.post(
            "/api/v1/documents/search",
            json={"query": "safety standard 4.1", "top_k": 2},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("documents", data)
        self.assertGreaterEqual(len(data["documents"]), 1)

    def test_chat_agent_endpoint_mocked(self):
        class MockClient:
            async def chat(self, messages, tools=None, **kwargs):
                return {
                    "role": "assistant",
                    "content": "Section 4.1 standard requires noise level under 65 dB.",
                    "tool_calls": [],
                }

        with patch.object(model_registry, "create_instance", return_value=MockClient()):
            response = self.client.post(
                "/api/v1/chat/agent",
                json={
                    "message": "What is the noise requirement in safety standard 4.1?",
                    "stream": False,
                },
            )
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertIn("65 dB", data["content"])
            self.assertEqual(data["sender"], "assistant")
            self.assertIn("qwen3", data["model_used"])

    def test_chat_agent_streaming_endpoint(self):
        class MockClient:
            async def chat(self, messages, tools=None, **kwargs):
                return {
                    "role": "assistant",
                    "content": "Live token streaming test.",
                    "tool_calls": [],
                }

        with patch.object(model_registry, "create_instance", return_value=MockClient()):
            response = self.client.post(
                "/api/v1/chat/agent",
                json={
                    "message": "Stream this test response",
                    "stream": True,
                },
            )
            self.assertEqual(response.status_code, 200)
            self.assertIn("text/event-stream", response.headers["content-type"])
            body = response.text
            self.assertIn("event: route", body)
            self.assertIn("event: done", body)

    def test_stats_endpoint(self):
        response = self.client.get("/api/v1/stats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("vector_store", data)
        self.assertIn("pgvector", data)
        self.assertIn("vectors_stored", data)
        self.assertIn("models_registered", data)

    def test_document_upload_and_rag_chat_endpoint(self):
        import io
        fake_pdf = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\ntrailer<</Root 1 0 R>>\nstartxref\n%%EOF"
        
        with patch("app.rag.service.RAGService.ingest", return_value={"chunks_indexed": 3, "vectors_stored": 3}):
            response = self.client.post(
                "/api/v1/documents/upload",
                files={"file": ("sample_test_doc.pdf", io.BytesIO(fake_pdf), "application/pdf")},
            )
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "success")
            self.assertEqual(data["filename"], "sample_test_doc.pdf")
            self.assertEqual(data["chunks_indexed"], 3)

        with patch("app.rag.service.RAGService.ask", return_value={
            "answer": "Pump seal inspection confirmed normal status.",
            "sources": ["sample_test_doc.pdf"],
            "contexts": [{"text": "Pump seal inspected.", "metadata": {"source": "sample_test_doc.pdf", "page": 1, "ocr_used": False}}],
        }):
            chat_res = self.client.post(
                "/api/v1/chat",
                json={"question": "What was found in the pump inspection?", "n_results": 2},
            )
            self.assertEqual(chat_res.status_code, 200)
            cdata = chat_res.json()
            self.assertIn("Pump seal inspection", cdata["answer"])
            self.assertEqual(len(cdata["sources"]), 1)
            self.assertEqual(cdata["sources"][0]["source"], "sample_test_doc.pdf")
            self.assertEqual(cdata["sources"][0]["page"], 1)


if __name__ == "__main__":
    unittest.main()

