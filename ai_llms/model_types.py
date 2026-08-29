from dataclasses import dataclass, field
from typing import Literal


ComplexityType = Literal["low", "medium", "high"]


@dataclass
class ModelConfig:
    name: str
    ollama_model: str
    modalities: set[str] = field(default_factory=lambda: {"text"})
    capabilities: set[str] = field(default_factory=set)
    max_complexity: ComplexityType = "medium"
    target_vram_gb: float = 4.0
    tool_calling: bool = True
    reasoning: bool = True
    temperature: float = 0.2
    context_length: int = 8192


QWEN3_4B = ModelConfig(
    name="qwen3-4b",
    ollama_model="qwen3:4b",
    modalities={"text"},
    capabilities={
        "text",
        "reasoning",
        "tool_calling",
    },
    max_complexity="medium",
    target_vram_gb=3.2,
    tool_calling=True,
    reasoning=True,
)

QWEN3_8B = ModelConfig(
    name="qwen3-8b",
    ollama_model="qwen3:8b",
    modalities={"text"},
    capabilities={
        "text",
        "reasoning",
        "tool_calling",
    },
    max_complexity="high",
    target_vram_gb=5.8,
    tool_calling=True,
    reasoning=True,
)

QWEN3_VL = ModelConfig(
    name="qwen3-vl-4b",
    ollama_model="qwen3-vl:4b",
    modalities={"text", "image", "video"},
    capabilities={
        "text",
        "image",
        "video",
        "vision",
        "reasoning",
        "tool_calling",
    },
    max_complexity="medium",
    target_vram_gb=4.5,
    tool_calling=True,
    reasoning=True,
)

GEMMA3_4B = ModelConfig(
    name="gemma3-4b",
    ollama_model="gemma3:4b",
    modalities={"text", "image"},
    capabilities={
        "text",
        "image",
        "vision",
        "reasoning",
        "tool_calling",
    },
    max_complexity="medium",
    target_vram_gb=3.8,
    tool_calling=True,
    reasoning=True,
)

GEMMA3_8B = ModelConfig(
    name="gemma3-8b",
    ollama_model="gemma3:8b",
    modalities={"text", "image"},
    capabilities={
        "text",
        "image",
        "vision",
        "reasoning",
        "tool_calling",
    },
    max_complexity="high",
    target_vram_gb=6.2,
    tool_calling=True,
    reasoning=True,
)