import asyncio
import logging
from typing import Any, Optional

from ai_llms.registry import ModelRegistry, model_registry
from ai_llms.router import DynamicRouter, model_router

logger = logging.getLogger(__name__)

GROUNDED_SYSTEM_INSTRUCTION = """You are an air-gapped, grounded enterprise document analyst.
Answer the user's question using ONLY the supplied document context.

Rules:
1. Do not use outside knowledge or extrapolate unsupported facts.
2. Do not invent or assume facts.
3. If the answer is not fully supported by the context, respond strictly with:
   "I don't have enough information in the provided documents."
4. Keep the answer clear, concise, and direct.
"""


class OllamaGenerator:
    """
    RAG Generator backed by VaultMind's local Ollama infrastructure and Dynamic Model Router.
    Implements the Generator protocol (generate(question, contexts) -> str).
    """

    def __init__(
        self,
        model_name: Optional[str] = None,
        router: Optional[DynamicRouter] = None,
        registry: Optional[ModelRegistry] = None,
    ) -> None:
        self.router = router or model_router
        self.registry = registry or model_registry
        self.model_override = model_name

    def _format_context_blocks(self, contexts: list[dict]) -> str:
        """Format retrieved chunks into structured context blocks."""
        blocks = []
        for idx, ctx in enumerate(contexts, start=1):
            text = ctx.get("text", "").strip()
            if not text:
                continue

            meta = ctx.get("metadata", {})
            source = meta.get("source", "Unknown Document")
            page = meta.get("page", 1)
            doc_id = meta.get("document_id")
            eq_tag = meta.get("equipment_tag")

            header_parts = [f"Source: {source}", f"Page: {page}"]
            if doc_id:
                header_parts.append(f"Doc ID: {doc_id}")
            if eq_tag:
                header_parts.append(f"Equipment Tag: {eq_tag}")

            blocks.append(f"[Context {idx}]\n" + " | ".join(header_parts) + f"\n{text}")

        return "\n\n".join(blocks)

    def generate(
        self,
        question: str,
        contexts: list[dict],
        model_override: Optional[str] = None,
    ) -> str:
        """Synchronously generate a grounded answer from retrieved context."""
        if not contexts:
            return "I don't have enough information in the provided documents."

        context_text = self._format_context_blocks(contexts)
        if not context_text.strip():
            return "I don't have enough information in the provided documents."

        # Model selection: Explicit override or dynamic router
        selected_model_tag = model_override or self.model_override
        if not selected_model_tag:
            # Let VaultMind DynamicRouter select the best local model
            selected_model_tag = self.router.route(query=question)

        if hasattr(selected_model_tag, "name"):
            selected_model_tag = selected_model_tag.name

        # Get client from VaultMind ModelRegistry
        model_client = self.registry.create_instance(selected_model_tag)

        prompt = (
            f"Document context:\n{context_text}\n\n"
            f"Question:\n{question}\n\n"
            "Answer:"
        )

        messages = [
            {"role": "system", "content": GROUNDED_SYSTEM_INSTRUCTION},
            {"role": "user", "content": prompt},
        ]

        # Execute generation asynchronously if in an event loop or via run
        try:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(lambda: asyncio.run(model_client.generate(messages=messages, temperature=0.1)))
                    raw_answer = future.result(timeout=60)
            else:
                raw_answer = asyncio.run(model_client.generate(messages=messages, temperature=0.1))
        except Exception as exc:
            logger.warning(f"Ollama generation warning: {exc}")
            raw_answer = "I don't have enough information in the provided documents."

        answer = (raw_answer or "").strip()
        if not answer:
            return "I don't have enough information in the provided documents."

        return answer

    async def agenerate(
        self,
        question: str,
        contexts: list[dict],
        model_override: Optional[str] = None,
    ) -> str:
        """Asynchronously generate a grounded answer."""
        if not contexts:
            return "I don't have enough information in the provided documents."

        context_text = self._format_context_blocks(contexts)
        if not context_text.strip():
            return "I don't have enough information in the provided documents."

        selected_model_tag = model_override or self.model_override
        if not selected_model_tag:
            selected_model_tag = self.router.route(query=question)

        if hasattr(selected_model_tag, "name"):
            selected_model_tag = selected_model_tag.name

        model_client = self.registry.create_instance(selected_model_tag)

        prompt = (
            f"Document context:\n{context_text}\n\n"
            f"Question:\n{question}\n\n"
            "Answer:"
        )

        messages = [
            {"role": "system", "content": GROUNDED_SYSTEM_INSTRUCTION},
            {"role": "user", "content": prompt},
        ]

        raw_answer = await model_client.generate(messages=messages, temperature=0.1)
        answer = (raw_answer or "").strip()
        if not answer:
            return "I don't have enough information in the provided documents."

        return answer
