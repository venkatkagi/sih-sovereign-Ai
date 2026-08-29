# VaultMind Sovereign AI: Comprehensive Repository Architecture & System Summary

An air-gapped, multimodal, multi-turn ReAct cognitive intelligence engine and hybrid RAG system powered by local Ollama models (`Qwen3`, `Gemma3`, `Qwen3-VL`), SentenceTransformers embeddings (`all-MiniLM-L6-v2`), PostgreSQL + pgvector storage, offline OCR, sandboxed code execution, and real-time SSE streaming.

---

## 1. Executive Summary & Core Mission

**VaultMind Sovereign AI** is engineered for high-security, air-gapped enterprise environments where data privacy, zero external cloud dependencies, and verifiable compliance are mandatory.

### Key Architectural Pillars:
1. **100% Air-Gapped & On-Premise Execution**: Zero outbound network requests, zero telemetry, zero external cloud dependencies.
2. **Canonical PostgreSQL + pgvector Storage**: Production vector store strictly backed by PostgreSQL 16 with the `pgvector` extension and HNSW indexing. Automatic fallback to Chroma is strictly prohibited.
3. **Dynamic Model Router**: Automatically selects the optimal local LLM based on query complexity analysis, modality detection (text, image, video), and VRAM constraints.
4. **Hybrid BM25 + Dense Retrieval**: Combines keyword search (BM25) with 384-dimensional dense vector embeddings to maximize retrieval recall and precision.
5. **Cognitive ReAct Agent Loop**: Autonomous multi-turn reasoning engine (`User Prompt -> Route Selection -> LLM Inference -> Tool Call Evaluation -> Sandboxed Tool Execution -> Re-Prompt -> Grounded Response with Citations`).
6. **Local Multimodal & OCR Engine**: Extracts text and metadata from PDFs, scanned images, Word documents, Excel spreadsheets, and engineering drawings via PyMuPDF and Tesseract/ONNX offline OCR.
7. **Real-Time Reactive Streaming**: Server-Sent Events (SSE) stream tokens, reasoning steps, tool activations, and citations in real time to the React frontend.

---

## 2. Complete Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           MODULE 1: FRONTEND LAYER                              │
│              React 19 + Vite 8 + Tailwind CSS + Lucide Icons + Motion           │
│              Real-Time SSE Streaming + Workspaces (Chat, OCR, Sheets, Sandbox)   │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ Async REST / SSE Event Streams (:5173 -> :8000)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        MODULE 2: FASTAPI BACKEND LAYER                          │
│               FastAPI (Python 3.11+) + Pydantic v2 + Uvicorn Server             │
│               REST Endpoints: /chat/agent, /documents/upload, /stats, /health    │
└───────────────────┬─────────────────────────────────────────┬───────────────────┘
                    │                                         │
                    ▼                                         ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────────────┐
│       MODULE 3: AI COGNITIVE LAYER    │ │        MODULE 4: SOVEREIGN RAG CORE   │
│ - Ollama Client (Qwen3, Gemma3, VL)   │ │ - Document Loader & Offline OCR       │
│ - Dynamic Model Router & Registry     │ │ - Semantic Chunker & Metadata Parser  │
│ - Multi-Turn ReAct Agent Engine       │ │ - SentenceTransformers (384-d Dense)  │
│ - Sandboxed Tools (Math, Code, Files) │ │ - Hybrid BM25 + Vector Search         │
└───────────────────┬───────────────────┘ └───────────────────┬───────────────────┘
                    │                                         │
                    └────────────────────┬────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        MODULE 5: PERSISTENCE & EXECUTION                        │
│ - Canonical Database: PostgreSQL 16 + pgvector (Table: `document_chunks`)       │
│ - Local LLM Server: Ollama Daemon (`127.0.0.1:11434`)                           │
│ - Isolated Subprocess Sandbox: Python Execution & AST Safe Math Evaluator       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

