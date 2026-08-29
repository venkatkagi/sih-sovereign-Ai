import React from 'react';
import { Plus, Database, ChevronDown, ArrowUp } from 'lucide-react';

export default function ChatInput({ prompt, setPrompt, selectedModel }) {
  return (
    <div className="w-full max-w-2xl bg-[#212121] rounded-2xl p-4 border border-[#2e2e2e] shadow-2xl flex flex-col gap-3">
      <textarea
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full bg-transparent text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none resize-none leading-relaxed"
        placeholder="Ask anything, or task a local agent..."
      />

      <div className="flex items-center justify-between pt-2 border-t border-[#2c2c2c]">
        <div className="flex items-center gap-2">
          <button
            title="Attach Document / Drawing"
            className="w-8 h-8 rounded-lg hover:bg-[#2c2c2c] text-neutral-400 hover:text-white flex items-center justify-center transition"
          >
            <Plus size={18} />
          </button>
          <button
            title="Ground with Local Knowledge Base"
            className="px-2.5 py-1 rounded-md hover:bg-[#2c2c2c] text-neutral-400 hover:text-white text-xs flex items-center gap-1.5 border border-[#2e2e2e] transition"
          >
            <Database size={13} />
            <span>SOP Grounding</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 bg-[#171717] px-2.5 py-1.5 rounded-lg border border-[#2e2e2e] cursor-pointer">
            <span className="text-neutral-500">Auto Route:</span>
            <span className="text-neutral-200 font-medium">{selectedModel}</span>
            <ChevronDown size={12} className="ml-0.5 text-neutral-400" />
          </div>

          <button
            disabled={!prompt.trim()}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
              prompt.trim()
                ? 'bg-neutral-200 hover:bg-white text-black cursor-pointer'
                : 'bg-[#2a2a2a] text-neutral-600 cursor-not-allowed'
            }`}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}