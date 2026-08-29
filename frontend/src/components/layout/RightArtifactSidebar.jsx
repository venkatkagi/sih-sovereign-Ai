import React from 'react';
import { X, Download, FileText, Presentation, FileSpreadsheet, Image as ImageIcon, CheckCircle, ShieldCheck } from 'lucide-react';

export default function RightArtifactSidebar({ selectedArtifact, onClose }) {
  if (!selectedArtifact) return null;

  return (
    <aside className="w-96 h-screen bg-[#141414] border-l border-[#222222] flex flex-col justify-between select-none z-30 shrink-0 animate-fadeIn">
      {/* Top Header */}
      <div className="p-4 border-b border-[#222222] flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="p-2 rounded-xl bg-[#1f1f1f] border border-[#2c2c2c] text-neutral-300">
            {selectedArtifact.type === 'image' && <ImageIcon size={16} className="text-cyan-400" />}
            {selectedArtifact.type === 'pdf' && <FileText size={16} className="text-red-400" />}
            {selectedArtifact.type === 'ppt' && <Presentation size={16} className="text-orange-400" />}
            {selectedArtifact.type === 'sheet' && <FileSpreadsheet size={16} className="text-emerald-400" />}
          </div>
          <div className="flex flex-col truncate">
            <span className="text-xs font-semibold text-neutral-100 truncate">
              {selectedArtifact.title}
            </span>
            <span className="text-[11px] text-neutral-500">
              {selectedArtifact.date || 'Generated artifact'}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#1f1f1f] transition cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Main Content Preview Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* High-Resolution Image Preview */}
        {selectedArtifact.type === 'image' && (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl overflow-hidden border border-[#2a2a2a] bg-black shadow-2xl">
              <img
                src={selectedArtifact.imageUrl}
                alt={selectedArtifact.title}
                className="w-full h-auto object-contain max-h-96"
              />
            </div>

            <div className="p-3 bg-[#1a1a1a] border border-[#262626] rounded-xl flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between text-neutral-400">
                <span>Resolution</span>
                <span className="text-neutral-200 font-mono">1920 × 1080 (HD)</span>
              </div>
              <div className="flex items-center justify-between text-neutral-400">
                <span>Color Space</span>
                <span className="text-neutral-200 font-mono">sRGB (Air-gapped)</span>
              </div>
              <div className="flex items-center justify-between text-neutral-400">
                <span>Integrity Hash</span>
                <span className="text-neutral-400 font-mono text-[10px]">sha256:7f83b...</span>
              </div>
            </div>
          </div>
        )}

        {/* PDF / Document Placeholder */}
        {selectedArtifact.type !== 'image' && (
          <div className="h-64 rounded-2xl border border-dashed border-[#2d2d2d] bg-[#181818] flex flex-col items-center justify-center p-6 text-center text-neutral-500">
            <FileText size={32} className="mb-2 text-neutral-400 opacity-60" />
            <span className="text-xs text-neutral-300 font-medium">{selectedArtifact.title}</span>
            <span className="text-[11px] text-neutral-500 mt-1">Ready for export or review</span>
          </div>
        )}

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
          <ShieldCheck size={14} className="shrink-0" />
          <span>Local on-device artifact. Zero network egress.</span>
        </div>
      </div>

      {/* Footer Download Bar */}
      <div className="p-4 border-t border-[#222222]">
        <a
          href={selectedArtifact.imageUrl || '#'}
          download={selectedArtifact.title}
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-[#222222] hover:bg-[#2b2b2b] text-neutral-200 hover:text-white border border-[#333333] py-2.5 px-4 rounded-xl text-xs font-medium transition cursor-pointer shadow-sm"
        >
          <Download size={14} />
          <span>Save Artifact Locally</span>
        </a>
      </div>
    </aside>
  );
}