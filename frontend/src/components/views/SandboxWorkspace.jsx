import React, { useState } from 'react';
import { Code2, Terminal, Play, ChevronDown, ChevronUp, X } from 'lucide-react';
import AgentMessageThread from '../main/AgentMessageThread';
import BottomChatBar from '../main/BottomChatBar';
import { AVAILABLE_MODELS } from '../../data/mockData';

export default function SandboxWorkspace({ onOpenArtifact }) {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[2]); // Qwen-2.5 Coder
  const [hasCode, setHasCode] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [code, setCode] = useState('');
  const [terminalOutput, setTerminalOutput] = useState('');

  const handleSendMessage = (userText) => {
    if (!userText.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);

    setTimeout(() => {
      setCode(`import math\n\ndef calculate_pipe_thickness(P, D, S, E, y=0.4):\n    return (P * D) / (2 * (S * E + P * y))\n\np, d, s, e = 500, 12.75, 20000, 1.0\nt = calculate_pipe_thickness(p, d, s, e)\nprint(f"Calculated Nominal Wall Thickness: {t:.4f} in")`);
      setTerminalOutput(`>>> python3 script.py\nCalculated Nominal Wall Thickness: 0.1582 in\n[Process Finished with Exit Code 0 - 0 KB Egress]`);
      setHasCode(true);
      setShowDropdown(true);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `### Calculation & Script Execution Output\n\n**ASME B31.3 Minimum Required Wall Thickness:**\n\n$$t = \\frac{P \\cdot D}{2(S \\cdot E + P \\cdot y)} = \\frac{500 \\times 12.75}{2(20000 \\times 1.0 + 500 \\times 0.4)} = 0.1582\\text{ inches}$$\n\n* **Recommended Pipe Class:** Schedule 20 (0.250 in nominal thickness).\n* **Corrosion Margin Remaining:** +0.0918 in (Safety Factor 1.58x).`,
          artifacts: [
            { id: `code-report-${Date.now()}`, title: 'Stress_Analysis_Proof.pdf', type: 'pdf', pages: 3, date: 'Just now' }
          ]
        }
      ]);
    }, 600);
  };

  const handleRunManual = () => {
    setTerminalOutput(`>>> Re-executing in offline sandbox container...\nCalculated Nominal Wall Thickness: 0.1582 in\n[Process completed successfully]`);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden justify-between py-4 relative select-none">
      {/* Top Bar with Top-Right Sandbox Dropdown Button */}
      <div className="w-full max-w-3xl mx-auto px-4 flex items-center justify-end pb-2 min-h-[36px]">
        {hasCode && (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 bg-[#212121] hover:bg-[#2a2a2a] border border-emerald-800/60 text-emerald-400 text-xs px-3 py-1.5 rounded-xl shadow-lg transition"
            >
              <Code2 size={13} />
              <span>Sandbox & Console</span>
              {showDropdown ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-10 w-[520px] bg-[#181818] border border-[#2e2e2e] rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2">
                <div className="flex items-center justify-between pb-2 border-b border-[#2a2a2a] text-xs">
                  <span className="font-mono text-neutral-400 flex items-center gap-1.5">
                    <Code2 size={13} className="text-emerald-400" /> script.py
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRunManual}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 transition"
                    >
                      <Play size={11} /> Re-Run
                    </button>
                    <button onClick={() => setShowDropdown(false)} className="text-neutral-500 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 h-44">
                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    spellCheck="false"
                    className="w-full h-full p-2.5 bg-[#121212] rounded-xl border border-[#262626] text-neutral-200 font-mono text-xs resize-none focus:outline-none"
                  />
                  <div className="w-full h-full p-2.5 bg-[#101010] rounded-xl border border-[#262626] font-mono text-[11px] text-emerald-400 whitespace-pre-wrap overflow-y-auto">
                    <div className="text-neutral-500 mb-1 flex items-center gap-1">
                      <Terminal size={11} /> Console:
                    </div>
                    {terminalOutput}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1f1f1f] border border-[#2a2a2a] flex items-center justify-center shadow-xl mb-3">
            <Code2 size={34} className="text-emerald-400" />
          </div>
          <span className="font-mono text-sm tracking-widest text-neutral-400 uppercase font-semibold">
            CODE SANDBOX
          </span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-y-auto">
          <AgentMessageThread messages={messages} onOpenArtifact={onOpenArtifact} />
        </div>
      )}

      <div className="pb-6">
        <BottomChatBar
          prompt={prompt}
          setPrompt={setPrompt}
          onSendMessage={handleSendMessage}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          isSpecializedView={true}
          placeholder="Enter calculation or script to execute in sandbox..."
        />
      </div>
    </div>
  );
}