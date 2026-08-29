from dataclasses import dataclass, field
import os
import re
from typing import Optional

from .model_types import ComplexityType, ModelConfig
from .registry import ModelRegistry, model_registry


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".gif"}
VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

HIGH_COMPLEXITY_KEYWORDS = {
    # Cross-document & Comparison
    "compare", "contrast", "comparison", "differences between", "discrepancy",
    "discrepancies", "cross-document", "across documents", "correlate",
    "reconcile", "contradiction", "inconsistencies",
    # Auditing & Compliance
    "audit", "compliance", "regulatory", "standard", "policy violation",
    "safety standard", "legal", "clause", "statutory", "investigate",
    # Deep reasoning & synthesis
    "synthesize", "root cause", "implications", "tradeoffs", "evaluate",
    "step by step", "multi-step", "deduce", "deduction", "formulate",
    "critical analysis", "comprehensive analysis", "risk assessment",
    # Code & Math
    "calculate", "computation", "derivative", "integral", "run python",
    "execute code", "sandbox", "algorithm",
}

LOW_COMPLEXITY_KEYWORDS = {
    "hello", "hi", "hey", "greetings", "good morning", "good evening",
    "thank you", "thanks", "what is", "who is", "when is", "define",
    "simple summary", "single page", "lookup", "find keyword",
}


@dataclass
class RoutingDecision:
    """Detailed record of the dynamic routing analysis and chosen model."""
    model_config: ModelConfig
    complexity: ComplexityType
    complexity_score: float
    modalities: set[str] = field(default_factory=set)
    reason: str = ""

    @property
    def model_name(self) -> str:
        return self.model_config.name

    @property
    def ollama_model(self) -> str:
        return self.model_config.ollama_model


