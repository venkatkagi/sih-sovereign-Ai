import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Send, 
  Sparkles, 
  Download, 
  Cpu, 
  RefreshCw,
  Folder,
  CheckCircle2,
  Search
} from 'lucide-react';
import { runDocumentApprovalWorkflow, runDocumentQAWorkflow, sendAgentMessage } from '../../services/api';
import AgentMessageThread from '../main/AgentMessageThread';
import BottomChatBar from '../main/BottomChatBar';

const QUICK_DOCUMENT_PROMPTS = [
  {
    title: 'Candidate Name & College',
    prompt: 'What is the candidate full name, rank, and allotted college in this document?',
  },
  {
    title: 'Summarize Attached Document',
    prompt: 'Summarize the key information, sections, and instructions in this document.',
  },
  {
    title: 'Formal Approval Note (.docx)',
    prompt: 'Analyze this inspection report and create a formal engineering approval memorandum in Word (.docx) format.',
  },
];

export default function DocumentAgentView({ selectedFile }) {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState({ id: 'qwen3-4b', name: 'qwen3:4b (Fast Text & RAG)', vram: '~3.2 GB' });
  const abortControllerRef = useRef(null);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setMessages((prev) => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
        const curr = updated[lastIdx];
        updated[lastIdx] = {
          ...curr,
          text: (curr.text ? curr.text + '\n\n' : '') + '⚠️ *[Execution stopped midway by user]*',
          isCreating: false,
        };
      }
      return updated;
    });
  };

  useEffect(() => {
    if (selectedFile?.path && (selectedFile.extension === 'pdf' || selectedFile.extension === 'docx')) {
      setAttachedFiles([
        {
          name: selectedFile.name,
          path: selectedFile.path,
          size_formatted: selectedFile.size_formatted,
        }
      ]);
    }
  }, [selectedFile]);

  const handleSendMessage = async (userPrompt, files = []) => {
    if (!userPrompt.trim() && files.length === 0) return;
    if (loading) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const textQuery = userPrompt.trim() || (files.length > 0 ? `Summarize ${files[0].name}` : '');
    const activeFiles = files.length > 0 ? files : attachedFiles;

    const userMessage = {
      role: 'user',
      text: textQuery,
      attachedFiles: activeFiles.map((f) => ({ name: f.name || f })),
    };

    const docPath = activeFiles[0]?.path || activeFiles[0]?.name;
    const qLower = textQuery.toLowerCase();
    const isApprovalRequest = qLower.includes('approval') || qLower.includes('memorandum') || qLower.includes('docx') || qLower.includes('formal note');

    if (docPath && isApprovalRequest) {
      // 1. Explicit Formal Approval & DOCX Generation on Attached Document
      const assistantPlaceholder = {
        role: 'assistant',
        isCreating: true,
        statusText: `Analyzing '${docPath.split('/').pop()}' & starting OCR...`,
        steps: [
          { name: 'Document Loading', label: `Load '${docPath.split('/').pop()}'`, status: 'active' },
          { name: 'OCR & Parsing', label: 'OCR & text extraction', status: 'pending' },
          { name: 'Findings Extraction', label: 'Extract factual findings & metadata', status: 'pending' },
          { name: 'Approval Drafting', label: 'Draft formal approval note', status: 'pending' },
          { name: 'DOCX Generation', label: 'Generate Word (.docx) artifact', status: 'pending' },
        ],
        attachedFile: docPath,
      };

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
      setLoading(true);

      try {
        await runDocumentApprovalWorkflow({
          documentPath: docPath,
          prompt: textQuery,
          signal: controller.signal,
          onEvent: (event, data) => {
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx < 0 || updated[lastIdx].role !== 'assistant') return updated;

              const assistantMsg = { ...updated[lastIdx] };

              if (event === 'document_loaded') {
                assistantMsg.statusText = `Loaded '${data.file}' (${data.size_kb} KB)`;
                assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                  i === 0 ? { ...s, status: 'completed', detail: `${data.size_kb} KB` } : i === 1 ? { ...s, status: 'active' } : s
                );
              } else if (event === 'ocr_completed') {
                assistantMsg.statusText = `OCR extracted ${data.char_count} chars (${data.pages} pages)`;
                assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                  i === 1 ? { ...s, status: 'completed', detail: `${data.pages}p`, duration_ms: data.ocr_ms } : i === 2 ? { ...s, status: 'active' } : s
                );
              } else if (event === 'findings_extracted') {
                assistantMsg.statusText = 'Findings extracted';
                assistantMsg.findings = data.findings;
                assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                  i === 2 ? { ...s, status: 'completed', detail: data.findings?.entity_or_tag } : i === 3 ? { ...s, status: 'active' } : s
                );
              } else if (event === 'approval_drafted') {
                assistantMsg.statusText = 'Approval note drafted';
                assistantMsg.text = data.approval_note;
                assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                  i === 3 ? { ...s, status: 'completed', duration_ms: data.llm_ms } : i === 4 ? { ...s, status: 'active' } : s
                );
              } else if (event === 'artifact_created') {
                assistantMsg.statusText = 'Generated DOCX artifact';
                assistantMsg.artifact_filename = data.artifact_name;
                assistantMsg.artifact_path = data.artifact_path;
                assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                  i === 4 ? { ...s, status: 'completed', duration_ms: data.artifact_ms } : s
                );
              } else if (event === 'task_completed') {
                assistantMsg.isCreating = false;
                assistantMsg.model_used = data.routing_decision?.ollama_model || 'qwen3:8b';
                assistantMsg.text = data.approval_note_markdown || assistantMsg.text;
                assistantMsg.findings = data.findings;
                assistantMsg.citations = data.citations || [];
                assistantMsg.artifact_filename = data.artifact_filename;
                assistantMsg.artifact_path = data.artifact_path;
                assistantMsg.timings = data.timings;
              } else if (event === 'error') {
                assistantMsg.isCreating = false;
                assistantMsg.text = `Error: ${data.message}`;
              }

              updated[lastIdx] = assistantMsg;
              return updated;
            });
          },
        });
      } catch (err) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0) {
            updated[lastIdx] = {
              role: 'assistant',
              isCreating: false,
              text: `Document Workflow Error: ${err.message}`,
            };
          }
          return updated;
        });
      } finally {
        setLoading(false);
      }
    } else if (docPath) {
      // 2. Direct QA on Attached Document (reads attached document directly!)
      const fileNameOnly = docPath.split('/').pop();
      const assistantPlaceholder = {
        role: 'assistant',
        isCreating: true,
        statusText: `Reading attached document '${fileNameOnly}'...`,
        steps: [
          { name: 'Document Loading', label: `Read attached file '${fileNameOnly}'`, status: 'active' },
          { name: 'Text & OCR Extraction', label: 'Extract document text & pages', status: 'pending' },
          { name: 'Reasoning & Extraction', label: 'Extract answer from document content', status: 'pending' },
        ],
        attachedFile: docPath,
      };

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
      setLoading(true);

      try {
        await runDocumentQAWorkflow({
          documentPath: docPath,
          question: textQuery,
          signal: controller.signal,
          onEvent: (event, data) => {
            if (controller.signal.aborted) return;
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx < 0 || updated[lastIdx].role !== 'assistant') return updated;

              const assistantMsg = { ...updated[lastIdx] };

              if (event === 'document_loaded') {
                assistantMsg.statusText = `Loaded '${data.file}' (${data.size_kb} KB)`;
                assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                  i === 0 ? { ...s, status: 'completed', detail: `${data.size_kb} KB` } : i === 1 ? { ...s, status: 'active' } : s
                );
              } else if (event === 'ocr_completed') {
                assistantMsg.statusText = `Extracted ${data.char_count} chars (${data.pages}p)`;
                assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                  i === 1 ? { ...s, status: 'completed', detail: `${data.pages}p`, duration_ms: data.ocr_ms } : i === 2 ? { ...s, status: 'active' } : s
                );
              } else if (event === 'reasoning_started') {
                assistantMsg.statusText = 'Analyzing document content to answer your question...';
              } else if (event === 'task_completed') {
                assistantMsg.isCreating = false;
                assistantMsg.model_used = data.routing_decision?.ollama_model || 'qwen3:8b';
                assistantMsg.text = data.content || data.text || '';
                assistantMsg.citations = data.citations || [];
                assistantMsg.timings = data.timings;
                assistantMsg.steps = assistantMsg.steps.map((s) => ({ ...s, status: 'completed' }));
              } else if (event === 'error') {
                assistantMsg.isCreating = false;
                assistantMsg.text = `Error: ${data.message}`;
              }

              updated[lastIdx] = assistantMsg;
              return updated;
            });
          },
        });
      } catch (err) {
        if (err.name === 'AbortError' || controller.signal.aborted) {
          // Aborted by user
        } else {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0) {
              updated[lastIdx] = {
                role: 'assistant',
                isCreating: false,
                text: `Document QA Error: ${err.message}`,
              };
            }
            return updated;
          });
        }
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    } else {
      // 3. Database Search across all indexed documents (when no file is attached)
      const assistantPlaceholder = {
        role: 'assistant',
        isCreating: true,
        statusText: 'Searching PostgreSQL pgvector database...',
        steps: [
          { name: 'Database Query', label: 'Search PostgreSQL pgvector database', status: 'active' },
          { name: 'Context Retrieval', label: 'Retrieve grounded evidence chunks', status: 'pending' },
          { name: 'Reasoning Synthesis', label: 'Synthesize factual answer with citations', status: 'pending' },
        ],
        attachedFile: null,
      };

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
      setLoading(true);

      let activeRouting = null;
      let activeTools = [];

      try {
        const assistantMsg = await sendAgentMessage({
          message: textQuery,
          mediaPaths: [],
          stream: true,
          signal: controller.signal,
          onEvent: (event, data, currentText) => {
            if (controller.signal.aborted) return;
            if (event === 'route') activeRouting = data;
            if (event === 'tool_start') activeTools.push(data.tool_name || data.tool);

            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx < 0 || updated[lastIdx].role !== 'assistant') return updated;

              const assistantMsg = { ...updated[lastIdx] };
              assistantMsg.text = currentText;
              assistantMsg.routingDecision = activeRouting;
              assistantMsg.toolCalls = activeTools;
              assistantMsg.statusText = activeTools.length > 0
                ? `Executed ${activeTools[activeTools.length - 1]} in database...`
                : 'Synthesizing answer from retrieved context...';
              
              if (activeTools.length > 0) {
                assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                  i === 0 ? { ...s, status: 'completed' } : i === 1 ? { ...s, status: 'completed', detail: 'pgvector' } : i === 2 ? { ...s, status: 'active' } : s
                );
              }

              updated[lastIdx] = assistantMsg;
              return updated;
            });
          },
        });

        if (!controller.signal.aborted) {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0) {
              updated[lastIdx] = {
                role: 'assistant',
                isCreating: false,
                text: assistantMsg.content || '',
                citations: assistantMsg.citations || [],
                toolCalls: assistantMsg.tool_calls || activeTools,
                routingDecision: activeRouting,
                model_used: assistantMsg.model_used || 'qwen3:8b',
              };
            }
            return updated;
          });
        }
      } catch (err) {
        if (err.name === 'AbortError' || controller.signal.aborted) {
          // Aborted
        } else {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0) {
              updated[lastIdx] = {
                role: 'assistant',
                isCreating: false,
                text: `Search Error: ${err.message}`,
              };
            }
            return updated;
          });
        }
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#141414] overflow-hidden text-neutral-200">
      {/* Header */}
      <div className="px-6 py-3.5 border-b border-[#262626] bg-[#141414] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-white" />
          <h1 className="text-sm font-semibold text-white tracking-wide">
            DOCUMENT AGENT CHAT
          </h1>
          <span className="text-[10px] font-mono bg-[#222] text-neutral-400 px-2 py-0.5 rounded border border-[#333]">
            Direct Document Reader & Intelligent Generator
          </span>
        </div>

        <div className="text-xs font-mono text-neutral-500">
          Mode: <span className="text-neutral-300">Direct Document QA + Vector DB</span>
        </div>
      </div>

      {/* Messages Thread or Empty State */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
            <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-md">
              <FileText className="w-10 h-10 text-white mx-auto" />
            </div>

            <div>
              <h2 className="text-base font-semibold text-white">
                Document Intelligence & Analysis Agent
              </h2>
              <p className="text-xs text-neutral-400 mt-1.5 max-w-md leading-relaxed">
                Attach any PDF or document to read and query it directly, or ask general questions to search across all indexed documents in the database.
              </p>
            </div>

            {/* Quick Prompt Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full text-left">
              {QUICK_DOCUMENT_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPrompt(qp.prompt);
                    handleSendMessage(qp.prompt, attachedFiles);
                  }}
                  className="p-3 bg-[#181818] hover:bg-[#202020] border border-[#262626] hover:border-neutral-500 rounded-xl transition cursor-pointer text-xs group flex flex-col justify-between"
                >
                  <div className="font-semibold text-white mb-1 group-hover:text-neutral-200">
                    {qp.title}
                  </div>
                  <div className="text-[11px] text-neutral-400 line-clamp-2">
                    {qp.prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AgentMessageThread messages={messages} />
        )}
      </div>

      {/* Bottom Chat Bar with Workspace Attachment & Model Switching */}
      <div className="pb-4">
        <BottomChatBar
          prompt={prompt}
          setPrompt={setPrompt}
          onSendMessage={handleSendMessage}
          loading={loading}
          onStop={handleStop}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          placeholder="Ask a question about the attached document, or request an approval note / .docx generation..."
          attachedFiles={attachedFiles}
          setAttachedFiles={setAttachedFiles}
        />
      </div>
    </div>
  );
}