| Layer | Technology / Library | Purpose / Role |
| :--- | :--- | :--- |
| **Frontend UI** | React 19, Vite 8, Tailwind CSS | High-performance sovereign dark-mode web workspace |
| **Icons & Animation** | Lucide React, Motion | Micro-animations, responsive layout, dynamic status badge |
| **Backend Framework** | FastAPI, Uvicorn, Pydantic v2 | High-throughput asynchronous REST & SSE streaming server |
| **Local LLM Engine** | Ollama API (`127.0.0.1:11434`) | Offline inference for `qwen3:4b`, `qwen3:8b`, `qwen3-vl:4b`, `gemma3:4b`, `gemma3:8b` |
| **Embedding Model** | SentenceTransformers (`all-MiniLM-L6-v2`) | Local 384-dimensional dense vector embeddings |
| **Vector Database** | PostgreSQL 16 + `pgvector` extension | Canonical production vector store with HNSW indexing |
| **Test Vector Store** | ChromaDB (`chromadb`) | Strictly opt-in for isolated unit test fixtures |
| **OCR & Document Ingestion** | PyMuPDF (`fitz`), `pytesseract` / ONNX | Offline text, table, and metadata extraction from PDF, DOCX, XLSX, images |
| **Sandboxed Code Execution** | Python `subprocess` + AST parser | Resource-constrained execution & AST mathematical evaluation |

---

## 3. Directory Structure & File Manifest

```
vault_mid sih/
├── AGENTS.md                          # Cognitive agent architecture & roadmap
├── TECH_STACK.md                      # System architecture, schemas, and air-gap specs
├── REPOSITORY_SUMMARY.md              # Complete system summary (this document)
│
├── frontend/                          # Module 1: React 19 UI Application
│   └── sovereign_ai/
│       ├── src/
│       │   ├── App.jsx                # Main application component & state orchestrator
│       │   ├── main.jsx               # React DOM entry point
│       │   ├── index.css              # Global styles & sovereign theme
│       │   ├── services/
│       │   │   └── api.js             # API client (SSE streaming, uploads, stats, health)
│       │   ├── components/
│       │   │   ├── layout/            # Sidebar & Right Artifact Panel
│       │   │   ├── main/              # BottomChatBar, AgentMessageThread, ThinkingOrb
│       │   │   └── views/             # Workspaces (OcrWorkspace, SheetsWorkspace, SandboxWorkspace)
│       │   └── data/
│       │       └── mockData.js        # Model manifests & mock telemetry
│       ├── package.json               # Frontend dependencies (React 19, Lucide, Tailwind)
│       └── vite.config.js             # Vite config with backend proxy (:5173 -> :8000)
│
├── ai_llms/                           # Module 3: AI Cognitive Engine & Model Router
│   ├── __init__.py                    # Public API exports
│   ├── api.py                         # FastAPI routes (/chat/agent, /documents/upload, /stats, /health)
│   ├── agent_loop.py                  # ReAct Agent Engine (multi-turn reasoning & streaming)
│   ├── router.py                      # Dynamic Model Router (complexity & modality scoring)
│   ├── registry.py                    # Model Registry & metadata catalog
│   ├── model_types.py                 # Data types (ModelConfig, RoutingDecision, etc.)
│   ├── interface.py                   # Standard abstract ModelInterface
│   ├── ollama_client.py               # Async Ollama client with timeout & tool support
│   ├── embedding.py                   # SentenceTransformers embedding pipeline wrapper
│   ├── tools.py                       # Sandboxed Tools Catalog (search, calculate, sandbox, report)
│   ├── test_agent_loop.py             # Unit tests for ReAct agent loop
│   ├── test_api.py                    # Unit tests for FastAPI REST endpoints
│   ├── test_embedding.py              # Unit tests for embedding pipeline
│   ├── test_model.py                  # Unit tests for Ollama client
│   ├── test_registry_router.py        # Unit tests for router & registry
│   └── test_tools.py                  # Unit tests for tools catalog & sandbox
│
├── app/                               # Module 4: Sovereign RAG Core Pipeline
│   ├── __init__.py
│   ├── config.py                      # RAG configuration & database credentials
│   ├── chunking/
│   │   └── chunker.py                 # Recursive semantic text chunker with overlap
│   ├── embeddings/
│   │   └── model.py                   # Sovereign RAG embedding interface
│   ├── generation/
│   │   ├── gemini.py                  # Legacy generation interface
│   │   └── ollama_gen.py              # Grounded generation wrapper using local Ollama
│   ├── ingestion/
│   │   └── loader.py                  # Document loader (PDF, DOCX, TXT, OCR fallback)
│   ├── interfaces/
│   │   ├── embedding.py               # Abstract BaseEmbedding
│   │   ├── generator.py               # Abstract BaseGenerator
│   │   └── vector_store.py            # Abstract BaseVectorStore
│   ├── metadata/
│   │   └── parser.py                  # Regex & heuristic document metadata extractor
│   ├── ocr/
│   │   └── tesseract.py               # Offline Tesseract/ONNX image & scanned PDF OCR
│   ├── rag/
│   │   ├── indexer.py                 # Document indexing orchestrator
│   │   ├── pipeline.py                # Hybrid retrieval + grounded generation pipeline
│   │   └── service.py                 # High-level RAG service singleton & proxy
│   ├── retrieval/
│   │   ├── hybrid.py                  # BM25 + dense vector rank fusion retriever
│   │   └── search.py                  # Vector search interface
│   └── vectorstore/
│       ├── store.py                   # Strict VectorStore factory (PostgreSQL enforcement)
│       ├── pgvector_store.py          # PostgreSQL + pgvector implementation (HNSW index)
│       └── chroma.py                  # Isolated Chroma store for test fixtures
│
├── data/
│   ├── benchmark/                     # Benchmark datasets and evaluation scripts
│   ├── scaling/                       # Dataset scaling & performance test scripts
│   └── test_documents/                # Verified test PDFs & scanned OCR samples
│
└── tests/                             # Sovereign RAG Integration Test Suite
    ├── test_core.py                   # Core pipeline & chunking tests
    ├── test_end_to_end_integration.py # Ingestion, hybrid retrieval & generation tests
    ├── test_ollama_generator.py       # Grounded Ollama generation tests
    ├── test_pgvector_integration.py   # PostgreSQL + pgvector strict enforcement tests
    ├── test_provider_injection.py     # Custom provider injection tests
    └── test_source_isolation.py       # Multi-tenant document isolation tests
```

