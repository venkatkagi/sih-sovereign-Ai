import asyncio
import logging
import os
from collections.abc import AsyncIterator
from typing import Any, Optional

from ollama import AsyncClient

from .interface import ModelInterface
from .model_types import ModelConfig

logger = logging.getLogger(__name__)


class OllamaModel(ModelInterface):

    def __init__(self, config: ModelConfig):
        self.config = config
        self.client = AsyncClient()

    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]] = None,
        **kwargs
    ) -> dict[str, Any]:
        """Execute a chat step with optional tool definitions and fallback."""
        options = {
            "temperature": kwargs.get(
                "temperature",
                self.config.temperature
            ),
            "num_ctx": kwargs.get("num_ctx", int(os.getenv("OLLAMA_NUM_CTX", "2048"))),
            "num_predict": kwargs.get("num_predict", kwargs.get("max_tokens", 1024)),
        }
        params: dict[str, Any] = {
            "model": self.config.ollama_model,
            "messages": messages,
            "options": options,
        }
        if tools and self.supports("tool_calling"):
            params["tools"] = tools

        timeout_seconds = kwargs.get("timeout", float(os.getenv("OLLAMA_TIMEOUT", "180.0")))
        try:
            response = await asyncio.wait_for(self.client.chat(**params), timeout=timeout_seconds)
            return response.get("message", {})
        except asyncio.TimeoutError:
            logger.warning(f"Ollama request to {self.config.ollama_model} timed out after {timeout_seconds}s.")
            return {"role": "assistant", "content": "Local model response timed out. Please try again."}
        except Exception as e:
            err_str = str(e).lower()
            if "does not support tools" in err_str or "tools" in err_str:
                params.pop("tools", None)
                try:
                    response = await asyncio.wait_for(self.client.chat(**params), timeout=timeout_seconds)
                    return response.get("message", {})
                except Exception as inner_e:
                    logger.error(f"Ollama fallback chat error: {inner_e}")
                    return {"role": "assistant", "content": f"Local model error: {inner_e}"}
            logger.error(f"Ollama chat error: {e}")
            return {"role": "assistant", "content": f"Local model error: {e}"}


    async def generate(
        self,
        messages: list[dict],
        tools: Optional[list[dict]] = None,
        **kwargs
    ) -> str:
        msg = await self.chat(messages=messages, tools=tools, **kwargs)
        return msg.get("content", "")

    async def stream_chunks(
        self,
        messages: list[dict],
        tools: Optional[list[dict]] = None,
        **kwargs
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream chunks from Ollama in real-time, distinguishing thinking and content."""
        options = {
            "temperature": kwargs.get("temperature", self.config.temperature),
            "num_ctx": kwargs.get("num_ctx", int(os.getenv("OLLAMA_NUM_CTX", "2048"))),
            "num_predict": kwargs.get("num_predict", kwargs.get("max_tokens", 1024)),
        }
        params: dict[str, Any] = {
            "model": self.config.ollama_model,
            "messages": messages,
            "stream": True,
            "options": options,
        }
        if tools and self.supports("tool_calling"):
            params["tools"] = tools

        try:
            response = await self.client.chat(**params)
            async for chunk in response:
                msg = chunk.get("message", {})
                yield {
                    "content": msg.get("content", ""),
                    "thinking": msg.get("thinking", ""),
                    "tool_calls": msg.get("tool_calls", []),
                    "done": chunk.get("done", False),
                }
        except Exception as e:
            err_str = str(e).lower()
            if "does not support tools" in err_str or "tools" in err_str:
                params.pop("tools", None)
                try:
                    response = await self.client.chat(**params)
                    async for chunk in response:
                        msg = chunk.get("message", {})
                        yield {
                            "content": msg.get("content", ""),
                            "thinking": msg.get("thinking", ""),
                            "tool_calls": msg.get("tool_calls", []),
                            "done": chunk.get("done", False),
                        }
                except Exception as inner_e:
                    logger.error(f"Fallback stream error: {inner_e}")
                    yield {"content": f"Local model error: {inner_e}", "thinking": "", "tool_calls": [], "done": True}
            else:
                logger.error(f"Stream error: {e}")
                yield {"content": f"Local model error: {e}", "thinking": "", "tool_calls": [], "done": True}

    async def stream(
        self,
        messages: list[dict],
        **kwargs
    ) -> AsyncIterator[str]:

        async for chunk in self.stream_chunks(messages=messages, **kwargs):
            c = chunk.get("content", "") or chunk.get("thinking", "")
            if c:
                yield c

    def supports(self, capability: str) -> bool:
        return capability in self.config.capabilities

    def model_name(self) -> str:
        return self.config.name