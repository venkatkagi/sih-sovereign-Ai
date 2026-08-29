import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  FileText, 
  FileCode, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  Upload, 
  X, 
  Check, 
  HardDrive 
} from 'lucide-react';
import { fetchWorkspaceTree, uploadWorkspaceFile } from '../../services/api';

export default function ChatWorkspacePickerModal({ isOpen, onClose, onSelectFile }) {
  const [treeData, setTreeData] = useState({ directories: [] });
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('documents');
  const [uploading, setUploading] = useState(false);

  const loadTree = async () => {
    setLoading(true);
    try {
      const data = await fetchWorkspaceTree();
      if (data && data.directories) {
        setTreeData(data);
      }
    } catch (e) {
      console.error('Failed to load workspace tree:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTree();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentDir = treeData.directories?.find((d) => d.name === selectedCategory) || treeData.directories?.[0];

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadWorkspaceFile(file, selectedCategory || 'input');
      await loadTree();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const getFileIcon = (ext) => {
    switch (ext) {
      case 'pdf':
      case 'docx':
      case 'doc':
        return <FileText className="w-4 h-4 text-neutral-300 shrink-0" />;
      case 'py':
      case 'js':
      case 'json':
        return <FileCode className="w-4 h-4 text-neutral-300 shrink-0" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
        return <ImageIcon className="w-4 h-4 text-neutral-300 shrink-0" />;
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="w-4 h-4 text-neutral-300 shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-neutral-400 shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#181818] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-2xl flex flex-col text-xs text-neutral-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between bg-[#141414]">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-white" />
            <h2 className="text-sm font-semibold text-white tracking-wide">
              Select Workspace Document / File
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#262626] text-neutral-400 hover:text-white rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Directory Tabs */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-[#161616] border-b border-[#262626] overflow-x-auto">
          {treeData.directories?.map((dir) => (
            <button
              key={dir.name}
              onClick={() => setSelectedCategory(dir.name)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer ${
                selectedCategory === dir.name
                  ? 'bg-[#262626] text-white border border-[#383838]'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#202020]'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>{dir.name}/</span>
              <span className="text-[10px] text-neutral-500">({dir.files?.length || 0})</span>
            </button>
          ))}
        </div>

        {/* File List */}
        <div className="p-4 max-h-72 overflow-y-auto space-y-1.5 min-h-[160px]">
          {currentDir?.files?.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 font-mono">
              Folder is empty. Upload a file below.
            </div>
          ) : (
            currentDir?.files?.map((file) => (
              <div
                key={file.path}
                onClick={() => {
                  onSelectFile(file);
                  onClose();
                }}
                className="flex items-center justify-between p-2.5 bg-[#141414] hover:bg-[#222222] border border-[#262626] hover:border-neutral-500 rounded-xl transition cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 truncate font-mono">
                  {getFileIcon(file.extension)}
                  <span className="text-neutral-200 group-hover:text-white font-medium truncate">
                    {file.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-mono">
                  <span>{file.size_formatted}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-[#202020] text-neutral-300 rounded border border-[#303030] group-hover:bg-white group-hover:text-black transition">
                    Attach
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer: Upload Local File */}
        <div className="px-5 py-3.5 border-t border-[#262626] bg-[#141414] flex items-center justify-between">
          <label className="flex items-center gap-2 px-3 py-1.5 bg-[#202020] hover:bg-[#282828] border border-[#333333] hover:border-neutral-400 rounded-xl text-neutral-300 hover:text-white transition cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload new file to {selectedCategory}/</span>
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#262626] hover:bg-[#303030] border border-[#383838] text-white rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
