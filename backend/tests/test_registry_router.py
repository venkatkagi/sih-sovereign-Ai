import unittest
from backend.ai.model_types import (
    GEMMA3_4B,
    GEMMA3_8B,
    QWEN3_4B,
    QWEN3_8B,
    QWEN3_VL,
    ModelConfig,
)
from backend.ai.registry import ModelRegistry, model_registry
from backend.ai.router import DynamicRouter, model_router


class TestModelRegistryAndRouter(unittest.TestCase):

    def test_registry_defaults(self):
        registry = ModelRegistry()
        models = registry.list_models()
        self.assertEqual(len(models), 5)

        # Test lookups by name and ollama tag alias
        self.assertEqual(registry.get("qwen3-4b"), QWEN3_4B)
        self.assertEqual(registry.get("qwen3:4b"), QWEN3_4B)
        self.assertEqual(registry.get("qwen3-8b"), QWEN3_8B)
        self.assertEqual(registry.get("qwen3:8b"), QWEN3_8B)
        self.assertEqual(registry.get("qwen3-vl-4b"), QWEN3_VL)
        self.assertEqual(registry.get("qwen3-vl:4b"), QWEN3_VL)
        self.assertEqual(registry.get("gemma3-4b"), GEMMA3_4B)
        self.assertEqual(registry.get("gemma3:4b"), GEMMA3_4B)
        self.assertEqual(registry.get("gemma3-8b"), GEMMA3_8B)
        self.assertEqual(registry.get("gemma3:8b"), GEMMA3_8B)

    def test_registry_filters(self):
        registry = ModelRegistry()

        # Filter by modality
        video_models = registry.filter_by_modality("video")
        self.assertEqual(len(video_models), 1)
        self.assertEqual(video_models[0].name, "qwen3-vl-4b")

        image_models = registry.filter_by_modality("image")
        self.assertEqual(len(image_models), 3)  # qwen3-vl-4b, gemma3-4b, gemma3-8b
        image_names = {m.name for m in image_models}
        self.assertEqual(image_names, {"qwen3-vl-4b", "gemma3-4b", "gemma3-8b"})

        # Filter by VRAM
        low_vram = registry.filter_by_vram(4.0)
        self.assertEqual({m.name for m in low_vram}, {"qwen3-4b", "gemma3-4b"})

        # Filter by complexity
        high_complexity = registry.filter_by_complexity("high")
        self.assertEqual({m.name for m in high_complexity}, {"qwen3-8b", "gemma3-8b"})

    def test_custom_model_registration(self):
        registry = ModelRegistry(load_defaults=False)
        custom = ModelConfig(
            name="custom-model",
            ollama_model="custom:latest",
            modalities={"text"},
            capabilities={"text", "reasoning"},
            max_complexity="high",
            target_vram_gb=8.0,
        )
        registry.register(custom)
        self.assertEqual(registry.get("custom-model"), custom)
        self.assertEqual(registry.get("custom:latest"), custom)
        self.assertEqual(registry.get_or_raise("custom-model"), custom)

        self.assertTrue(registry.unregister("custom:latest"))
        self.assertIsNone(registry.get("custom-model"))

    def test_router_text_routing(self):
        router = DynamicRouter()

        # Standard / Low complexity text query -> qwen3-4b
        decision_simple = router.route_with_decision("What is the definition of standard operating procedure?")
        self.assertEqual(decision_simple.model_config.name, "qwen3-4b")
        self.assertIn(decision_simple.complexity, ("low", "medium"))

        # High complexity text query (auditing, cross-document, compare, compliance) -> qwen3-8b
        decision_complex = router.route_with_decision(
            "Please conduct a comprehensive audit across documents, compare the safety standards in section 4.1 "
            "with our regulatory compliance checklist, and reconcile all discrepancies step by step."
        )
        self.assertEqual(decision_complex.model_config.name, "qwen3-8b")
        self.assertEqual(decision_complex.complexity, "high")
        self.assertIn("Text-only input with High complexity", decision_complex.reason)

    def test_router_multimodal_routing(self):
        router = DynamicRouter()

        # Image attachment + standard query -> gemma3-4b or qwen3-vl-4b
        decision_img_simple = router.route_with_decision(
            query="What color is shown in this chart?",
            media_paths=["chart.png"]
        )
        self.assertIn(decision_img_simple.model_config.name, ("gemma3-4b", "qwen3-vl-4b"))
        self.assertIn("image", decision_img_simple.modalities)

        # Image attachment + complex reasoning -> gemma3-8b
        decision_img_complex = router.route_with_decision(
            query="Perform an in-depth critical analysis and audit of the financial table in this image, evaluate the tradeoffs, and compute discrepancies.",
            media_paths=["financial_table.jpg"]
        )
        self.assertEqual(decision_img_complex.model_config.name, "gemma3-8b")
        self.assertEqual(decision_img_complex.complexity, "high")
        self.assertIn("Multimodal image input with High complexity", decision_img_complex.reason)

        # Video attachment -> qwen3-vl-4b
        decision_video = router.route_with_decision(
            query="Analyze this security camera footage for incidents.",
            media_paths=["surveillance.mp4"]
        )
        self.assertEqual(decision_video.model_config.name, "qwen3-vl-4b")
        self.assertIn("video", decision_video.modalities)

    def test_router_complexity_override_and_vram(self):
        router = DynamicRouter()

        # Explicit complexity override
        config_override = router.route(
            query="Hello",
            complexity_override="high"
        )
        self.assertEqual(config_override.name, "qwen3-8b")

        # VRAM limit capping (e.g. max 4.0 GB should avoid qwen3-8b and use qwen3-4b)
        decision_vram = router.route_with_decision(
            query="Perform a deep audit across all documents and reconcile discrepancies",
            max_vram_gb=4.0
        )
        self.assertLessEqual(decision_vram.model_config.target_vram_gb, 4.0)
        self.assertEqual(decision_vram.model_config.name, "qwen3-4b")
        self.assertIn("VRAM budget capped", decision_vram.reason)

    def test_router_get_model_instance(self):
        router = DynamicRouter()
        model = router.get_model("Explain how gravity works")
        self.assertEqual(model.config.name, "qwen3-4b")
        self.assertTrue(model.supports("text"))
        self.assertTrue(model.supports("reasoning"))


if __name__ == "__main__":
    unittest.main()
