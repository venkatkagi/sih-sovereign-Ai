import React from 'react';
import { 
  FileText, 
  Code2, 
  Image as ImageIcon, 
  Bot, 
  ArrowRight, 
  MessageSquare
} from 'lucide-react';

export default function TaskHubView({ onSelectTask, selectedFile }) {
  const TASK_CARDS = [
    {
      id: 'doc-agent',
      title: 'Document Agent',
      subtitle: 'Document analysis & approval',
      icon: FileText,
    },
    {
      id: 'coding',
      title: 'Coding Sandbox',
      subtitle: 'Python execution & math',
      icon: Code2,
    },
    {
      id: 'multimodal',
      title: 'Multimodal Analysis',
      subtitle: 'Vision & diagram extraction',
      icon: ImageIcon,
    },
    {
      id: 'auto-route',
      title: 'Auto Routing',
      subtitle: 'Dynamic model selector',
      icon: Bot,
    },
  ];

  return (
    <div className="flex-1 flex flex-col justify-center items-center h-full bg-[#141414] p-8 select-none">
      <div className="w-full max-w-2xl">
        {/* Minimal Header */}
        <div className="mb-8">
          <h2 className="text-xl font-medium text-white tracking-tight">
            Select a task
          </h2>
          {selectedFile && (
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Target: {selectedFile.name}
            </p>
          )}
        </div>

        {/* 2x2 Minimal Clean Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TASK_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onSelectTask(card.id)}
                className="group flex flex-col items-start p-6 rounded-2xl bg-[#191919] hover:bg-[#202020] border border-[#2a2a2a] hover:border-neutral-400 transition-all duration-200 text-left cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(255,255,255,0.03)]"
              >
                <div className="p-3 rounded-xl bg-[#242424] border border-[#333333] group-hover:border-neutral-400 mb-4 transition-colors">
                  <Icon className="w-6 h-6 text-neutral-200 group-hover:text-white" />
                </div>
                
                <h3 className="text-sm font-semibold text-white group-hover:text-neutral-100 transition-colors">
                  {card.title}
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  {card.subtitle}
                </p>
              </button>
            );
          })}
        </div>

        {/* Minimal Chat Agent Row */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => onSelectTask('chat')}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#191919] hover:bg-[#202020] border border-[#2a2a2a] hover:border-neutral-400 transition-all duration-200 text-left cursor-pointer shadow-sm group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#242424] border border-[#333333] group-hover:border-neutral-400 transition-colors">
                <MessageSquare className="w-4 h-4 text-neutral-300 group-hover:text-white" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Interactive RAG Agent</div>
                <div className="text-[11px] text-neutral-400">Ask questions across all indexed documents</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      </div>
    </div>
  );
}
