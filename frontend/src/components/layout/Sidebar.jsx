import React from 'react';
import { 
  MessageSquare, 
  ScanEye, 
  FileSpreadsheet, 
  Code2, 
  Plus, 
  PanelLeftClose, 
  PanelLeftOpen,
  Pin,
  Trash2,
  Cpu
} from 'lucide-react';

export default function Sidebar({
  activeView,
  setActiveView,
  onNewChat,
  sessions = [],
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onTogglePin,
  isOpen,
  onToggle
}) {
  const pinnedSessions = sessions.filter((s) => s.isPinned);
  const recentSessions = sessions.filter((s) => !s.isPinned);

  return (
    <aside
      className={`${
        isOpen ? 'w-64' : 'w-16'
      } h-screen bg-[#111111] border-r border-[#222222] flex flex-col justify-between transition-all duration-300 select-none z-30 shrink-0`}
    >
      {/* Top Header & Navigation */}
      <div className="p-3 flex flex-col gap-4">
        {/* Brand & Toggle */}
        <div className="flex items-center justify-between px-1.5 py-1">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-[#1e1e1e] border border-[#2e2e2e] flex items-center justify-center shrink-0 text-neutral-300">
              <Cpu size={15} />
            </div>
            {isOpen && (
              <span 
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                className="font-bold text-sm tracking-wider text-neutral-100 uppercase"
              >
                VAULTMIND
              </span>
            )}
          </div>

          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#1f1f1f] transition cursor-pointer"
            title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className={`flex items-center gap-2.5 bg-[#1f1f1f] hover:bg-[#282828] border border-[#2d2d2d] text-neutral-200 hover:text-white rounded-xl py-2 px-3 transition cursor-pointer shadow-sm ${
            isOpen ? 'w-full justify-start' : 'w-10 h-10 p-0 justify-center mx-auto'
          }`}
          title="New Chat"
        >
          <Plus size={16} className="shrink-0 text-neutral-300" />
          {isOpen && <span className="text-xs font-medium">New Chat</span>}
        </button>

        {/* Workspaces List */}
        <div className="flex flex-col gap-1">
          {isOpen && (
            <span className="text-[10px] font-mono tracking-wider text-neutral-500 uppercase px-2 mb-0.5">
              Workspaces
            </span>
          )}

          <button
            onClick={() => setActiveView('home')}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
              activeView === 'home'
                ? 'bg-[#222222] text-white font-medium border border-[#333333]'
                : 'text-neutral-400 hover:bg-[#1a1a1a] hover:text-neutral-200'
            } ${!isOpen && 'justify-center px-0 w-10 h-10 mx-auto'}`}
            title="Chat"
          >
            <MessageSquare size={15} className="shrink-0" />
            {isOpen && <span>Chat</span>}
          </button>

          <button
            onClick={() => setActiveView('ocr')}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
              activeView === 'ocr'
                ? 'bg-[#222222] text-white font-medium border border-[#333333]'
                : 'text-neutral-400 hover:bg-[#1a1a1a] hover:text-neutral-200'
            } ${!isOpen && 'justify-center px-0 w-10 h-10 mx-auto'}`}
            title="OCR & Drawings"
          >
            <ScanEye size={15} className="shrink-0" />
            {isOpen && <span>OCR & Drawings</span>}
          </button>

          <button
            onClick={() => setActiveView('sheets')}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
              activeView === 'sheets'
                ? 'bg-[#222222] text-white font-medium border border-[#333333]'
                : 'text-neutral-400 hover:bg-[#1a1a1a] hover:text-neutral-200'
            } ${!isOpen && 'justify-center px-0 w-10 h-10 mx-auto'}`}
            title="Local Sheets"
          >
            <FileSpreadsheet size={15} className="shrink-0" />
            {isOpen && <span>Local Sheets</span>}
          </button>

          <button
            onClick={() => setActiveView('sandbox')}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
              activeView === 'sandbox'
                ? 'bg-[#222222] text-white font-medium border border-[#333333]'
                : 'text-neutral-400 hover:bg-[#1a1a1a] hover:text-neutral-200'
            } ${!isOpen && 'justify-center px-0 w-10 h-10 mx-auto'}`}
            title="Code Sandbox"
          >
            <Code2 size={15} className="shrink-0" />
            {isOpen && <span>Code Sandbox</span>}
          </button>
        </div>
      </div>

      {/* Chat History Section */}
      {isOpen && (
        <div className="flex-1 overflow-y-auto px-3 py-2 border-t border-[#1c1c1c] flex flex-col gap-4">
          {/* Pinned Chats */}
          {pinnedSessions.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono tracking-wider text-neutral-500 uppercase px-2 mb-0.5 flex items-center gap-1">
                <Pin size={10} className="rotate-45" /> Pinned
              </span>
              {pinnedSessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => onSelectSession(s.id)}
                  className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition ${
                    currentSessionId === s.id && activeView === 'home'
                      ? 'bg-[#222222] text-white border border-[#333333]'
                      : 'text-neutral-400 hover:bg-[#181818] hover:text-neutral-200'
                  }`}
                >
                  <span className="truncate pr-8">{s.title}</span>
                  <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(s.id);
                      }}
                      className="p-1 hover:text-white text-neutral-400"
                      title="Unpin"
                    >
                      <Pin size={12} className="rotate-45 fill-current" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(s.id);
                      }}
                      className="p-1 hover:text-red-400 text-neutral-400"
                      title="Delete Chat"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Chats */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono tracking-wider text-neutral-500 uppercase px-2 mb-0.5">
              Recent Chats
            </span>
            {recentSessions.map((s) => (
              <div
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition ${
                  currentSessionId === s.id && activeView === 'home'
                    ? 'bg-[#222222] text-white border border-[#333333]'
                    : 'text-neutral-400 hover:bg-[#181818] hover:text-neutral-200'
                }`}
              >
                <span className="truncate pr-8">{s.title}</span>
                <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(s.id);
                    }}
                    className="p-1 hover:text-white text-neutral-400"
                    title="Pin Chat"
                  >
                    <Pin size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(s.id);
                    }}
                    className="p-1 hover:text-red-400 text-neutral-400"
                    title="Delete Chat"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Air-gapped status */}
      <div className="p-3 border-t border-[#1c1c1c] text-center">
        {isOpen ? (
          <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Air-Gapped Node</span>
          </div>
        ) : (
          <div className="w-2 h-2 rounded-full bg-emerald-400 mx-auto animate-pulse" title="Air-Gapped Node" />
        )}
      </div>
    </aside>
  );
}