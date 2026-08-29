from app.embeddings.model import EmbeddingModel
from app.vectorstore.store import VectorStore
from app.retrieval.hybrid import HybridRetriever
from app.generation.gemini import GeminiGenerator
from app.rag.pipeline import RAGPipeline


CHROMA_DIR = "data/benchmark/chroma"
COLLECTION_NAME = "benchmark"
TOP_K = 3


def build_pipeline() -> RAGPipeline:
    """Build the complete Sovereign RAG pipeline."""

    print("Loading embedding model...")
    embedder = EmbeddingModel()

    print("Opening vector database...")
    store = VectorStore(
        path=CHROMA_DIR,
        collection_name=COLLECTION_NAME,
    )

    retriever = HybridRetriever(
        store,
        embedder,
    )

    generator = GeminiGenerator()

    return RAGPipeline(
        retriever,
        generator,
    )


def main() -> None:
    pipeline = build_pipeline()

    print()
    print("================================")
    print("       SOVEREIGN RAG CLI")
    print("================================")
    print("Ask questions about your documents.")
    print("Type 'exit' to quit.")
    print()

    while True:
        try:
            question = input("Question: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting Sovereign RAG.")
            break

        if question.lower() == "exit":
            print("Exiting Sovereign RAG.")
            break

        if not question:
            print("Please enter a question.")
            print()
            continue

        try:
            result = pipeline.ask(
                question,
                n_results=TOP_K,
            )

            print()
            print("Answer:")
            print(result["answer"])

            if result["sources"]:
                print()
                print("Sources:")
                for source in result["sources"]:
                    print(f"- {source}")

            print()

        except Exception as exc:
            print()
            print("Error while processing the question:")
            print(str(exc))
            print()


if __name__ == "__main__":
    main()
