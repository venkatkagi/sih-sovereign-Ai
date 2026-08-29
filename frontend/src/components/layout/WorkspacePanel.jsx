import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen,
  FolderClosed,
  FileText,
  FileSpreadsheet,
  FileCode,
  FilePlus2,
  Table,
  X,
  RefreshCw,
  Download,
  Eye,
  Trash2,
  Upload,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Layers,
} from 'lucide-react';
import {
  fetchWorkspaceTree,
  getWorkspaceFileUrl,
  deleteWorkspaceFile,
  uploadWorkspaceFile,
} from '../../services/api';

const FILE_ICONS = {
  pdf: <FileText size={14} className="text-red-400 flex-shrink-0" />,
  xlsx: <FileSpreadsheet size={14} className="text-emerald-400 flex-shrink-0" />,
  xls: <FileSpreadsheet size={14} className="text-emerald-400 flex-shrink-0" />,
  csv: <Table size={14} className="text-teal-400 flex-shrink-0" />,
  md: <FilePlus2 size={14} className="text-blue-400 flex-shrink-0" />,
  py: <FileCode size={14} className="text-yellow-400 flex-shrink-0" />,
  txt: <FileText size={14} className="text-neutral-400 flex-shrink-0" />,
  json: <FileCode size={14} className="text-orange-400 flex-shrink-0" />,
  default: <FileText size={14} className="text-neutral-400 flex-shrink-0" />,
};

const EXT_BADGE = {
  pdf: 'text-red-400 bg-red-950/40 border-red-800/30',
  xlsx: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/30',
  xls: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/30',
  csv: 'text-teal-400 bg-teal-950/40 border-teal-800/30',
  md: 'text-blue-400 bg-blue-950/40 border-blue-800/30',
  py: 'text-yellow-400 bg-yellow-950/40 border-yellow-800/30',
};

