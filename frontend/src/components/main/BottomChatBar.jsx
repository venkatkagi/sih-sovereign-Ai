import React, { useRef, useState, useEffect } from 'react';
import { 
  Plus, 
  ChevronDown, 
  ArrowUp, 
  Square,
  FileText, 
  Image as ImageIcon, 
  FileCode,
  Folder,
  Upload,
  X,
  Cpu,
  Sparkles
} from 'lucide-react';
import { AVAILABLE_MODELS } from '../../data/mockData';
import { uploadWorkspaceFile } from '../../services/api';
import ChatWorkspacePickerModal from '../common/ChatWorkspacePickerModal';

export default function BottomChatBar({ 
  prompt, 
  setPrompt, 
  onSendMessage, 
  loading, 
  onStop = () => {},
  selectedModel, 
  setSelectedModel,
  placeholder = "Ask anything, or task a local agent...",
  attachedFiles = [],
  setAttachedFiles = () => {}
}) {
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const attachMenuRef = useRef(null);
  const modelMenuRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target)) {
        setShowAttachMenu(false);
      }
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target)) {
        setShowModelMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLocalFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    setShowAttachMenu(false);

    for (const f of files) {
      try {
        const uploadRes = await uploadWorkspaceFile(f, 'documents');
        const relPath = uploadRes.relative_path || `documents/${f.name}`;
        setAttachedFiles((prev) => [
          ...prev,
          {
            file: f,
            name: f.name,
            path: relPath,
            size_formatted: (f.size / 1024).toFixed(1) + ' KB',
          }
        ]);
      } catch (err) {
        console.warn('Auto upload error:', err);
        setAttachedFiles((prev) => [
          ...prev,
          {
            file: f,
            name: f.name,
            path: `documents/${f.name}`,
            size_formatted: (f.size / 1024).toFixed(1) + ' KB',
          }
        ]);
      }
    }
    setIsUploading(false);
    e.target.value = '';
  };

  const handleSelectWorkspaceFile = (file) => {
    setAttachedFiles((prev) => [
      ...prev,
      {
        name: file.name,
        path: file.path,
        extension: file.extension,
        size_formatted: file.size_formatted,
      }
    ]);
  };

  const removeFile = (index) => {
    setAttachedFiles(attachedFiles.filter((_, idx) => idx !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ((prompt && prompt.trim()) || attachedFiles.length > 0) {
        onSendMessage(prompt || '', attachedFiles);
        if (setPrompt) setPrompt('');
        setAttachedFiles([]);
        setShowAttachMenu(false);
        setShowModelMenu(false);
      }
    }
  };

  const handleSendClick = () => {
    if ((prompt && prompt.trim()) || attachedFiles.length > 0) {
      onSendMessage(prompt || '', attachedFiles);
      if (setPrompt) setPrompt('');
      setAttachedFiles([]);
      setShowAttachMenu(false);
      setShowModelMenu(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 relative select-none">
      {/* Attached Files Badges like ChatGPT / Claude */}
      {attachedFiles.length > 0 && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {attachedFiles.map((file, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-[#202020] border border-[#333333] px-3 py-1.5 rounded-xl text-xs text-neutral-200 shadow-sm font-mono">
              <FileText size={13} className="text-neutral-400 shrink-0" />
              <span className="truncate max-w-[180px]">{file.name}</span>
              {file.size_formatted && (
                <span className="text-[10px] text-neutral-500 font-mono">({file.size_formatted})</span>
              )}
              <button 
                type="button"
                onClick={() => removeFile(idx)} 
                className="hover:text-white text-neutral-500 ml-1 p-0.5 rounded transition cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Input Box */}
      <div className="relative bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl shadow-lg transition-all focus-within:border-neutral-500 focus-within:ring-1 focus-within:ring-neutral-500">
        <textarea
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt && setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent text-white text-sm placeholder-neutral-500 px-4 pt-3.5 pb-12 focus:outline-none resize-none overflow-y-auto max-h-36 font-sans"
        />

        {/* Action Toolbar */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-auto">
          {/* Left: Attach & Tools Menu */}
          <div className="flex items-center gap-1.5" ref={attachMenuRef}>
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-1.5 rounded-lg bg-[#242424] hover:bg-[#303030] text-neutral-400 hover:text-white border border-[#333333] transition cursor-pointer flex items-center gap-1 text-xs"
              title="Attach File or Workspace Document"
            >
              <Plus size={15} />
              <span className="text-[11px] font-medium hidden sm:inline">Attach</span>
            </button>

            {showAttachMenu && (
              <div className="absolute bottom-12 left-0 w-64 bg-[#181818] border border-[#2e2e2e] rounded-xl shadow-2xl p-1.5 z-40 text-xs text-neutral-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    setShowWorkspaceModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#262626] rounded-lg transition text-left cursor-pointer font-mono"
                >
                  <Folder size={14} className="text-white" />
                  <div>
                    <div className="font-semibold text-white">Choose from Workspace</div>
                    <div className="text-[10px] text-neutral-400">Select existing PDF/Docx/Image</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowAttachMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#262626] rounded-lg transition text-left cursor-pointer font-mono border-t border-[#262626] mt-1"
                >
                  <Upload size={14} className="text-neutral-300" />
                  <div>
                    <div className="font-semibold text-white">Upload Local File</div>
                    <div className="text-[10px] text-neutral-400">PDF, DOCX, TXT, PNG, JPG</div>
                  </div>
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleLocalFileUpload}
              className="hidden"
              multiple
            />
          </div>

          {/* Right: Model Selector & Send Button */}
          <div className="flex items-center gap-2" ref={modelMenuRef}>
            {selectedModel && setSelectedModel && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModelMenu(!showModelMenu)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#242424] hover:bg-[#2c2c2c] text-neutral-300 text-xs border border-[#333333] transition cursor-pointer font-mono"
                >
                  <Cpu size={12} className="text-neutral-400" />
                  <span className="truncate max-w-[120px]">{selectedModel.name || selectedModel}</span>
                  <ChevronDown size={11} className="text-neutral-500" />
                </button>

                {showModelMenu && (
                  <div className="absolute bottom-10 right-0 w-60 bg-[#181818] border border-[#2e2e2e] rounded-xl shadow-2xl p-1.5 z-40 text-xs text-neutral-200">
                    <div className="px-2.5 py-1 text-[10px] font-mono text-neutral-500 uppercase tracking-wider border-b border-[#262626] mb-1">
                      Local Offline Models
                    </div>
                    {AVAILABLE_MODELS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel(m);
                          setShowModelMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition text-left cursor-pointer font-mono ${
                          selectedModel.id === m.id ? 'bg-[#282828] text-white font-semibold' : 'hover:bg-[#222222] text-neutral-400'
                        }`}
                      >
                        <span className="truncate">{m.name}</span>
                        <span className="text-[10px] text-neutral-500">{m.vram || 'Auto'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Send / Stop Button */}
            {loading ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop execution"
                className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition cursor-pointer shadow-md flex items-center justify-center animate-pulse"
              >
                <Square size={14} className="fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSendClick}
                disabled={!prompt?.trim() && attachedFiles.length === 0}
                title="Send prompt"
                className="p-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold disabled:opacity-30 disabled:hover:bg-white transition cursor-pointer shadow-md"
              >
                <ArrowUp size={15} className="stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Workspace File Picker Modal */}
      <ChatWorkspacePickerModal
        isOpen={showWorkspaceModal}
        onClose={() => setShowWorkspaceModal(false)}
        onSelectFile={handleSelectWorkspaceFile}
      />
    </div>
  );
}