import React, { useState, useEffect, useRef } from 'react';
import { 
  Image as ImageIcon, 
  Send, 
  Sparkles, 
  Cpu, 
  RefreshCw,
  Folder,
  Eye,
  Tag
} from 'lucide-react';
import { runMultimodalWorkflow } from '../../services/api';
import AgentMessageThread from '../main/AgentMessageThread';
import BottomChatBar from '../main/BottomChatBar';

const QUICK_VISION_PROMPTS = [
  {
    title: 'P&ID & Drawing Breakdown',
    prompt: 'Inspect this engineering drawing and extract all visible equipment tags, valves, line annotations, and anomalies.',
  },
  {
    title: 'Visual Defect Detection',
    prompt: 'Analyze this image and identify any visual signs of wear, fluid leakage, or mechanical degradation.',
  },
];

export default function MultimodalView({ selectedFile }) {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState({ id: 'qwen3-vl-4b', name: 'qwen3-vl:4b (Vision Model)', vram: '~4.5 GB' });
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
    if (selectedFile?.path && (selectedFile.extension === 'png' || selectedFile.extension === 'jpg' || selectedFile.extension === 'jpeg' || selectedFile.extension === 'pdf')) {
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
    if (loading) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const activeFiles = files.length > 0 ? files : attachedFiles;
    const imgPath = activeFiles[0]?.path || activeFiles[0]?.name || 'documents/inspection_report.pdf';
    const textQuery = userPrompt.trim() || 'Extract visible equipment tags, line annotations, and defect indicators.';

    const userMessage = {
      role: 'user',
      text: textQuery,
      attachedFiles: activeFiles.map((f) => ({ name: f.name || f })),
    };

    const assistantPlaceholder = {
      role: 'assistant',
      isCreating: true,
      statusText: 'Processing visual tensors with local vision model (qwen3-vl:4b)...',
      steps: [
        { name: 'Model Routing', label: 'Route to local vision model (qwen3-vl:4b)', status: 'active' },
        { name: 'Image Ingestion', label: `Load '${imgPath.split('/').pop()}'`, status: 'pending' },
        { name: 'Visual Inference', label: 'Extract annotations & components', status: 'pending' },
        { name: 'Findings Synthesis', label: 'Structure visual findings', status: 'pending' },
      ],
      attachedFile: imgPath,
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setLoading(true);

    try {
      await runMultimodalWorkflow({
        imagePath: imgPath,
        prompt: textQuery,
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
            } else if (event === 'document_loaded') {
              assistantMsg.statusText = `Loaded '${data.file}'`;
              assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                i === 1 ? { ...s, status: 'completed', detail: `${data.size_kb} KB` } : i === 2 ? { ...s, status: 'active' } : s
              );
            } else if (event === 'findings_extracted') {
              assistantMsg.statusText = 'Visual findings extracted';
              assistantMsg.visual_analysis = data.visual_analysis;
              assistantMsg.steps = assistantMsg.steps.map((s, i) =>
                i === 2 ? { ...s, status: 'completed', duration_ms: data.vis_ms } : i === 3 ? { ...s, status: 'completed' } : s
              );
            } else if (event === 'task_completed') {
              assistantMsg.isCreating = false;
              assistantMsg.model_used = data.routing_decision?.ollama_model || 'qwen3-vl:4b';
              assistantMsg.visual_analysis = data.visual_analysis;
              assistantMsg.timings = data.timings;
              assistantMsg.text = `Completed visual inspection on \`${imgPath}\` using local vision model without external telemetry.`;
            } else if (event === 'error') {
              assistantMsg.isCreating = false;
              assistantMsg.text = `Multimodal Error: ${data.message}`;
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
              text: `Vision Workflow Error: ${err.message}`,
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
          <ImageIcon className="w-4 h-4 text-white" />
          <h1 className="text-sm font-semibold text-white tracking-wide">
            MULTIMODAL VISION AGENT
          </h1>
          <span className="text-[10px] font-mono bg-[#222] text-neutral-400 px-2 py-0.5 rounded border border-[#333]">
            Local Offline Vision Extraction
          </span>
        </div>

        <div className="text-xs font-mono text-neutral-500">
          Model: <span className="text-neutral-300">qwen3-vl:4b (Multimodal)</span>
        </div>
      </div>

      {/* Messages Thread or Empty State */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="max-w-xl mx-auto h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
            <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-md">
              <ImageIcon className="w-10 h-10 text-white mx-auto" />
            </div>

            <div>
              <h2 className="text-base font-semibold text-white">
                Multimodal Vision Agent
              </h2>
              <p className="text-xs text-neutral-400 mt-1.5 max-w-md leading-relaxed">
                Inspect P&ID schematics, industrial drawings, scanned PDF documents, and engineering diagrams. Extracts visible equipment tags, valves, line annotations, and potential defect indicators.
              </p>
            </div>

            {/* Quick Prompt Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full text-left">
              {QUICK_VISION_PROMPTS.map((qp, idx) => (
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
          placeholder="Ask a question about the drawing, or request component & defect tag extraction..."
          attachedFiles={attachedFiles}
          setAttachedFiles={setAttachedFiles}
        />
      </div>
    </div>
  );
}