class DynamicRouter:
    """Dynamic LLM and Multimodal router based on task complexity and input modalities."""

    def __init__(self, registry: Optional[ModelRegistry] = None):
        self.registry = registry or model_registry

    def detect_modalities(
        self,
        media_paths: Optional[list[str]] = None,
        explicit_modalities: Optional[set[str]] = None,
    ) -> set[str]:
        """Detect required modalities from input attachments or explicit declarations."""
        modalities = {"text"}
        if explicit_modalities:
            modalities.update({m.lower() for m in explicit_modalities})

        if media_paths:
            for path in media_paths:
                _, ext = os.path.splitext(path.lower())
                if ext in VIDEO_EXTENSIONS:
                    modalities.add("video")
                    modalities.add("image")
                elif ext in IMAGE_EXTENSIONS:
                    modalities.add("image")
        return modalities

    def analyze_complexity(
        self,
        query: str,
        media_paths: Optional[list[str]] = None,
    ) -> tuple[ComplexityType, float, list[str]]:
        """
        Analyze prompt text and media to compute complexity level, score (0.0 - 1.0),
        and contributing reasoning factors.
        """
        factors: list[str] = []
        score = 0.35  # Base medium/standard starting point

        query_clean = query.strip()
        query_lower = query_clean.lower()
        word_count = len(query_clean.split())

        # 1. Length-based heuristics
        if word_count > 120:
            score += 0.25
            factors.append("Extensive query context length (>120 words)")
        elif word_count > 50:
            score += 0.15
            factors.append("Moderate query context length (>50 words)")
        elif word_count < 8 and not media_paths:
            score -= 0.15
            factors.append("Short query length (<8 words)")

        # 2. Structural heuristics (multi-part questions, bullet points, numbers)
        bullet_points = len(re.findall(r"(?:^|\n)\s*(?:[-*]|\d+\.)\s+", query_clean))
        if bullet_points >= 2:
            score += 0.2
            factors.append(f"Structured multi-part instructions ({bullet_points} points)")

        # 3. High complexity keyword triggers
        matched_high_keywords = [
            kw for kw in HIGH_COMPLEXITY_KEYWORDS
            if re.search(r"\b" + re.escape(kw) + r"\b", query_lower)
        ]
        if matched_high_keywords:
            weight = min(0.35, 0.15 * len(matched_high_keywords))
            score += weight
            factors.append(f"High-reasoning keywords matched: {matched_high_keywords[:4]}")

        # 4. Low complexity keyword triggers
        matched_low_keywords = [
            kw for kw in LOW_COMPLEXITY_KEYWORDS
            if re.search(r"\b" + re.escape(kw) + r"\b", query_lower)
        ]
        if matched_low_keywords and not matched_high_keywords:
            score -= 0.2
            factors.append(f"Simple lookup/conversational keywords matched: {matched_low_keywords[:3]}")

        # 5. Media attachments impact
        if media_paths:
            factors.append(f"{len(media_paths)} media attachment(s) present")
            if len(media_paths) > 2:
                score += 0.15
                factors.append("Multiple media attachments require complex synthesis")

        # Bound score between 0.0 and 1.0
        final_score = max(0.0, min(1.0, score))

        if final_score >= 0.65:
            complexity: ComplexityType = "high"
        elif final_score <= 0.30:
            complexity = "low"
        else:
            complexity = "medium"

        return complexity, round(final_score, 3), factors

    def route_with_decision(
        self,
        query: str,
        media_paths: Optional[list[str]] = None,
        complexity_override: Optional[ComplexityType] = None,
        max_vram_gb: Optional[float] = None,
        explicit_modalities: Optional[set[str]] = None,
    ) -> RoutingDecision:
        """
        Evaluate query and route to optimal model, returning a full RoutingDecision
        for explainability and auditing.
        """
        modalities = self.detect_modalities(media_paths, explicit_modalities)
        is_multimodal = ("image" in modalities) or ("video" in modalities)
        has_video = "video" in modalities

        if complexity_override:
            complexity = complexity_override
            comp_score = 1.0 if complexity == "high" else (0.5 if complexity == "medium" else 0.1)
            factors = [f"Explicit complexity override: '{complexity_override}'"]
        else:
            complexity, comp_score, factors = self.analyze_complexity(query, media_paths)

        # Apply Routing Rules defined in AGENTS.md
        chosen_config: Optional[ModelConfig] = None
        routing_reason = ""

        if is_multimodal:
            if has_video:
                chosen_config = self.registry.get("qwen3-vl-4b") or self.registry.get("gemma3-4b")
                routing_reason = "Video modality detected -> Selected qwen3-vl-4b (Video capability)"
            elif complexity == "high":
                chosen_config = self.registry.get("gemma3-8b") or self.registry.get("gemma3-4b") or self.registry.get("qwen3-vl-4b")
                routing_reason = "Multimodal image input with High complexity -> Selected gemma3-8b (High reasoning Gemma vision model)"
            else:
                chosen_config = self.registry.get("gemma3-4b") or self.registry.get("gemma3-8b") or self.registry.get("qwen3-vl-4b")
                routing_reason = f"Multimodal image input with {complexity.capitalize()} complexity -> Selected gemma3-4b (Fast Gemma vision model)"
        else:
            if complexity == "high":
                chosen_config = self.registry.get("qwen3-8b") or self.registry.get("qwen3-4b")
                routing_reason = "Text-only input with High complexity -> Selected qwen3-8b (Deep reasoning & audit)"
            else:
                chosen_config = self.registry.get("qwen3-4b")
                routing_reason = f"Text-only input with {complexity.capitalize()} complexity -> Selected qwen3-4b (Fast 4B text model)"

        # Fallback if preferred model wasn't found in registry
        if not chosen_config:
            matching = [
                m for m in self.registry.list_models()
                if modalities.issubset(m.modalities)
            ]
            chosen_config = matching[0] if matching else self.registry.get_or_raise("qwen3-4b")
            routing_reason += " (Fallback selection from registry)"

        # VRAM constraint verification and fallback if needed
        if max_vram_gb is not None and chosen_config.target_vram_gb > max_vram_gb:
            vram_candidates = [
                m for m in self.registry.list_models()
                if m.target_vram_gb <= max_vram_gb and modalities.issubset(m.modalities)
            ]
            if vram_candidates:
                # Pick candidate with highest complexity support within VRAM
                ranks = {"low": 1, "medium": 2, "high": 3}
                vram_candidates.sort(key=lambda m: ranks.get(m.max_complexity, 1), reverse=True)
                previous_name = chosen_config.name
                chosen_config = vram_candidates[0]
                routing_reason += (
                    f" | VRAM budget capped at {max_vram_gb}GB: adjusted from "
                    f"{previous_name} to {chosen_config.name}"
                )

        full_reason = f"{routing_reason}. Factors: {'; '.join(factors)}"

        return RoutingDecision(
            model_config=chosen_config,
            complexity=complexity,
            complexity_score=comp_score,
            modalities=modalities,
            reason=full_reason,
        )

    def route(
        self,
        query: str,
        media_paths: Optional[list[str]] = None,
        complexity_override: Optional[ComplexityType] = None,
        max_vram_gb: Optional[float] = None,
        explicit_modalities: Optional[set[str]] = None,
    ) -> ModelConfig:
        """Route to the optimal ModelConfig based on inputs."""
        decision = self.route_with_decision(
            query=query,
            media_paths=media_paths,
            complexity_override=complexity_override,
            max_vram_gb=max_vram_gb,
            explicit_modalities=explicit_modalities,
        )
        return decision.model_config

    def get_model(
        self,
        query: str,
        media_paths: Optional[list[str]] = None,
        complexity_override: Optional[ComplexityType] = None,
        max_vram_gb: Optional[float] = None,
    ):
        """Route and return an instantiated OllamaModel instance."""
        from .ollama_client import OllamaModel
        config = self.route(
            query=query,
            media_paths=media_paths,
            complexity_override=complexity_override,
            max_vram_gb=max_vram_gb,
        )
        return OllamaModel(config)


# Global default router instance
model_router = DynamicRouter()
# Alias for backwards compatibility
ModelRouter = DynamicRouter
