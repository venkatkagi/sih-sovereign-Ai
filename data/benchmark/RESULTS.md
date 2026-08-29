# Sovereign RAG — 100 Document Benchmark

## 1. Purpose

This benchmark evaluates the local RAG retrieval pipeline using a
synthetic industrial inspection dataset.

The objective is to measure:

- Document indexing performance
- Vector storage
- Semantic retrieval accuracy
- Retrieval latency
- Offline model operation

---

## 2. Test Environment

Hardware:

- CPU: 12th Gen Intel Core i7-1255U
- CPU threads: 12
- RAM: 15 GiB
- Storage: NVMe SSD
- GPU: Not used for the embedding benchmark

Software:

- Python: Project virtual environment
- Vector database: ChromaDB
- Embedding model: sentence-transformers/all-MiniLM-L6-v2
- Embedding dimension: 384

---

## 3. Dataset

Number of documents: 100

Document type: Synthetic industrial inspection records

Each document contains:

- Document ID
- Equipment tag
- Equipment type
- Plant
- Operating pressure
- Operating temperature
- Inspection date
- Inspection finding

Total chunks: 100

Total vectors stored: 100

Ground-truth evaluation questions: 10

---

## 4. Indexing Benchmark

Indexing was performed using the local embedding model and ChromaDB.

Results:

| Metric | Result |
|---|---:|
| Documents processed | 100 |
| Total chunks | 100 |
| Vectors stored | 100 |
| Total indexing time | 10.41 seconds |
| Documents/second | 9.61 |
| Chunks/second | 9.61 |

---

## 5. Retrieval Benchmark

Ten questions were tested against the 100-document vector database.

| Metric | Result |
|---|---:|
| Questions tested | 10 |
| Top-1 accuracy | 80% |
| Top-3 accuracy | 90% |
| Top-5 accuracy | 90% |
| Average query latency | 71.57 ms |

### Interpretation

Top-1 accuracy of 80% means that the correct document
was ranked first for 8 out of 10 questions.

Top-3 accuracy of 90% means that the correct document
appeared within the first three results for 9 out of 10 questions.

Top-5 accuracy of 90% means that the correct document
appeared within the first five results for 9 out of 10 questions.

---

## 6. Offline Operation Test

The embedding model was tested with:

```text
HF_HUB_OFFLINE=1
TRANSFORMERS_OFFLINE=1
