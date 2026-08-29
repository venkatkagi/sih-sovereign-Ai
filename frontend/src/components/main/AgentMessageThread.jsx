import React, { useState, useRef, useEffect } from 'react';
import {
  BrainCircuit,
  Wrench,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileText,
  Download,
  Code2,
  Terminal,
  Copy,
  Check,
  Eye,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Tag,
  MessageSquare,
  FileSpreadsheet,
  FilePlus2,
  FileCode,
  Table,
  FolderOpen,
  ExternalLink,
} from 'lucide-react';
import { getWorkspaceFileUrl } from '../../services/api';
import ExecutionProgressWidget from '../common/ExecutionProgressWidget';

/* ─── ThinkingBlock ──────────────────────────────────────────── */
function ThinkingBlock({ thinking, isGenerating }) {
  const [isOpen, setIsOpen] = useState(true);
  if (!thinking && !isGenerating) return null;
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] overflow-hidden my-1 shadow-inner">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2 flex items-center justify-between bg-[#181818] hover:bg-[#1f1f1f] transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {isGenerating ? (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
          ) : (
            <BrainCircuit size={12} className="text-neutral-400" />
          )}
          <span className="text-[11px] font-mono font-medium text-neutral-300">
            {isGenerating ? 'Thinking...' : `Thinking Process`}
            {!isGenerating && thinking && (
              <span className="text-neutral-500 font-normal ml-1">({thinking.length} chars)</span>
            )}
          </span>
        </div>
        <span className="text-neutral-500">
          {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      {isOpen && (
        <div className="p-3.5 border-t border-[#222] bg-[#101010] text-[11px] font-mono text-neutral-400 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
          {thinking || 'Analyzing prompt and reasoning step-by-step...'}
          {isGenerating && <span className="inline-block w-1.5 h-3 ml-1 bg-neutral-400 animate-pulse" />}
        </div>
      )}
    </div>
  );
}

