from typing import Optional
from .model_types import (
    GEMMA3_4B,
    GEMMA3_8B,
    QWEN3_4B,
    QWEN3_8B,
    QWEN3_VL,
    ComplexityType,
    ModelConfig,
)


class ModelRegistry:
    """Central metadata registry for local LLMs and Multimodal models."""

    def __init__(self, load_defaults: bool = True):
        self._models: dict[str, ModelConfig] = {}
        self._aliases: dict[str, str] = {}
        if load_defaults:
            self._load_defaults()

    def _load_defaults(self) -> None:
        defaults = [QWEN3_4B, QWEN3_8B, QWEN3_VL, GEMMA3_4B, GEMMA3_8B]
        for model in defaults:
            self.register(model)

    def register(self, config: ModelConfig) -> None:
        """Register a model configuration with its primary name and ollama tag alias."""
        norm_name = config.name.strip().lower()
        self._models[norm_name] = config

        # Map ollama_model tag as alias if distinct
        norm_tag = config.ollama_model.strip().lower()
        self._aliases[norm_tag] = norm_name

    def unregister(self, name_or_tag: str) -> bool:
        """Unregister a model by its name or tag."""
        key = name_or_tag.strip().lower()
        target_name = self._aliases.get(key, key)
        if target_name in self._models:
            del self._models[target_name]
            # Remove aliases pointing to target_name
            self._aliases = {k: v for k, v in self._aliases.items() if v != target_name}
            return True
        return False

    def get(self, name_or_tag: Any) -> Optional[ModelConfig]:
        """Look up a model config by identifier, tag, or ModelConfig."""
        if not name_or_tag:
            return None
        if isinstance(name_or_tag, ModelConfig):
            return name_or_tag
        key = str(name_or_tag).strip().lower()
        target_name = self._aliases.get(key, key)
        return self._models.get(target_name)

    def get_or_raise(self, name_or_tag: str) -> ModelConfig:
        """Get model config or raise KeyError if not found."""
        config = self.get(name_or_tag)
        if config is None:
            raise KeyError(
                f"Model '{name_or_tag}' not found in registry. "
                f"Available models: {list(self._models.keys())}"
            )
        return config

    def list_models(self) -> list[ModelConfig]:
        """Return all registered model configurations."""
        return list(self._models.values())

    def get_model_names(self) -> list[str]:
        """Return all registered primary model names."""
        return list(self._models.keys())

    def filter_by_modality(self, modality: str) -> list[ModelConfig]:
        """Return models supporting the specified modality (e.g., 'image', 'video', 'text')."""
        norm_mod = modality.strip().lower()
        return [
            m for m in self._models.values()
            if norm_mod in {mod.lower() for mod in m.modalities}
        ]

    def filter_by_capability(self, capability: str) -> list[ModelConfig]:
        """Return models supporting the specified capability."""
        norm_cap = capability.strip().lower()
        return [
            m for m in self._models.values()
            if norm_cap in {c.lower() for mod in m.capabilities for c in [mod]}
        ]

    def filter_by_vram(self, max_vram_gb: float) -> list[ModelConfig]:
        """Return models whose target VRAM does not exceed max_vram_gb."""
        return [
            m for m in self._models.values()
            if m.target_vram_gb <= max_vram_gb
        ]

    def filter_by_complexity(self, complexity: ComplexityType) -> list[ModelConfig]:
        """Return models that match or exceed the target complexity capacity."""
        ranks = {"low": 1, "medium": 2, "high": 3}
        target_rank = ranks.get(complexity.lower(), 1)
        return [
            m for m in self._models.values()
            if ranks.get(m.max_complexity.lower(), 1) >= target_rank
        ]

    def create_instance(self, name_or_tag: str):
        """Create an OllamaModel instance for the specified model config."""
        from .ollama_client import OllamaModel
        config = self.get_or_raise(name_or_tag)
        return OllamaModel(config)


# Global default registry instance
model_registry = ModelRegistry()
