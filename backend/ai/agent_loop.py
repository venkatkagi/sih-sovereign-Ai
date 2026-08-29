import asyncio
import json
import logging
import time
import uuid
from collections.abc import AsyncIterator
from dataclasses import asdict, dataclass, field
from typing import Any, Optional, Union

from .model_types import ComplexityType, ModelConfig
from .registry import ModelRegistry, model_registry
from .router import DynamicRouter, RoutingDecision, model_router
from .tools import ToolRegistry, resolve_workspace_file_path, tool_registry

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_PROMPT = """You are VaultMind Sovereign AI, an air-gapped intelligent cognitive assistant and analyst.
You operate 100% locally and offline on this workstation with access to local tools, the workspace filesystem, and an indexed PostgreSQL/pgvector database.

### TOOL INVOCATION RULES:
1. When asked to check, explore, list, or find files/data in the workspace:
   - YOU MUST CALL `list_workspace_files(subdir=...)` or `search_workspace_files(query=...)`.
2. When asked to inspect, read, or query the content/data of an uploaded or workspace document/spreadsheet:
   - YOU MUST CALL `read_workspace_document(file_path=...)`.
3. When asked to create, export, or generate a PDF report or document:
   - YOU MUST CALL `create_pdf_document(title=..., content=...)` or `generate_report_file`.
   - Pass complete content formatted with markdown headings, bullet points, and tables.
4. When asked to edit, annotate, or watermark an existing PDF:
   - YOU MUST CALL `edit_pdf_document(file_path=..., watermark_text=..., header_text=..., footer_text=..., append_text=...)`.
5. When asked to create or build a spreadsheet or Excel file (.xlsx):
   - YOU MUST CALL `create_excel_spreadsheet(title=..., headers=[...], rows=[...])`.
6. When asked to edit or update an Excel spreadsheet:
   - YOU MUST CALL `edit_excel_spreadsheet(file_path=..., cell_updates=..., append_rows=...)`.
7. When asked to save a Markdown or documentation file:
   - YOU MUST CALL `create_markdown_document(title=..., content=...)`.
8. When asked to recall previous chats, past queries, earlier conversations, or facts in the database:
   - YOU MUST CALL `search_documents(query=...)`. All past conversation history and indexed files are stored and searchable via this tool!
9. For data analysis, simulations, or Python scripting, execute code using `run_python_sandbox(code=...)`.
10. For arithmetic or formulas, use `calculate_expression(expression=...)`.

Always execute the appropriate tool rather than just describing it in plain text.
"""


@dataclass
class AgentCitation:
    """Citation metadata identifying source document and page reference."""
    document_id: str
    document_name: str
    page_number: int
    similarity_score: float = 0.0
    snippet: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "document_id": self.document_id,
            "document_name": self.document_name,
            "page_number": self.page_number,
            "similarity_score": self.similarity_score,
            "snippet": self.snippet,
        }


@dataclass
class ToolExecutionRecord:
    """Record of a tool call executed during the ReAct loop."""
    tool_name: str
    arguments: dict[str, Any]
    result: Any
    duration_seconds: float = 0.0
    turn_index: int = 0


@dataclass
class AgentResponse:
    """Final structured response from the agent loop engine."""
    conversation_id: str
    content: str
    sender: str = "assistant"
    model_used: str = ""
    citations: list[dict[str, Any]] = field(default_factory=list)
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    routing_decision: Optional[dict[str, Any]] = None
    execution_time_seconds: float = 0.0
    turns_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "conversation_id": self.conversation_id,
            "sender": self.sender,
            "model_used": self.model_used,
            "content": self.content,
            "citations": self.citations,
            "tool_calls": self.tool_calls,
            "routing_decision": self.routing_decision,
            "execution_time_seconds": self.execution_time_seconds,
            "turns_count": self.turns_count,
        }


