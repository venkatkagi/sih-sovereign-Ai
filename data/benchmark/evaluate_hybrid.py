from pathlib import Path
import json
import time

from backend.embeddings.model import EmbeddingModel
from backend.retrieval.hybrid import HybridRetriever
from backend.vectorstore.store import VectorStore


QUESTIONS_FILE = Path("data/benchmark/questions.json")
CHROMA_DIR = Path("data/benchmark/chroma")

TOP_K = 5

questions = json.loads(
    QUESTIONS_FILE.read_text(encoding="utf-8")
)

model = EmbeddingModel()

store = VectorStore(
    path=CHROMA_DIR,
    collection_name="benchmark",
)

retriever = HybridRetriever(
    store=store,
    embedder=model,
)

print("Questions:", len(questions))
print("Stored vectors:", store.count())
print()

top1_correct = 0
top3_correct = 0
top5_correct = 0

latencies = []

for item in questions:
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

    if expected in retrieved[:1]:
        top1_correct += 1

    if expected in retrieved[:3]:
        top3_correct += 1

    if expected in retrieved[:5]:
        top5_correct += 1

    print(
        f"{question}\n"
        f"Expected: {expected}\n"
        f"Retrieved: {retrieved}\n"
        f"Latency: {elapsed * 1000:.2f} ms\n"
    )


total = len(questions)

average_latency = sum(latencies) / total

print("=== HYBRID RETRIEVAL BENCHMARK ===")
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
    f"Average query latency: "
    f"{average_latency * 1000:.2f} ms"
)
