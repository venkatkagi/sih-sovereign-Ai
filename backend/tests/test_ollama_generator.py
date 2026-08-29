import unittest
from unittest.mock import MagicMock, patch

from backend.generation.ollama_gen import OllamaGenerator
from backend.ai.registry import ModelRegistry
from backend.ai.router import DynamicRouter


class MockModelClient:
    def __init__(self, response_text: str):
        self.response_text = response_text
        self.last_messages = []

    async def generate(self, messages: list[dict], **kwargs) -> str:
        self.last_messages = messages
        return self.response_text


class OllamaGeneratorTests(unittest.TestCase):

    def setUp(self):
        self.registry = ModelRegistry()
        self.router = DynamicRouter(self.registry)
        self.generator = OllamaGenerator(
            router=self.router,
            registry=self.registry,
        )

    def test_insufficient_context_returns_safe_fallback(self):
        # Empty context
        res = self.generator.generate("What is the pressure limit?", [])
        self.assertEqual(res, "I don't have enough information in the provided documents.")

        # Context with only whitespace
        res = self.generator.generate("What is the pressure limit?", [{"text": "   ", "metadata": {}}])
        self.assertEqual(res, "I don't have enough information in the provided documents.")

    def test_grounded_generation_with_mock_model(self):
        mock_client = MockModelClient("The maximum pressure limit is 150 PSI.")

        with patch.object(self.registry, "create_instance", return_value=mock_client):
            contexts = [
                {
                    "text": "The boiler operating pressure limit is 150 PSI under standard conditions.",
                    "metadata": {
                        "source": "boiler_manual.pdf",
                        "page": 4,
                        "document_id": "DOC-001234",
                        "equipment_tag": "BL-000001",
                    }
                }
            ]

            answer = self.generator.generate(
                question="What is the boiler operating pressure limit?",
                contexts=contexts,
            )

            self.assertEqual(answer, "The maximum pressure limit is 150 PSI.")
            self.assertEqual(len(mock_client.last_messages), 2)
            self.assertEqual(mock_client.last_messages[0]["role"], "system")
            self.assertIn("boiler_manual.pdf", mock_client.last_messages[1]["content"])
            self.assertIn("DOC-001234", mock_client.last_messages[1]["content"])
            self.assertIn("BL-000001", mock_client.last_messages[1]["content"])


if __name__ == "__main__":
    unittest.main()
