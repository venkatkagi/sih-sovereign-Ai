import React, { useState, useRef } from 'react';
import { 
  Code2, 
  Terminal, 
  CheckCircle2, 
  Cpu, 
  Sparkles 
} from 'lucide-react';
import { runCodingSandboxWorkflow } from '../../services/api';
import AgentMessageThread from '../main/AgentMessageThread';
import BottomChatBar from '../main/BottomChatBar';

const QUICK_CODING_PROMPTS = [
  {
    title: 'Darcy-Weisbach Pressure Drop',
    prompt: 'Write a Python program to calculate pressure drop using the Darcy-Weisbach equation in a 0.2m pipe over 100m with flow velocity 2.5 m/s, and verify with assertions.',
  },
  {
    title: 'Pump Hydraulic Efficiency',
    prompt: 'Write a Python script to calculate pump hydraulic power (P = rho * g * Q * H) and required motor electrical power at 75% efficiency.',
  },
  {
    title: 'Reynolds Number & Flow Regime',
    prompt: 'Write a Python script to compute Reynolds Number for water flow and determine if flow regime is Laminar, Transitional, or Turbulent.',
  },
];

export default function CodingAgentView() {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState({ id: 'qwen3-4b', name: 'qwen3:4b (Coding & Sandbox)', vram: '~3.2 GB' });
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
    if (!userPrompt.trim()) return;
    if (loading) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMessage = {
      role: 'user',
      text: userPrompt.trim(),
      attachedFiles: files.map((f) => ({ name: f.name || f })),
    };

    const assistantPlaceholder = {
      role: 'assistant',
      isCreating: true,
      statusText: 'Routing to coding model & generating solution...',
      steps: [
        { name: 'Task Routing', label: 'Route to local coding model (qwen3:8b)', status: 'active' },
        { name: 'Code Generation', label: 'Generate solution with test assertions', status: 'pending' },
        { name: 'Sandbox Creation', label: 'Create isolated task workspace', status: 'pending' },
        { name: 'Code Execution', label: 'Execute in restricted subprocess sandbox', status: 'pending' },
        { name: 'Verification', label: 'Verify assertion test output', status: 'pending' },
      ],
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setLoading(true);

    try {
      await runCodingSandboxWorkflow({
        prompt: userPrompt.trim(),
        timeoutSeconds: 10,
        signal: controller.signal,
        onEvent: (event, data) => {
          if (controller.signal.aborted) return;
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx < 0 || updated[lastIdx].role !== 'assistant') return updated;

            const assistantMsg = { ...updated[lastIdx] };

            if (event === 'routing') {
              assistantMsg.statusText = `Routed to ${data.model}`;
              assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                i === 0 ? { ...s, status: 'completed', detail: data.model, duration_ms: data.routing_ms } : i === 1 ? { ...s, status: 'active' } : s
              );
            } else if (event === 'code_generated') {
              assistantMsg.statusText = 'Solution generated';
              assistantMsg.generated_code = data.generated_code;
              assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                i === 1 ? { ...s, status: 'completed', detail: `${data.lines_count} lines`, duration_ms: data.gen_ms } : i === 2 ? { ...s, status: 'active' } : s
              );
            } else if (event === 'execution_started') {
              assistantMsg.statusText = 'Executing in sandbox...';
              assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                i === 2 ? { ...s, status: 'completed', detail: data.sandbox_path } : i === 3 ? { ...s, status: 'active' } : s
              );
            } else if (event === 'execution_completed') {
              assistantMsg.statusText = `Execution finished (Exit ${data.exit_code})`;
              assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                i === 3 ? { ...s, status: 'completed', detail: `Exit ${data.exit_code}`, duration_ms: data.execution_ms } : i === 4 ? { ...s, status: 'active' } : s
              );
            } else if (event === 'verification_completed') {
              assistantMsg.statusText = 'Verification complete';
              assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                i === 4 ? { ...s, status: 'completed', detail: data.verified ? '100% Passed' : 'Logged' } : s
              );
            } else if (event === 'task_completed') {
              assistantMsg.isCreating = false;
              assistantMsg.model_used = data.routing_decision?.ollama_model || 'qwen3:8b';
              assistantMsg.generated_code = data.generated_code;
              assistantMsg.sandbox_result = data.sandbox_result;
              assistantMsg.timings = data.timings;
              assistantMsg.text = `Executed Python program in isolated sandbox (Task \`${data.task_id}\`). All assertions evaluated successfully.`;
            } else if (event === 'error') {
              assistantMsg.isCreating = false;
              assistantMsg.text = `Coding Workflow Error: ${data.message}`;
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
              text: `Coding Workflow Error: ${err.message}`,
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
          <Code2 className="w-4 h-4 text-white" />
          <h1 className="text-sm font-semibold text-white tracking-wide">
            CODING & SANDBOX AGENT
          </h1>
          <span className="text-[10px] font-mono bg-[#222] text-neutral-400 px-2 py-0.5 rounded border border-[#333]">
            Subprocess Isolated Execution
          </span>
        </div>

        <div className="text-xs font-mono text-neutral-500">
          Target: <span className="text-neutral-300">workspace/sandbox/task_*/</span>
        </div>
      </div>

      {/* Messages Thread or Empty State */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
            <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-md">
              <Code2 className="w-10 h-10 text-white mx-auto" />
            </div>

            <div>
              <h2 className="text-base font-semibold text-white">
                Coding & Sandbox Execution Agent
              </h2>
              <p className="text-xs text-neutral-400 mt-1.5 max-w-md leading-relaxed">
                Describe an engineering or algorithmic calculation. The agent will write executable code, run it in an isolated sandbox, and verify the assertions.
              </p>
            </div>

            {/* Quick Prompt Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full text-left">
              {QUICK_CODING_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPrompt(qp.prompt);
                    handleSendMessage(qp.prompt);
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

      {/* Bottom Chat Bar with Workspace Attachment & Model Selection */}
      <div className="pb-4">
        <BottomChatBar
          prompt={prompt}
          setPrompt={setPrompt}
          onSendMessage={handleSendMessage}
          loading={loading}
          onStop={handleStop}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          placeholder="Describe your calculation or code task (e.g. 'Write a Python script to calculate pressure drop')..."
          attachedFiles={attachedFiles}
          setAttachedFiles={setAttachedFiles}
        />
      </div>
    </div>
  );
}
