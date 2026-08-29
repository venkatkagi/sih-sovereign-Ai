# AGENTS.md: Agents, Tasks, Skills & Routing Architecture

This document defines the agent architecture, task distribution, tool skills, and dynamic model routing logic for **Module 3 (LLM & Embedding Pipeline)** in our air-gapped, multimodal RAG application.

---

## 1. Module  Core Responsibilities

Module 3 is the cognitive engine connecting local Ollama models (Qwen3, Gemma3, Qwen3-VL), embedding models, vector search, and agentic workflows.

### Primary Objectives
- **Unified Model Interface**: Provide a standard client interface for Qwen and Gemma models via local Ollama API.
- **Model Capabilities Registry**: Maintain metadata on model modalities, VRAM usage, complexity limits, and tool-calling support.
- **Dynamic Router**: Select the optimal LLM based on task complexity, query type, and input modalities (text, image, video).
- **Tool & Skill Engine**: Expose local capabilities (RAG vector search, page reading, calculations, sandboxed execution) to agents.
- **Agentic ReAct Loop**: Execute multi-turn reasoning loops: `Prompt -> Model -> Tool Call -> Tool Result -> Final Response`.
- **Air-Gap Compliance**: Operate 100% offline without external cloud API calls.

---

## 2. Model Registry Overview

| Model ID | Ollama Tag | Modalities | Tool Calling | Reasoning | Max Complexity | Target VRAM |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `qwen3-4b` | `qwen3:4b` | Text | Yes | Yes | Medium | ~3.2 GB |
| `qwen3-8b` | `qwen3:8b` | Text | Yes | Yes | High | ~5.8 GB |
| `qwen3-vl-4b` | `qwen3-vl:4b` | Text, Image, Video | Yes | Yes | Medium | ~4.5 GB |
| `gemma3-4b` | `gemma3:4b` | Text, Image | Yes | Yes | Medium | ~3.8 GB |
| `gemma3-8b` | `gemma3:8b` | Text, Image | Yes | Yes | High | ~6.2 GB |

---

## 3. Dynamic Router Logic

The router dynamically selects models without hardcoded conditionals in business logic.

### Routing Rules
1. **Multimodal Inputs** (Images/Video attached):
   - High complexity $\rightarrow$ `gemma3-8b`
   - Medium/Low complexity $\rightarrow$ `qwen3-vl-4b`
2. **Text-Only Inputs**:
   - High complexity (cross-document analysis, complex reasoning, auditing) $\rightarrow$ `qwen3-8b`
   - Standard complexity (single lookup, basic synthesis) $\rightarrow$ `qwen3-4b`

---

## 4. Agent Tools & Skills Catalog

| Tool Name | Parameters | Purpose | Required Skill |
| :--- | :--- | :--- | :--- |
| `search_documents` | `query: str`, `top_k: int`, `department: str` | Vector similarity search in pgvector database | Information Retrieval |
| `get_document_page` | `doc_id: str`, `page_number: int` | Retrieve raw text/markdown for a specific document page | Precision Reading |
| `calculate_expression` | `expression: str` | Safely evaluate mathematical expressions | Quantitative Calculation |
| `run_python_sandbox` | `code: str` | Run isolated Python code for data analysis | Code Execution |
| `generate_report_file` | `doc_type: str`, `title: str`, `content: str` | Generate downloadable Word/PDF artifacts | Artifact Drafting |

---

## 5. Agent ReAct Execution Flow

1. **User Query**: User submits prompt (with optional document/media attachments).
2. **Route Selection**: Router selects model tag based on modality and complexity scoring.
3. **LLM Inference**: Unified model interface sends prompt + system message + tool definitions to Ollama.
4. **Tool Evaluation**: If model requests a tool call:
   - Execute local function safely.
   - Append tool output to context as `role: tool`.
   - Re-prompt model until completion.
5. **Final Response**: Return final structured markdown response with citations.

---

## 6. Development Roadmap & Task Allocations

- [x] **Task 1: Common Model Interface** (`llm_interface.py`) - Standardized API wrapper for Ollama models supporting text streaming, chat history, and tool calls.
- [x] **Task 2: Model Registry & Router** (`registry.py`, `router.py`) - Metadata store and automated model selector based on query analysis.
- [x] **Task 3: Embedding Pipeline** (`embedding.py`) - SentenceTransformers integration for generating 384-d vectors.
- [x] **Task 4: Tool Definitions & Sandbox Integration** (`tools.py`) - Function schemas and sandbox integration.
- [x] **Task 5: ReAct Agent Loop Engine** (`agent_loop.py`) - Multi-turn tool execution loop.

- [x] **Task 6: FastAPI Integration** (`/api/v1/chat/agent`) - Async REST endpoint for frontend connection.
