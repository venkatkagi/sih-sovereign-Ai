from typing import Protocol


class EmbeddingProvider(Protocol):
    """Interface for text embedding providers."""

    def encode(self, texts: list[str]):
        """Return one embedding vector for each input text."""
        ...
