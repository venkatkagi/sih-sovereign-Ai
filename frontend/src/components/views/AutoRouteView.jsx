import React, { useState, useRef } from 'react';
import { 
  Bot, 
  Sparkles, 
  Cpu, 
  Layers, 
  Download,
  FileText,
  Code2,
  Image as ImageIcon
} from 'lucide-react';
import { runAutoRouteWorkflow } from '../../services/api';
import AgentMessageThread from '../main/AgentMessageThread';
import BottomChatBar from '../main/BottomChatBar';

const QUICK_ROUTING_PROMPTS = [
  {
    title: 'Document Analysis & DOCX',
    prompt: 'Analyze inspection_report.pdf and generate a formal approval memorandum in Word (.docx) format.',
  },
  {
    title: 'Python Numerical Sandbox',
    prompt: 'Write a Python program to calculate pressure drop using the Darcy-Weisbach equation and verify in sandbox.',
  },
  {
    title: 'Engineering Vision Inspection',
    prompt: 'Inspect this engineering drawing and identify all equipment tags and potential defect indicators.',
  },
  {
    title: 'Industrial Standards Query',
    prompt: 'Explain the safety standards under API 682 regarding dual mechanical seal flush plans.',
  },
];

export default function AutoRouteView() {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState({ id: 'auto', name: 'Auto Dynamic Router', vram: 'Auto' });
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

  const handleSendMessage = async (userPrompt, files = []) => {
    if (!userPrompt.trim() && files.length === 0) return;
    if (loading) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const textQuery = userPrompt.trim() || (files.length > 0 ? `Analyze attached file ${files[0].name}` : '');

    const userMessage = {
      role: 'user',
      text: textQuery,
      attachedFiles: files.map((f) => ({ name: f.name || f })),
    };

    const assistantPlaceholder = {
      role: 'assistant',
      isCreating: true,
      statusText: 'Analyzing intent & selecting optimal local model...',
      steps: [
        { name: 'Intent Analysis', label: 'Analyze task complexity & modalities', status: 'active' },
        { name: 'Model & Tool Routing', label: 'Select model & required tools', status: 'pending' },
        { name: 'Pipeline Execution', label: 'Execute target cognitive pipeline', status: 'pending' },
        { name: 'Result Synthesis', label: 'Synthesize grounded artifacts & findings', status: 'pending' },
      ],
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setLoading(true);

    try {
      await runAutoRouteWorkflow({
        query: textQuery,
        signal: controller.signal,
        onEvent: (event, data) => {
          if (controller.signal.aborted) return;
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx < 0 || updated[lastIdx].role !== 'assistant') return updated;

            const assistantMsg = { ...updated[lastIdx] };

            if (event === 'routing') {
              assistantMsg.statusText = `Routing to ${data.task_type} via ${data.selected_model || data.model}`;
              assistantMsg.routingDecision = data;
              assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                i === 0 ? { ...s, status: 'completed' } : i === 1 ? { ...s, status: 'completed', detail: `${data.selected_model || data.model}`, duration_ms: data.routing_ms } : i === 2 ? { ...s, status: 'active' } : s
              );
            } else if (event === 'document_loaded') {
              assistantMsg.statusText = `Loaded '${data.file}'`;
            } else if (event === 'ocr_completed') {
              assistantMsg.statusText = `OCR extracted ${data.char_count} chars (${data.pages} pages)`;
            } else if (event === 'code_generated') {
              assistantMsg.statusText = 'Code generated';
              assistantMsg.generated_code = data.generated_code;
            } else if (event === 'execution_completed') {
              assistantMsg.statusText = `Executed sandbox (Exit ${data.exit_code})`;
            } else if (event === 'findings_extracted') {
              assistantMsg.statusText = 'Extracted findings';
              assistantMsg.findings = data.findings;
              assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                i === 2 ? { ...s, status: 'completed' } : i === 3 ? { ...s, status: 'active' } : s
              );
            } else if (event === 'artifact_created') {
              assistantMsg.statusText = `Artifact created: ${data.artifact_name}`;
              assistantMsg.artifact_filename = data.artifact_name;
              assistantMsg.artifact_path = data.artifact_path;
            } else if (event === 'task_completed') {
              assistantMsg.isCreating = false;
              assistantMsg.model_used = data.routing_decision?.selected_model || data.routing_decision?.ollama_model || 'qwen3:8b';
              assistantMsg.timings = data.timings;
              assistantMsg.findings = data.findings || assistantMsg.findings;
              assistantMsg.generated_code = data.generated_code || assistantMsg.generated_code;
              assistantMsg.sandbox_result = data.sandbox_result || assistantMsg.sandbox_result;
              assistantMsg.visual_analysis = data.visual_analysis || assistantMsg.visual_analysis;
              assistantMsg.artifact_filename = data.artifact_filename || assistantMsg.artifact_filename;
              assistantMsg.artifact_path = data.artifact_path || assistantMsg.artifact_path;
              assistantMsg.text = data.approval_note_markdown || data.content || assistantMsg.text || 'Task completed successfully.';
            } else if (event === 'error') {
              assistantMsg.isCreating = false;
              assistantMsg.text = `Routing Workflow Error: ${data.message}`;
            }

            updated[lastIdx] = assistantMsg;
            return updated;
          });
        },
      });
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        // Aborted cleanly
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0) {
            updated[lastIdx] = {
              role: 'assistant',
              isCreating: false,
              text: `Workflow Error: ${err.message}`,
            };
          }
          return updated;
        });
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#141414] overflow-hidden text-neutral-200">
      {/* Header */}
      <div className="px-6 py-3.5 border-b border-[#262626] bg-[#141414] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-white" />
          <h1 className="text-sm font-semibold text-white tracking-wide">
            AUTO ROUTING CHATBOT
          </h1>
          <span className="text-[10px] font-mono bg-[#222] text-neutral-400 px-2 py-0.5 rounded border border-[#333]">
            Dynamic Intent & Pipeline Dispatcher
          </span>
        </div>

        <div className="text-xs font-mono text-neutral-500">
          Routing: <span className="text-neutral-300">Autonomous</span>
        </div>
      </div>

      {/* Message Thread or Empty State */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
            <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-md">
              <Bot className="w-10 h-10 text-white mx-auto" />
            </div>

            <div>
              <h2 className="text-base font-semibold text-white">
                Sovereign Universal Cognitive Agent
              </h2>
              <p className="text-xs text-neutral-400 mt-1.5 max-w-md leading-relaxed">
                Type any task or prompt, attach any document, script, or image. The workbench automatically detects the task modality and complexity, selects the optimal local model, and executes the real pipeline with downloadable artifacts.
              </p>
            </div>

            {/* Quick Prompt Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              {QUICK_ROUTING_PROMPTS.map((qp, idx) => (
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

      {/* Bottom Chat Bar with Workspace Attachment & Dynamic Model Routing */}
      <div className="pb-4">
        <BottomChatBar
          prompt={prompt}
          setPrompt={setPrompt}
          onSendMessage={handleSendMessage}
          loading={loading}
          onStop={handleStop}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          placeholder="Ask anything, attach any file, or task a local agent..."
          attachedFiles={attachedFiles}
          setAttachedFiles={setAttachedFiles}
        />
      </div>
    </div>
  );
}
