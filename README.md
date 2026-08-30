# Sovereign AI Workbench (VaultMind)

Air-gapped, multimodal Retrieval-Augmented Generation (RAG) system with dynamic local LLM routing, autonomous ReAct agent execution, and secure workspace tools.

## System Architecture

The repository is organized into four core directories:

```
├── frontend/             # React (Vite) user interface
├── backend/              # Python FastAPI backend, AI cognitive engine, RAG pipeline
├── data/                 # Benchmark data, scaling tests, sample test documents
└── workspace/            # Controlled execution workspace for file artifacts and sandbox runs
```

### 1. Frontend (`frontend/`)
- Framework: React 19, Vite, Tailwind CSS, Lucide React, Motion.
- Views: AutoRouteView, DocumentAgentView, CodingAgentView, MultimodalView, TaskHubView, OcrWorkspace, SandboxWorkspace, SheetsWorkspace.
- Services: Unified API client communicating with backend endpoints via REST and Server-Sent Events (SSE).

### 2. Backend (`backend/`)
- `backend/main.py`: Application entry point and server startup.
- `backend/config.py`: Environment and directory path configuration.
- `backend/api/`: FastAPI route handlers and request/response models.
- `backend/ai/`: Cognitive engine comprising model registry, dynamic router, ReAct agent loop, tool execution engine, and workflow streams.
- `backend/rag/`: Retrieval-augmented generation service, indexer, and query pipeline.
- `backend/retrieval/`: Hybrid retrieval combining dense vector search and BM25 with Reciprocal Rank Fusion (RRF).
- `backend/embeddings/`: Local embedding model wrapper using SentenceTransformers (384-d).
- `backend/vectorstore/`: Vector storage implementations for PostgreSQL + pgvector (production) and Chroma (test mode).
- `backend/ingestion/`: Document loaders for PDF, DOCX, XLSX, TXT, and scanned images.
- `backend/ocr/`: Local OCR processing using Tesseract.
- `backend/chunking/`: Recursive token and character chunking.
- `backend/metadata/`: Metadata extraction and document tagging.
- `backend/tests/`: Unified unit and integration test suite.

### 3. Data (`data/`)
- `data/benchmark/`: Retrieval accuracy and hybrid search evaluation benchmarks.
- `data/scaling/`: Scaling tests for document indexing and retrieval volume.
- `data/test_documents/`: Standard test documents for OCR, parsing, and RAG verification.
- `data/uploads/`: Ingested documents.
- `data/processed/`: Extracted text and intermediate artifacts.

### 4. Workspace (`workspace/`)
- `workspace/documents/`: Source documents for analysis and approval workflows.
- `workspace/input/`: Uploaded raw user inputs and data files.
- `workspace/projects/`: Specifications, markdown files, and code projects.
- `workspace/output/`: Generated artifacts (PDFs, Word documents, Excel spreadsheets).
- `workspace/sandbox/`: Isolated task execution folders for Python sandbox runs.

## Setup and Execution

### Backend

1. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the backend server:
   ```bash
   python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```

4. Run tests:
   ```bash
   VECTOR_STORE_BACKEND=chroma PYTHONPATH=. python -m unittest discover -s backend/tests -v
   ```

### Frontend

1.Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build production bundle:
   ```bash
   npm run build
   ```
