from pathlib import Path
import re
import time

from backend.embeddings.model import EmbeddingModel
from backend.vectorstore.store import VectorStore
from backend.retrieval.hybrid import HybridRetriever


CHROMA_DIR = Path("data/scaling/chroma")
COLLECTION_NAME = "scaling"

TOP_K = 5


def make_questions():
    questions = []

    # One question for every 100th document.
    for i in range(5, 10001, 100):
        document_id = f"DOC-{i:06d}"
        equipment_tag = f"CO-{i:06d}"

        questions.append(
            {
                "question": (
                    f"What inspection finding was reported for "
                    f"equipment {equipment_tag} at the Trichy Power Station?"
                ),
                "expected_document": f"{document_id}.txt",
            }
        )

    return questions


def main():
    print("Loading embedding model...")
    model = EmbeddingModel()

    print("Opening 10K ChromaDB...")
    store = VectorStore(
        path=CHROMA_DIR,
        collection_name=COLLECTION_NAME,
    )

    retriever = HybridRetriever(store, model)

    questions = make_questions()

    print("Stored vectors:", store.count())
    print("Questions:", len(questions))
    print()

    top1_correct = 0
    top3_correct = 0
    top5_correct = 0

    latencies = []
    failures = []

    for index, item in enumerate(questions, start=1):
        question = item["question"]
        expected = item["expected_document"]

        start = time.perf_counter()

        results = retriever.search(
            question,
            TOP_K,
        )

        elapsed = time.perf_counter() - start
        latencies.append(elapsed)

        retrieved = [
            metadata["source"]
            for metadata in results["metadatas"][0]
        ]

        top1 = expected in retrieved[:1]
        top3 = expected in retrieved[:3]
        top5 = expected in retrieved[:5]

        if top1:
            top1_correct += 1

        if top3:
            top3_correct += 1

        if top5:
            top5_correct += 1

        if not top5:
            failures.append(
                {
                    "question": question,
                    "expected": expected,
                    "retrieved": retrieved,
                }
            )

        if index % 10 == 0:
            print(f"Evaluated {index}/{len(questions)}")

    total = len(questions)

    average_latency = sum(latencies) / total
    min_latency = min(latencies)
    max_latency = max(latencies)

    print()
    print("================================")
    print("     10K RETRIEVAL BENCHMARK")
    print("================================")
    print(f"Documents indexed: {store.count()}")
    print(f"Questions tested: {total}")

    print(
        f"Top-1 accuracy: "
        f"{top1_correct}/{total} "
        f"({top1_correct / total * 100:.1f}%)"
    )

    print(
        f"Top-3 accuracy: "
        f"{top3_correct}/{total} "
        f"({top3_correct / total * 100:.1f}%)"
    )

    print(
        f"Top-5 accuracy: "
        f"{top5_correct}/{total} "
        f"({top5_correct / total * 100:.1f}%)"
    )

    print(
        f"Average latency: "
        f"{average_latency * 1000:.2f} ms"
    )

    print(
        f"Minimum latency: "
        f"{min_latency * 1000:.2f} ms"
    )

    print(
        f"Maximum latency: "
        f"{max_latency * 1000:.2f} ms"
    )

    print(f"Failures: {len(failures)}")

    if failures:
        print()
        print("=== FAILURE CASES ===")

        for failure in failures[:10]:
            print()
            print("Question:", failure["question"])
            print("Expected:", failure["expected"])
            print("Retrieved:", failure["retrieved"])


if __name__ == "__main__":
    main()
