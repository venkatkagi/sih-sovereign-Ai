import unittest

from app.rag.service import RAGService


class FakeEmbedder:
    def encode(self, texts):
        return [[0.0] * 384 for _ in texts]


class FakeGenerator:
    def generate(self, question, contexts):
        return "FAKE GENERATOR RESPONSE"


class FakeVectorStore:
    def __init__(self):
        self.items = []

    def add_documents(self, ids, texts, embeddings, metadatas):
        self.items.extend(
            zip(ids, texts, embeddings, metadatas)
        )

    def search(self, embedding, n_results=5):
        return {
            "documents": [[
                "Test document evidence."
            ]],
            "metadatas": [[
                {
                    "source": "test.pdf",
                    "page": 1,
                }
            ]],
            "distances": [[0.1]],
        }

    def get_by_metadata(self, field, values):
        return []

    def count(self):
        return len(self.items)


class ProviderInjectionTests(unittest.TestCase):

    def test_custom_providers_can_be_injected(self):
        embedder = FakeEmbedder()
        generator = FakeGenerator()
        vector_store = FakeVectorStore()

        service = RAGService(
            embedder=embedder,
            generator=generator,
            vector_store=vector_store,
        )

        self.assertIs(service.embedder, embedder)
        self.assertIs(service.generator, generator)
        self.assertIs(service.vector_store, vector_store)

    def test_custom_generator_is_used_by_pipeline(self):
        service = RAGService(
            embedder=FakeEmbedder(),
            generator=FakeGenerator(),
            vector_store=FakeVectorStore(),
        )

        result = service.pipeline.ask(
            "test question",
            n_results=3,
        )

        self.assertEqual(
            result["answer"],
            "FAKE GENERATOR RESPONSE",
        )


if __name__ == "__main__":
    unittest.main()