---

## 4. Deep-Dive: Core Subsystems & Logic

### A. Dynamic Model Router (`ai_llms/router.py`)
Routes queries without hardcoded business rules by analyzing:
1. **Modalities**: Detects media attachments (`image`, `video`, `audio`). If images are present, routes to vision-capable models (`qwen3-vl:4b` or `gemma3:8b`).
2. **Complexity Scoring**: Computes a score `[0.0, 1.0]` based on:
   - Input length and multi-sentence structural depth
   - Analytical, mathematical, or multi-document comparison keywords
   - Explicit overrides passed by the user/session
3. **VRAM Safety**: Ensures models fit within allocated host memory budgets.

| Model ID | Ollama Tag | Modalities | Tool Calling | Reasoning | Max Complexity | VRAM |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `qwen3-4b` | `qwen3:4b` | Text | Yes | Yes | Low / Medium | ~3.2 GB |
| `qwen3-8b` | `qwen3:8b` | Text | Yes | Yes | High | ~5.8 GB |
| `qwen3-vl-4b` | `qwen3-vl:4b` | Text, Image, Video | Yes | Yes | Medium | ~4.5 GB |
| `gemma3-4b` | `gemma3:4b` | Text, Image | Yes | Yes | Medium | ~3.8 GB |
| `gemma3-8b` | `gemma3:8b` | Text, Image | Yes | Yes | High | ~6.2 GB |

---

### B. Canonical PostgreSQL + pgvector Vector Store (`app/vectorstore/`)
- **Strict Production Enforcement**: Production defaults strictly to `PgVectorStore`. If PostgreSQL is unreachable or `pgvector` is missing, `VectorStore` raises a fatal `RuntimeError`. Automatic fallback to Chroma is strictly prohibited.
- **Table Schema**:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;

  CREATE TABLE IF NOT EXISTS document_chunks (
      id VARCHAR(255) PRIMARY KEY,
      text TEXT NOT NULL,
      metadata JSONB NOT NULL,
      embedding vector(384) NOT NULL
  );

  CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx 
  ON document_chunks USING hnsw (embedding vector_cosine_ops);
  ```
- **Source Isolation & Metadata Lookups**: Performs fast metadata filtering using PostgreSQL's GIN/JSONB index operations.

---

### C. Cognitive ReAct Agent Loop (`ai_llms/agent_loop.py`)
Executes an iterative, multi-turn reasoning loop:
```
User Prompt -> Model Selection -> LLM Inference
      │
      ├─► Tool Call Requested? ──► Execute Tool ──► Append Result ──► Re-Prompt LLM
      │                                                                    │
      └─► Final Answer? ◄──────────────────────────────────────────────────┘
            │
            ▼
   Grounded Markdown Response + Deduplicated Document Citations
