import React, { useState } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  FolderTree, 
  Cpu, 
  ShieldCheck, 
  Database,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import WorkspaceFileTree from './WorkspaceFileTree';

export default function UnifiedSidebar({
  sessions = [],
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onSelectFile,
  selectedFilePath,
  selectedModel
}) {
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' or 'files'

  return (
    <aside className="w-64 flex flex-col h-full bg-[#141414] border-r border-[#262626] flex-shrink-0 select-none overflow-hidden">
      {/* Top Brand & Actions */}
      <div className="p-3 border-b border-[#262626] flex flex-col gap-2.5 bg-[#171717]">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center shadow">
              <span className="font-mono text-black font-extrabold text-xs">VM</span>
            </div>
            <span className="font-bold text-xs tracking-wider text-white uppercase font-mono">
              VAULTMIND
            </span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#222] border border-[#333] text-neutral-400">
            v2.4
          </span>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          type="button"
          className="w-full flex items-center justify-center gap-2 bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] text-neutral-100 hover:text-white rounded-xl py-2 px-3 text-xs font-medium transition cursor-pointer shadow-sm active:scale-[0.98]"
        >
          <Plus size={14} className="text-white" />
          <span>New Chat</span>
        </button>

        {/* Navigation Switcher: Chats vs Workspace Files */}
        <div className="grid grid-cols-2 p-0.5 bg-[#111111] rounded-lg border border-[#262626]">
          <button
            type="button"
            onClick={() => setActiveTab('chats')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
              activeTab === 'chats'
                ? 'bg-[#222222] text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <MessageSquare size={12} />
            <span>History ({sessions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('files')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
              activeTab === 'files'
                ? 'bg-[#222222] text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FolderTree size={12} />
            <span>Workspace</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* CHATS / HISTORY TAB */}
        {activeTab === 'chats' && (
          <div className="p-2 space-y-1">
            <div className="px-2 py-1 text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
              Recent Conversations
            </div>

            {sessions.length === 0 ? (
              <div className="p-4 text-center text-neutral-500 text-xs font-mono">
                No chat history yet.
              </div>
            ) : (
              sessions.map((s) => {
                const isActive = s.id === currentSessionId;
                const modelName = s.model?.ollama_model || s.model?.name || selectedModel?.ollama_model || 'qwen3:4b';

                return (
                  <div
                    key={s.id}
                    onClick={() => onSelectSession(s.id)}
                    className={`group relative flex items-center justify-between p-2.5 rounded-xl text-xs transition cursor-pointer ${
                      isActive
                        ? 'bg-[#202020] text-white border border-[#333333]'
                        : 'text-neutral-400 hover:bg-[#191919] hover:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      <MessageSquare size={13} className={`shrink-0 ${isActive ? 'text-white' : 'text-neutral-500'}`} />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium text-xs">
                          {s.title || 'New Conversation'}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono flex items-center gap-1">
                          <Cpu size={10} />
                          {modelName}
                        </span>
                      </div>
                    </div>

                    {/* Delete Session Button (Hover) */}
                    {sessions.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(s.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#2c2c2c] text-neutral-500 hover:text-red-400 transition"
                        title="Delete Session"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* WORKSPACE FILES TAB */}
        {activeTab === 'files' && (
          <div className="h-full">
            <WorkspaceFileTree
              onSelectFile={onSelectFile}
              selectedFilePath={selectedFilePath}
            />
          </div>
        )}
      </div>

      {/* Bottom Footer Status */}
      <div className="p-3 border-t border-[#262626] bg-[#161616] flex flex-col gap-1.5 text-[11px] font-mono text-neutral-400">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-neutral-300">
            <ShieldCheck size={12} className="text-emerald-400" />
            <span>Air-Gapped Node</span>
          </span>
          <span className="text-[10px] text-emerald-400">Verified</span>
        </div>
        <div className="flex items-center justify-between text-neutral-500 text-[10px]">
          <span>Database</span>
          <span className="text-neutral-400">pgvector: connected</span>
        </div>
      </div>
    </aside>
  );
}
