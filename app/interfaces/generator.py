from typing import Protocol


class Generator(Protocol):
    """Interface for RAG answer generators."""

    def generate(
        self,
        question: str,
        contexts: list[dict],
    ) -> str:
        """Generate an answer grounded in retrieved contexts."""
        ...
