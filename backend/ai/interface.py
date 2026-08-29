from abc import ABC, abstractmethod
from typing import AsyncIterator


class ModelInterface(ABC):

    @abstractmethod
    async def generate(
        self,
        messages: list[dict],
        **kwargs
    ) -> str:
        """Generate a text response."""
        pass

    @abstractmethod
    async def stream(
        self,
        messages: list[dict],
        **kwargs
    ) -> AsyncIterator[str]:
        """Stream generated tokens."""
        pass

    @abstractmethod
    def supports(self, capability: str) -> bool:
        """Check whether this model supports a capability."""
        pass

    @abstractmethod
    def model_name(self) -> str:
        """Return the model identifier."""
        pass