class ReActAgentEngine:
    """
    Cognitive Agent Engine executing the multi-turn ReAct reasoning loop:
    User Prompt -> Dynamic Route -> LLM Inference -> Tool Call Evaluation -> Tool Execution -> Re-Prompt -> Final Response.
    """

    def __init__(
        self,
        router: Optional[DynamicRouter] = None,
        registry: Optional[ModelRegistry] = None,
        tools: Optional[ToolRegistry] = None,
        default_system_prompt: str = DEFAULT_SYSTEM_PROMPT,
    ):
        self.router = router or model_router
        self.registry = registry or model_registry
        self.tools = tools or tool_registry
        self.system_prompt = default_system_prompt
        self._conversations: dict[str, list[dict[str, Any]]] = {}

    def _build_initial_messages(
        self,
        message: str,
        media_paths: Optional[list[str]] = None,
        history: Optional[list[dict[str, Any]]] = None,
        system_prompt_override: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Construct prompt context with system instructions and user message."""
        messages: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": system_prompt_override or self.system_prompt,
            }
        ]

        if history:
            for h in history:
                role = h.get("role", "user")
                content = h.get("content") or h.get("text", "")
                if content and role in ("user", "assistant"):
                    messages.append({"role": role, "content": str(content)})

        user_msg: dict[str, Any] = {
            "role": "user",
            "content": message,
        }

        # If document or image attachments are present, enrich context
        if media_paths:
            doc_context_blocks = []
            valid_images = []

            for p in media_paths:
                clean_name = p.split("/")[-1]
                is_img = p.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"))

                if is_img:
                    resolved_img = resolve_workspace_file_path(p)
                    if resolved_img and resolved_img.exists():
                        valid_images.append(str(resolved_img.resolve()))
                    elif os.path.exists(p):
                        valid_images.append(os.path.abspath(p))
                    doc_context_blocks.append(f"[ATTACHED IMAGE: {clean_name} (Inspected visually)]")
                else:
                    read_res = self.tools.execute("read_workspace_document", {"file_path": p, "max_chars": 6000})
                    if read_res.get("success") and read_res.get("content"):
                        doc_context_blocks.append(
                            f"--- ATTACHED FILE: {clean_name} (Path: {read_res.get('path', p)}) ---\n"
                            f"{read_res['content']}\n"
                            f"--- END OF ATTACHED FILE ---"
                        )
                    else:
                        doc_context_blocks.append(f"[ATTACHED FILE REFERENCE: {clean_name} (Path: {p})]")

            if doc_context_blocks:
                user_msg["content"] = (
                    f"{chr(10).join(doc_context_blocks)}\n\n"
                    f"User Request: {user_msg['content']}"
                )

            if valid_images:
                user_msg["images"] = valid_images

        messages.append(user_msg)
        return messages

    def _extract_citations(
        self,
        tool_name: str,
        result: Any,
        accumulated_citations: list[dict[str, Any]],
    ) -> None:
        """Extract and de-duplicate citations from document retrieval tools."""
        if tool_name == "search_documents" and isinstance(result, dict):
            docs = result.get("documents", [])
            for doc in docs:
                citation = {
                    "document_id": doc.get("document_id", ""),
                    "document_name": doc.get("document_title", "Document"),
                    "page_number": doc.get("page_number", 1),
                    "similarity_score": doc.get("similarity_score", 0.0),
                    "content": doc.get("content", "")[:160],
                }
                # Check duplication
                key = (citation["document_id"], citation["page_number"])
                existing_keys = {
                    (c.get("document_id"), c.get("page_number"))
                    for c in accumulated_citations
                }
                if key not in existing_keys:
                    accumulated_citations.append(citation)

        elif tool_name == "get_document_page" and isinstance(result, dict) and result.get("success"):
            citation = {
                "document_id": result.get("document_id", ""),
                "document_name": result.get("document_title", "Document"),
                "page_number": result.get("page_number", 1),
                "similarity_score": 1.0,
                "content": result.get("content", "")[:160],
            }
            key = (citation["document_id"], citation["page_number"])
            existing_keys = {
                (c.get("document_id"), c.get("page_number"))
                for c in accumulated_citations
            }
            if key not in existing_keys:
                accumulated_citations.append(citation)

    async def run(
        self,
        message: str,
        conversation_id: Optional[str] = None,
        media_paths: Optional[list[str]] = None,
        history: Optional[list[dict[str, Any]]] = None,
        max_turns: int = 10,
        model_override: Optional[str] = None,
        complexity_override: Optional[ComplexityType] = None,
        max_vram_gb: Optional[float] = None,
        system_prompt: Optional[str] = None,
    ) -> AgentResponse:
        """
        Execute full ReAct reasoning loop asynchronously.
        """
        start_time = time.time()
        conv_id = conversation_id or str(uuid.uuid4())

        # Step 1: Model Routing
        if model_override:
            config = self.registry.get_or_raise(model_override)
            decision = RoutingDecision(
                model_config=config,
                complexity=complexity_override or "medium",
                complexity_score=0.5,
                modalities=self.router.detect_modalities(media_paths),
                reason=f"Explicit model override: {model_override}",
            )
        else:
            decision = self.router.route_with_decision(
                query=message,
                media_paths=media_paths,
                complexity_override=complexity_override,
                max_vram_gb=max_vram_gb,
            )

        conv_history = history if history is not None else self._conversations.get(conv_id, [])
        model_client = self.registry.create_instance(decision.model_name)
        tool_schemas = self.tools.get_ollama_tools()

        # Step 2: Context Initialization
        messages = self._build_initial_messages(
            message=message,
            media_paths=media_paths,
            history=conv_history,
            system_prompt_override=system_prompt,
        )

        accumulated_citations: list[dict[str, Any]] = []
        executed_tool_records: list[dict[str, Any]] = []
        final_content = ""
        turns = 0

        # Step 3: ReAct Iteration Loop
        for turn in range(max_turns):
            turns += 1
            logger.info(
                f"[Turn {turn + 1}/{max_turns}] Invoking {decision.model_config.ollama_model} with {len(messages)} messages"
            )

            # Query Model
            response_msg = await model_client.chat(
                messages=messages,
                tools=tool_schemas,
            )

            tool_calls = response_msg.get("tool_calls", [])
            content = response_msg.get("content", "")

            # If no tool calls requested, model decided to reply directly
            if not tool_calls:
                final_content = content
                break

            # Model requested tool calling
            messages.append(response_msg)

            for call in tool_calls:
                fn = call.get("function", {})
                tool_name = fn.get("name", "")
                raw_args = fn.get("arguments", {})

                # Ensure arguments are parsed as dict
                if isinstance(raw_args, str):
                    try:
                        args = json.loads(raw_args)
                    except Exception:
                        args = {"query": raw_args}
                else:
                    args = raw_args or {}

                tool_start_t = time.time()
                tool_res = await self.tools.aexecute(tool_name, args)
                tool_duration = time.time() - tool_start_t

                # Extract citations
                self._extract_citations(tool_name, tool_res, accumulated_citations)

                record = {
                    "turn": turn + 1,
                    "tool": tool_name,
                    "arguments": args,
                    "result": tool_res,
                    "duration_seconds": round(tool_duration, 3),
                }
                executed_tool_records.append(record)

                # Append tool output to context as role: tool
                messages.append({
                    "role": "tool",
                    "name": tool_name,
                    "content": json.dumps(tool_res, ensure_ascii=False),
                })

        # Ensure file generation artifact if explicitly requested by user
        msg_lower = message.lower()
        has_pdf_tool = any(t.get("tool") in ("create_pdf_document", "generate_report_file") for t in executed_tool_records)
        if ("pdf" in msg_lower and any(kw in msg_lower for kw in ("create", "generate", "make", "draft", "export", "write"))) and not has_pdf_tool and final_content:
            try:
                title = message.split("pdf of")[-1].strip(" '\".,") if "pdf of" in msg_lower else "Generated Document"
                if len(title) > 40:
                    title = "Generated Report"
                pdf_res = self.tools.execute("create_pdf_document", {
                    "title": title.title(),
                    "content": final_content,
                })
                executed_tool_records.append({
                    "turn": turns,
                    "tool": "create_pdf_document",
                    "arguments": {"title": title.title()},
                    "result": pdf_res,
                    "duration_seconds": 0.1,
                })
            except Exception as pdf_err:
                logger.warning(f"Auto PDF generation fallback: {pdf_err}")

        duration = round(time.time() - start_time, 3)

        # Persist conversation memory
        if conv_id not in self._conversations:
            self._conversations[conv_id] = []
        self._conversations[conv_id].append({"role": "user", "content": message})
        if final_content:
            self._conversations[conv_id].append({"role": "assistant", "content": final_content})

        # Auto-index conversation turn into pgvector / RAG for cross-session recall
        try:
            from backend.rag.service import get_rag_service
            rag = get_rag_service()
            rag.index_chat_turn(
                conversation_id=conv_id,
                user_text=message,
                assistant_text=final_content,
            )
        except Exception as rag_err:
            logger.warning(f"Chat RAG indexing notice: {rag_err}")

        return AgentResponse(
            conversation_id=conv_id,
            content=final_content,
            sender="assistant",
            model_used=decision.model_config.ollama_model,
            citations=accumulated_citations,
            tool_calls=executed_tool_records,
            routing_decision={
                "model_name": decision.model_name,
                "ollama_model": decision.ollama_model,
                "complexity": decision.complexity,
                "complexity_score": decision.complexity_score,
                "reason": decision.reason,
            },
            execution_time_seconds=duration,
            turns_count=turns,
        )

    async def stream_run(
        self,
        message: str,
        conversation_id: Optional[str] = None,
        media_paths: Optional[list[str]] = None,
        history: Optional[list[dict[str, Any]]] = None,
        max_turns: int = 10,
        model_override: Optional[str] = None,
        complexity_override: Optional[ComplexityType] = None,
        max_vram_gb: Optional[float] = None,
        system_prompt: Optional[str] = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """
        Stream ReAct agent execution steps and tokens in real time (for SSE endpoints).
        """
        start_time = time.time()
        conv_id = conversation_id or str(uuid.uuid4())

        # Step 1: Route Selection
        if model_override:
            config = self.registry.get_or_raise(model_override)
            decision = RoutingDecision(
                model_config=config,
                complexity=complexity_override or "medium",
                complexity_score=0.5,
                modalities=self.router.detect_modalities(media_paths),
                reason=f"Explicit model override: {model_override}",
            )
        else:
            decision = self.router.route_with_decision(
                query=message,
                media_paths=media_paths,
                complexity_override=complexity_override,
                max_vram_gb=max_vram_gb,
            )

        yield {
            "event": "route",
            "data": {
                "conversation_id": conv_id,
                "model": decision.model_config.ollama_model,
                "complexity": decision.complexity,
                "reason": decision.reason,
            },
        }

        conv_history = history if history is not None else self._conversations.get(conv_id, [])
        model_client = self.registry.create_instance(decision.model_name)
        tool_schemas = self.tools.get_ollama_tools()

        messages = self._build_initial_messages(
            message=message,
            media_paths=media_paths,
            history=conv_history,
            system_prompt_override=system_prompt,
        )

        accumulated_citations: list[dict[str, Any]] = []
        executed_tool_records: list[dict[str, Any]] = []
        final_content = ""
        turns = 0

        for turn in range(max_turns):
            turns += 1

            accumulated_content = ""
            accumulated_thinking = ""
            accumulated_tool_calls = []

            # Stream chunks from local model in real-time
            if hasattr(model_client, "stream_chunks"):
                async for chunk in model_client.stream_chunks(
                    messages=messages,
                    tools=tool_schemas,
                ):
                    thinking_piece = chunk.get("thinking", "")
                    content_piece = chunk.get("content", "")
                    t_calls = chunk.get("tool_calls", [])

                    if thinking_piece:
                        accumulated_thinking += thinking_piece
                        yield {
                            "event": "thinking",
                            "data": {"chunk": thinking_piece, "thinking": accumulated_thinking},
                        }

                    if content_piece:
                        accumulated_content += content_piece
                        yield {
                            "event": "token",
                            "data": {"chunk": content_piece, "content": accumulated_content},
                        }

                    if t_calls:
                        accumulated_tool_calls.extend(t_calls)

                tool_calls = accumulated_tool_calls
                content = accumulated_content
                response_msg = {
                    "role": "assistant",
                    "content": content,
                    "tool_calls": tool_calls,
                }
            else:
                response_msg = await model_client.chat(
                    messages=messages,
                    tools=tool_schemas,
                )
                tool_calls = response_msg.get("tool_calls", [])
                content = response_msg.get("content", "")
                if not tool_calls:
                    final_content = content
                    for i in range(0, len(content), 24):
                        yield {"event": "token", "data": {"chunk": content[i : i + 24]}}
                        await asyncio.sleep(0.01)
                    break

            if not tool_calls:
                final_content = content
                break

            messages.append(response_msg)

            for call in tool_calls:
                fn = call.get("function", {})
                tool_name = fn.get("name", "")
                raw_args = fn.get("arguments", {})

                if isinstance(raw_args, str):
                    try:
                        args = json.loads(raw_args)
                    except Exception:
                        args = {"query": raw_args}
                else:
                    args = raw_args or {}

                yield {
                    "event": "tool_start",
                    "data": {
                        "turn": turn + 1,
                        "tool": tool_name,
                        "arguments": args,
                    },
                }

                tool_start_t = time.time()
                tool_res = await self.tools.aexecute(tool_name, args)
                tool_duration = time.time() - tool_start_t

                self._extract_citations(tool_name, tool_res, accumulated_citations)

                record = {
                    "turn": turn + 1,
                    "tool": tool_name,
                    "arguments": args,
                    "result": tool_res,
                    "duration_seconds": round(tool_duration, 3),
                }
                executed_tool_records.append(record)

                yield {
                    "event": "tool_end",
                    "data": {
                        "turn": turn + 1,
                        "tool": tool_name,
                        "result": tool_res,
                        "duration_seconds": round(tool_duration, 3),
                        "citations": accumulated_citations,
                    },
                }

                messages.append({
                    "role": "tool",
                    "name": tool_name,
                    "content": json.dumps(tool_res, ensure_ascii=False),
                })

        # Ensure file generation artifact if explicitly requested by user
        msg_lower = message.lower()
        has_pdf_tool = any(t.get("tool") in ("create_pdf_document", "generate_report_file") for t in executed_tool_records)
        if ("pdf" in msg_lower and any(kw in msg_lower for kw in ("create", "generate", "make", "draft", "export", "write"))) and not has_pdf_tool and final_content:
            try:
                title = message.split("pdf of")[-1].strip(" '\".,") if "pdf of" in msg_lower else "Generated Document"
                if len(title) > 40:
                    title = "Generated Report"
                pdf_res = self.tools.execute("create_pdf_document", {
                    "title": title.title(),
                    "content": final_content,
                })
                executed_tool_records.append({
                    "turn": turns,
                    "tool": "create_pdf_document",
                    "arguments": {"title": title.title()},
                    "result": pdf_res,
                    "duration_seconds": 0.1,
                })
            except Exception as pdf_err:
                logger.warning(f"Auto PDF generation fallback in stream: {pdf_err}")

        duration = round(time.time() - start_time, 3)

        # Persist conversation memory
        if conv_id not in self._conversations:
            self._conversations[conv_id] = []
        self._conversations[conv_id].append({"role": "user", "content": message})
        if final_content:
            self._conversations[conv_id].append({"role": "assistant", "content": final_content})

        # Auto-index conversation turn into pgvector / RAG for cross-session recall
        try:
            from backend.rag.service import get_rag_service
            rag = get_rag_service()
            rag.index_chat_turn(
                conversation_id=conv_id,
                user_text=message,
                assistant_text=final_content,
            )
        except Exception as rag_err:
            logger.warning(f"Chat RAG indexing notice in stream: {rag_err}")

        yield {
            "event": "done",
            "data": {
                "conversation_id": conv_id,
                "sender": "assistant",
                "model_used": decision.model_config.ollama_model,
                "content": final_content,
                "citations": accumulated_citations,
                "tool_calls": executed_tool_records,
                "execution_time_seconds": duration,
                "turns_count": turns,
            },
        }



# Global default agent loop engine instance
react_agent_engine = ReActAgentEngine()