```

#### Tools & Skills Catalog:
1. `search_documents`: Performs vector similarity and metadata-filtered search in PostgreSQL.
2. `get_document_page`: Retrieves full extracted text for a specific document and page.
3. `calculate_expression`: Evaluates mathematical expressions safely using an AST whitelist (no `eval()` vulnerability).
4. `run_python_sandbox`: Runs Python scripts in an isolated subprocess with memory and execution timeouts.
5. `generate_report_file`: Drafts downloadable markdown/PDF analysis artifacts.

---

### D. Document Ingestion & Hybrid Retrieval Pipeline (`app/`)
1. **Loading**: Reads files (PDF, DOCX, XLSX, TXT). If a page has no digital text, automatically runs local Tesseract/ONNX OCR.
2. **Metadata Extraction**: Identifies Document IDs, Equipment Tags, Plant Locations, and Revision Numbers.
3. **Semantic Chunking**: Splits text into 500-token chunks with 50-token overlapping windows.
4. **Vector Embedding**: Generates 384-dimensional dense vectors using `SentenceTransformer("all-MiniLM-L6-v2")`.
5. **Hybrid Search**: Fuses dense semantic vector scores with sparse BM25 keyword matching for optimal recall.

---

## 5. Verification & Test Suite Summary

The repository includes comprehensive unit and integration test suites:

### 1. Sovereign RAG Test Suite (`tests/`)
```bash
PYTHONPATH=. ./venv/bin/python -m unittest discover -s tests -v
```
- `test_core.py`: Chunking, metadata extraction, scanned PDF OCR fallback.
- `test_end_to_end_integration.py`: Ingestion, hybrid retrieval, insufficient info fallback.
- `test_ollama_generator.py`: Grounded generation with local Ollama models.
- `test_pgvector_integration.py`: PostgreSQL initialization, strict refusal of Chroma fallback, test overrides.
- `test_provider_injection.py`: Custom generator and embedding provider injection.
- `test_source_isolation.py`: Multi-tenant document retrieval isolation.
- **Result: 16 / 16 Tests Passed (100%)**

### 2. VaultMind Cognitive AI Test Suite (`ai_llms/`)
```bash
VECTOR_STORE_BACKEND=chroma PYTHONPATH=. ./venv/bin/python -m unittest discover -s ai_llms -v
```
- `test_agent_loop.py`: Multi-turn ReAct reasoning, citation extraction, SSE streaming events.
- `test_api.py`: FastAPI endpoints (`/chat/agent`, `/documents/upload`, `/stats`, `/health`, `/calculator`, `/sandbox/execute`).
- `test_embedding.py`: 384-d vector dimension, batch embedding, cosine similarity.
- `test_registry_router.py`: Complexity scoring, modality routing, VRAM safety.
- `test_tools.py`: AST math safety, Python sandbox timeouts, network blocking, tool execution.
- **Result: 35 / 35 Tests Passed (100%)**

---

## 6. How to Run the Application Locally

### 1. Start PostgreSQL with pgvector (Podman / Docker)
```bash
podman run -d --name local_postgres_rag \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=local_rag_db \
  -p 5432:5432 \
  docker.io/pgvector/pgvector:pg16
```

### 2. Start the FastAPI Backend Server
```bash
cd "/home/venkatkagitha/Desktop/projectx/vault_mid sih"
./venv/bin/python -m uvicorn ai_llms.api:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Start the React Frontend Server
```bash
cd "/home/venkatkagitha/Desktop/projectx/vault_mid sih/frontend/sovereign_ai"
npm run dev
```

### 4. Access the Live Application
- **Frontend UI**: `http://localhost:5173`
- **Backend Swagger Docs**: `http://127.0.0.1:8000/docs`
- **Health Endpoint**: `http://127.0.0.1:8000/api/v1/health`