function getFileIcon(name) {
  const ext = (name || '').split('.').pop()?.toLowerCase();
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

function FileRow({ file, onSelect, onDelete, selectedPath }) {
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  const badge = EXT_BADGE[ext] || 'text-neutral-400 bg-[#1c1c1c] border-[#333]';
  const isSelected = file.path === selectedPath;

  return (
    <div
      onClick={() => onSelect && onSelect(file)}
      className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'bg-[#222222] text-white border border-[#333]'
          : 'hover:bg-[#1a1a1a] text-neutral-300 hover:text-white'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {getFileIcon(file.name)}
        <span className="text-xs truncate">{file.name}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {file.size_formatted && (
          <span className="text-[10px] font-mono text-neutral-600 hidden group-hover:inline">{file.size_formatted}</span>
        )}
        <span className={`text-[9px] font-mono font-bold uppercase px-1 py-0.5 rounded border ${badge}`}>
          .{ext}
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(file); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-950/50 text-neutral-500 hover:text-red-400 transition cursor-pointer"
            title="Delete"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

function FolderSection({ dir, onSelectFile, onDeleteFile, selectedPath }) {
  const [isOpen, setIsOpen] = useState(true);
  const isDirOutput = dir.name === 'output' || dir.name === 'generated';

  // Auto-open output folder
  useEffect(() => {
    if (isDirOutput) setIsOpen(true);
  }, [isDirOutput]);

  // API returns 'children' array which contains both files and subdirs
  const allFiles = (dir.children || dir.files || []).filter(c => !c.is_dir);

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[#1a1a1a] text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
      >
        {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {isOpen ? <FolderOpen size={13} className={isDirOutput ? 'text-yellow-400' : 'text-neutral-400'} /> : <FolderClosed size={13} className={isDirOutput ? 'text-yellow-400' : 'text-neutral-400'} />}
        <span className="text-[11px] font-mono font-medium flex-1 text-left">{dir.name}/</span>
        <span className="text-[10px] text-neutral-600">{allFiles.length}</span>
      </button>

      {isOpen && (
        <div className="ml-4 flex flex-col gap-0.5 mt-0.5">
          {allFiles.length === 0 ? (
            <div className="text-[10px] text-neutral-600 font-mono px-2 py-1 italic">empty</div>
          ) : (
            allFiles.map((file) => (
              <FileRow
                key={file.path}
                file={file}
                onSelect={onSelectFile}
                onDelete={onDeleteFile}
                selectedPath={selectedPath}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkspacePanel({ onSelectFile, selectedFilePath, recentArtifacts = [] }) {
  const [tree, setTree] = useState({ root: '', directories: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = React.useRef(null);

  const loadTree = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchWorkspaceTree();
    setTree(data || { root: '', directories: [] });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadTree();
    const interval = setInterval(loadTree, 8000);
    return () => clearInterval(interval);
  }, [loadTree]);

  const handleDelete = async (file) => {
    const ok = window.confirm(`Delete ${file.name}?`);
    if (!ok) return;
    await deleteWorkspaceFile(file.path);
    loadTree();
  };

  const handleUpload = async (files) => {
    for (const f of Array.from(files)) {
      setUploadStatus(`Uploading ${f.name}...`);
      try {
        await uploadWorkspaceFile(f, 'input');
      } catch (e) {
        setUploadStatus(`Error: ${e.message}`);
        setTimeout(() => setUploadStatus(''), 3000);
        return;
      }
    }
    setUploadStatus('');
    loadTree();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  // Recursively count all files in nested children
  function countFiles(nodes) {
    let n = 0;
    for (const node of nodes || []) {
      if (!node.is_dir) n++;
      else n += countFiles(node.children || []);
    }
    return n;
  }
  const totalFiles = countFiles(tree.directories || []);
  // Only show directory nodes in the folder view
  const dirNodes = (tree.directories || []).filter(d => d.is_dir);

  return (
    <div
      className={`flex flex-col h-full bg-[#141414] border-l border-[#262626] flex-shrink-0 overflow-hidden ${isDragging ? 'border-blue-500/50' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#222] bg-[#181818] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <HardDrive size={13} className="text-neutral-400" />
          <span className="text-xs font-mono font-semibold text-neutral-200 uppercase tracking-wider">Workspace</span>
          <span className="text-[10px] font-mono text-neutral-600">{totalFiles} files</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload file"
            className="p-1.5 rounded hover:bg-[#222] text-neutral-500 hover:text-white transition cursor-pointer"
          >
            <Upload size={12} />
          </button>
          <button
            type="button"
            onClick={loadTree}
            disabled={isLoading}
            title="Refresh"
            className={`p-1.5 rounded hover:bg-[#222] text-neutral-500 hover:text-white transition cursor-pointer ${isLoading ? 'animate-spin text-neutral-600' : ''}`}
          >
            <RefreshCw size={12} />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Upload status */}
      {uploadStatus && (
        <div className="px-3 py-1.5 bg-blue-950/30 border-b border-blue-800/30 text-[11px] font-mono text-blue-300">
          {uploadStatus}
        </div>
      )}

      {/* Drag hint */}
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#141414]/90 border-2 border-dashed border-blue-500 rounded pointer-events-none">
          <div className="text-blue-300 font-mono text-sm">Drop files to upload</div>
        </div>
      )}

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto p-2 relative">
        {/* Recent Artifacts from AI (shown at top) */}
        {recentArtifacts.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
              <Layers size={10} />
              Recent AI Outputs
            </div>
            <div className="flex flex-col gap-1">
              {recentArtifacts.map((art, i) => (
                <div
                  key={i}
                  onClick={() => onSelectFile && onSelectFile(art)}
                  className="group flex items-center justify-between px-3 py-2 rounded-lg bg-[#1b1b1b] border border-[#2a2a2a] hover:border-[#3a3a3a] cursor-pointer transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getFileIcon(art.name)}
                    <span className="text-xs truncate text-neutral-200">{art.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={getWorkspaceFileUrl(art.path || art.relative_path)}
                      download={art.name}
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#252525] text-neutral-500 hover:text-white transition"
                      title="Download"
                    >
                      <Download size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workspace folder tree */}
        <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
          <FolderOpen size={10} />
          All Files
        </div>

        {isLoading && dirNodes.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-neutral-600 font-mono text-xs gap-2">
            <RefreshCw size={12} className="animate-spin" /> Loading...
          </div>
        ) : dirNodes.length === 0 ? (
          <div className="text-center py-6 text-neutral-600 text-xs font-mono">
            <FolderOpen size={24} className="mx-auto mb-2 text-neutral-700" />
            No files yet.
            <br />
            <span className="text-[10px]">Ask the AI to generate files or drag &amp; drop to upload.</span>
          </div>
        ) : (
          dirNodes.map((dir, i) => (
            <FolderSection
              key={i}
              dir={dir}
              onSelectFile={onSelectFile}
              onDeleteFile={handleDelete}
              selectedPath={selectedFilePath}
            />
          ))
        )}
      </div>

      {/* Drop hint */}
      <div className="px-3 py-2 border-t border-[#222] flex items-center justify-center gap-1.5 text-[10px] font-mono text-neutral-600">
        <Upload size={10} />
        Drag &amp; drop files to upload
      </div>
    </div>
  );
}
