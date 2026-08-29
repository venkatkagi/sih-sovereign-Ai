import asyncio
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.ai.agent_loop import AgentResponse, ReActAgentEngine
from backend.ai.model_types import QWEN3_4B, QWEN3_8B, ModelConfig
from backend.ai.registry import ModelRegistry
from backend.ai.router import DynamicRouter, RoutingDecision
from backend.ai.tools import ToolRegistry, calculate_expression, search_documents


class MockOllamaClient:
    """Mock client simulating multi-turn Ollama chat with tool calling."""

    def __init__(self, responses: list[dict]):
        self.responses = list(responses)
        self.call_count = 0

    async def chat(self, messages: list[dict], tools: list[dict] = None, **kwargs) -> dict:
        if self.call_count < len(self.responses):
            res = self.responses[self.call_count]
            self.call_count += 1
            return res
        return {"role": "assistant", "content": "Default final answer"}


class TestAgentLoopEngine(unittest.TestCase):

    def setUp(self):
        self.registry = ModelRegistry()
        self.router = DynamicRouter(self.registry)
        self.tools = ToolRegistry()
        self.agent = ReActAgentEngine(
            router=self.router,
            registry=self.registry,
            tools=self.tools,
        )

    def test_direct_answer_without_tools(self):
        # Scenario: User asks a simple question, model responds without tool calls
        mock_response = {
            "role": "assistant",
            "content": "A Standard Operating Procedure (SOP) is a set of step-by-step instructions.",
            "tool_calls": [],
        }
        mock_client = MockOllamaClient([mock_response])

        with patch.object(self.registry, "create_instance", return_value=mock_client):
            response = asyncio.run(
                self.agent.run(
                    message="What is an SOP?",
                    conversation_id="conv-123",
                )
            )

            self.assertEqual(response.conversation_id, "conv-123")
            self.assertIn("Standard Operating Procedure", response.content)
            self.assertEqual(response.sender, "assistant")
            self.assertEqual(len(response.tool_calls), 0)
            self.assertEqual(response.turns_count, 1)

    def test_react_multiturn_tool_execution(self):
        # Scenario: User asks for calculation -> Model calls calculate_expression -> Receives result -> Model returns final answer
        turn_1_tool_call = {
            "role": "assistant",
            "content": "",
            "tool_calls": [
                {
                    "function": {
                        "name": "calculate_expression",
                        "arguments": {"expression": "25 * 14 + sqrt(256)"},
                    }
                }
            ],
        }
        turn_2_final_answer = {
            "role": "assistant",
            "content": "The calculated result is 366.0 according to our quantitative engine.",
            "tool_calls": [],
        }
        mock_client = MockOllamaClient([turn_1_tool_call, turn_2_final_answer])

        with patch.object(self.registry, "create_instance", return_value=mock_client):
            response = asyncio.run(
                self.agent.run(
                    message="Calculate 25 times 14 plus square root of 256",
                    conversation_id="conv-calc",
                )
            )

            self.assertEqual(response.conversation_id, "conv-calc")
            self.assertIn("366.0", response.content)
            self.assertEqual(len(response.tool_calls), 1)
            self.assertEqual(response.tool_calls[0]["tool"], "calculate_expression")
            self.assertEqual(response.tool_calls[0]["result"]["result"], 366.0)
            self.assertEqual(response.turns_count, 2)

    def test_document_search_and_citation_extraction(self):
        # Scenario: Model calls search_documents -> Citations are extracted and attached to response
        turn_1_search = {
            "role": "assistant",
            "content": "",
            "tool_calls": [
                {
                    "function": {
                        "name": "search_documents",
                        "arguments": {"query": "safety standard 4.1", "top_k": 2},
                    }
                }
            ],
        }
        turn_2_answer = {
            "role": "assistant",
            "content": "According to Section 4.1, noise must not exceed 65 dB.",
            "tool_calls": [],
        }
        mock_client = MockOllamaClient([turn_1_search, turn_2_answer])

        with patch.object(self.registry, "create_instance", return_value=mock_client):
            response = asyncio.run(
                self.agent.run(
                    message="Check safety standard 4.1 noise limit",
                    conversation_id="conv-search",
                )
            )

            self.assertEqual(len(response.tool_calls), 1)
            self.assertGreater(len(response.citations), 0)
            citation = response.citations[0]
            self.assertIn("document_name", citation)
            self.assertIn("page_number", citation)
            self.assertIn("similarity_score", citation)

    def test_streaming_react_events(self):
        turn_1_tool_call = {
            "role": "assistant",
            "content": "",
            "tool_calls": [
                {
                    "function": {
                        "name": "calculate_expression",
                        "arguments": {"expression": "100 / 4"},
                    }
                }
            ],
        }
        turn_2_answer = {
            "role": "assistant",
            "content": "The result is 25.",
            "tool_calls": [],
        }
        mock_client = MockOllamaClient([turn_1_tool_call, turn_2_answer])

        async def collect_stream():
            events = []
            async for ev in self.agent.stream_run("What is 100 divided by 4?"):
                events.append(ev)
            return events

        with patch.object(self.registry, "create_instance", return_value=mock_client):
            events = asyncio.run(collect_stream())
            event_types = [e["event"] for e in events]
            self.assertIn("route", event_types)
            self.assertIn("tool_start", event_types)
            self.assertIn("tool_end", event_types)
            self.assertIn("token", event_types)
            self.assertIn("done", event_types)

            done_event = [e for e in events if e["event"] == "done"][0]
            self.assertIn("25", done_event["data"]["content"])


if __name__ == "__main__":
    unittest.main()