/* ─── ArtifactCard ───────────────────────────────────────────── */
function ArtifactCard({ art, onOpen }) {
  const ext = (art.name || '').split('.').pop()?.toLowerCase();
  const icons = {
    pdf: <FileText size={16} className="text-red-400" />,
    xlsx: <FileSpreadsheet size={16} className="text-emerald-400" />,
    xls: <FileSpreadsheet size={16} className="text-emerald-400" />,
    csv: <Table size={16} className="text-teal-400" />,
    md: <FilePlus2 size={16} className="text-blue-400" />,
    py: <FileCode size={16} className="text-yellow-400" />,
    txt: <FileText size={16} className="text-neutral-300" />,
  };
  const icon = icons[ext] || <FileText size={16} className="text-neutral-400" />;
  const extColors = {
    pdf: 'text-red-400 bg-red-950/40 border-red-800/40',
    xlsx: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40',
    xls: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40',
    csv: 'text-teal-400 bg-teal-950/40 border-teal-800/40',
    md: 'text-blue-400 bg-blue-950/40 border-blue-800/40',
    py: 'text-yellow-400 bg-yellow-950/40 border-yellow-800/40',
  };
  const extColor = extColors[ext] || 'text-neutral-300 bg-[#1c1c1c] border-[#333]';

  return (
    <div
      onClick={() => onOpen && onOpen(art)}
      className="group flex items-center justify-between p-3 bg-[#141414] hover:bg-[#1c1c1c] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-xl cursor-pointer transition-all"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-1.5 rounded-lg bg-[#202020] border border-[#2e2e2e] flex-shrink-0">{icon}</div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white truncate max-w-[200px]">{art.name}</div>
          <div className="text-[10px] text-neutral-500 font-mono">
            {art.size_formatted || 'workspace/output/'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${extColor}`}>
          .{ext}
        </span>
        <span className="opacity-0 group-hover:opacity-100 transition text-neutral-400 hover:text-white">
          <ExternalLink size={13} />
        </span>
      </div>
    </div>
  );
}

/* ─── AgentMessageThread ─────────────────────────────────────── */
export default function AgentMessageThread({ messages, onCitationClick, onDownloadArtifact }) {
  const [expandedTools, setExpandedTools] = useState({});
  const [copiedCodeIdx, setCopiedCodeIdx] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleTools = (idx) => setExpandedTools((p) => ({ ...p, [idx]: !p[idx] }));

  const handleCopyCode = (code, idx) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto overflow-y-auto px-2 py-5 space-y-5">
      {messages.map((msg, idx) => (
        <div key={idx} className="flex flex-col gap-2">
          {/* ── USER ────────────────── */}
          {msg.role === 'user' && (
            <div className="flex flex-col items-end gap-1.5">
              {msg.attachedFiles?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {msg.attachedFiles.map((f, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-1.5 px-3 py-1 bg-[#202020] border border-[#333] rounded-xl text-xs text-neutral-300 font-mono">
                      <FileText className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="truncate max-w-[200px]">{f.name || f}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="bg-[#272727] text-neutral-100 px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm max-w-[85%] leading-relaxed border border-[#383838] shadow-sm">
                {msg.text}
              </div>
            </div>
          )}

          {/* ── ASSISTANT ───────────── */}
          {msg.role === 'assistant' && (
            <div className="flex flex-col gap-2">
              {/* Loading spinner when no content yet */}
              {msg.isCreating && !msg.text && !msg.thinking && (
                <ExecutionProgressWidget
                  status="working"
                  statusMessage={msg.statusText || 'Processing with local model...'}
                />
              )}

              {/* Main assistant card — always render when we have ANY content, tool calls, or artifacts */}
              {(!msg.isCreating || msg.text || msg.thinking || (msg.toolCalls?.length > 0) || (msg.artifacts?.length > 0)) && (
                <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-sm">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#242424] bg-[#1c1c1c]">
                    <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono">
                      <Cpu size={11} className="text-neutral-300" />
                      <span>
                        Model: <strong className="text-white">{msg.model_used || msg.routingDecision?.ollama_model || 'Local Ollama'}</strong>
                      </span>
                    </div>
                    {msg.toolCalls?.length > 0 && (
                      <button
                        onClick={() => toggleTools(idx)}
                        className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 hover:text-white transition cursor-pointer"
                      >
                        <Wrench size={11} className="text-neutral-400" />
                        <span>{msg.toolCalls.length} tool{msg.toolCalls.length > 1 ? 's' : ''} used</span>
                        {expandedTools[idx] ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    )}
                  </div>

                  <div className="p-4 flex flex-col gap-3">
                    {/* Tool call records */}
                    {msg.toolCalls?.length > 0 && expandedTools[idx] && (
                      <div className="bg-[#121212] border border-[#2a2a2a] rounded-xl p-3 text-xs flex flex-col gap-2 font-mono">
                        {msg.toolCalls.map((tc, tcIdx) => {
                          const toolName = typeof tc === 'string' ? tc : (tc.tool || tc.tool_name || 'tool');
                          const result = tc.result || {};
                          const success = result.success !== false;
                          return (
                            <div key={tcIdx} className="flex flex-col gap-1 border-b border-[#222] last:border-0 pb-1.5 last:pb-0">
                              <div className="flex items-center gap-2">
                                {success
                                  ? <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" />
                                  : <AlertCircle size={11} className="text-red-400 flex-shrink-0" />}
                                <span className="text-white font-semibold">▶ {toolName}</span>
                              </div>
                              {tc.arguments && (
                                <div className="text-neutral-500 text-[10px] pl-5 truncate">
                                  args: {JSON.stringify(tc.arguments).slice(0, 140)}
                                </div>
                              )}
                              {result.message && (
                                <div className="text-emerald-400 text-[10px] pl-5">{result.message}</div>
                              )}
                              {result.error && (
                                <div className="text-red-400 text-[10px] pl-5">{result.error}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Thinking block */}
                    {(msg.thinking || (msg.isCreating && !msg.text)) && (
                      <ThinkingBlock thinking={msg.thinking} isGenerating={msg.isCreating} />
                    )}

                    {/* Main text body */}
                    {msg.text ? (
                      <div className="text-sm text-neutral-100 leading-relaxed whitespace-pre-wrap font-sans">
                        {msg.text}
                        {msg.isCreating && (
                          <span className="inline-block w-1.5 h-3.5 ml-1 bg-white animate-pulse" />
                        )}
                      </div>
                    ) : !msg.thinking && msg.toolCalls?.length > 0 && !msg.isCreating && (
                      /* Show summary when only tools ran (no text) */
                      <div className="text-sm text-neutral-300 leading-relaxed">
                        ✓ Task completed via tools. {msg.artifacts?.length > 0 ? 'Generated files are shown below.' : 'See tool results above.'}
                      </div>
                    )}

                    {/* Generated Code Block */}
                    {msg.generated_code && (
                      <div className="p-4 bg-[#121212] border border-[#262626] rounded-xl">
                        <div className="flex items-center justify-between pb-2 border-b border-[#222] mb-2">
                          <span className="text-[11px] font-mono font-semibold text-neutral-300 flex items-center gap-1.5">
                            <Code2 className="w-3.5 h-3.5 text-neutral-400" /> Generated Code
                          </span>
                          <button
                            onClick={() => handleCopyCode(msg.generated_code, idx)}
                            className="flex items-center gap-1 text-[10px] text-neutral-300 hover:text-white px-2 py-0.5 bg-[#222] hover:bg-[#2a2a2a] rounded border border-[#333] transition cursor-pointer font-mono"
                          >
                            {copiedCodeIdx === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedCodeIdx === idx ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <pre className="text-xs font-mono text-neutral-200 overflow-x-auto max-h-64 leading-relaxed">
                          {msg.generated_code}
                        </pre>
                      </div>
                    )}

                    {/* Sandbox output */}
                    {msg.sandbox_result && (
                      <div className="p-3.5 bg-[#111] border border-[#262626] rounded-xl font-mono text-xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-[#222] mb-2">
                          <span className="text-neutral-400 flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5" /> Sandbox Output
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${
                            msg.sandbox_result.verified ? 'bg-[#182418] text-emerald-300 border-[#2a402a]' : 'bg-[#222] text-neutral-300 border-[#333]'
                          }`}>
                            {msg.sandbox_result.verified ? '✓ Tests Passed' : 'Executed'}
                          </span>
                        </div>
                        <div className="text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                          {msg.sandbox_result.stdout || msg.sandbox_result.stderr || 'Executed cleanly.'}
                        </div>
                      </div>
                    )}

                    {/* ── Artifact Cards ── */}
                    {msg.artifacts?.length > 0 && (
                      <div className="flex flex-col gap-2 pt-1">
                        <div className="text-[11px] font-mono text-neutral-500 flex items-center gap-1.5">
                          <FolderOpen size={12} /> Generated Files
                        </div>
                        {msg.artifacts.map((art, aIdx) => (
                          <ArtifactCard key={aIdx} art={art} onOpen={onDownloadArtifact} />
                        ))}
                      </div>
                    )}

                    {/* Fallback single artifact */}
                    {(!msg.artifacts || msg.artifacts.length === 0) && (msg.artifact_path || msg.artifact) && (
                      <ArtifactCard
                        art={{
                          name: msg.artifact_filename || msg.artifact?.name || 'Generated Document',
                          path: msg.artifact_path || msg.artifact?.path,
                          size_formatted: null,
                        }}
                        onOpen={() => onDownloadArtifact && onDownloadArtifact({
                          name: msg.artifact_filename || msg.artifact?.name,
                          path: msg.artifact_path || msg.artifact?.path,
                        })}
                      />
                    )}

                    {/* Citations */}
                    {msg.citations?.length > 0 && (
                      <div className="pt-2 border-t border-[#242424] space-y-1.5">
                        <div className="text-[10px] font-mono font-medium text-neutral-500 flex items-center gap-1">
                          <Tag size={10} /> Citations & Evidence Sources:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((c, cIdx) => (
                            <div
                              key={cIdx}
                              onClick={() => onCitationClick && onCitationClick(c)}
                              className="px-2 py-1 bg-[#141414] hover:bg-[#1f1f1f] border border-[#2a2a2a] hover:border-neutral-500 rounded-lg text-[10px] text-neutral-300 font-mono cursor-pointer transition-colors"
                            >
                              [{cIdx + 1}] {c.source || c.document_name}{(c.page_number || c.page) ? ` (p.${c.page_number || c.page})` : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}