import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  FileCode, 
  Image as ImageIcon, 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  HardDrive,
  FileCheck,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  Plus
} from 'lucide-react';
import { fetchWorkspaceTree, uploadWorkspaceFile, deleteWorkspaceFile, getWorkspaceFileUrl } from '../../services/api';

export default function WorkspaceFileTree({ onSelectFile, selectedFilePath }) {
  const [treeData, setTreeData] = useState({ directories: [] });
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({
    documents: true,
    reports: true,
    projects: true,
    output: true,
    input: true,
    sandbox: false,
  });
  const [uploadingDir, setUploadingDir] = useState(null);

  const loadTree = async () => {
    setLoading(true);
    try {
      const data = await fetchWorkspaceTree();
      if (data && data.directories) {
        setTreeData(data);
      }
    } catch (e) {
      console.error('Error loading workspace tree:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  const toggleFolder = (folderName) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  const handleFileUpload = async (e, targetSubdir) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDir(targetSubdir);
    try {
      await uploadWorkspaceFile(file, targetSubdir);
      await loadTree();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadingDir(null);
      e.target.value = '';
    }
  };

  const handleDelete = async (e, path) => {
    e.stopPropagation();
    if (confirm(`Delete '${path}' from workspace?`)) {
      await deleteWorkspaceFile(path);
      await loadTree();
    }
  };

  const getFileIcon = (ext) => {
    switch (ext) {
      case 'pdf':
      case 'docx':
      case 'doc':
        return <FileText className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />;
      case 'py':
      case 'js':
      case 'json':
        return <FileCode className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
        return <ImageIcon className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />;
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />;
      case 'log':
      case 'txt':
      case 'md':
        return <FileText className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />;
      default:
        return <FileCheck className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />;
    }
  };

  const getFolderLabel = (name) => {
    switch (name.toLowerCase()) {
      case 'documents':
        return { label: 'Documents' };
      case 'output':
      case 'reports':
        return { label: 'Reports / Output' };
      case 'projects':
      case 'input':
        return { label: 'Projects' };
      case 'sandbox':
        return { label: 'Sandbox' };
      default:
        return { label: name };
    }
  };

  const renderItems = (items) => {
    return items.map((item) => {
      if (item.is_dir) {
        const isExpanded = !!expandedFolders[item.name];
        const isUploading = uploadingDir === item.name;
        const meta = getFolderLabel(item.name);
        const childCount = item.children ? item.children.length : 0;

        return (
          <div key={item.path} className="mb-1">
            <div
              className="flex items-center justify-between px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-[#222222] rounded-lg cursor-pointer group transition-colors"
              onClick={() => toggleFolder(item.name)}
            >
              <div className="flex items-center gap-2 truncate">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-neutral-300 flex-shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                )}
                <span className="truncate text-neutral-200">{meta.label}</span>
                {childCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-[#252525] border border-[#333333] text-neutral-400 rounded-full font-mono">
                    {childCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <label
                  title={`Upload into ${item.name}`}
                  className="p-1 hover:text-white rounded hover:bg-[#2c2c2c] cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Upload className="w-3 h-3 text-neutral-400 hover:text-white" />
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, item.name)}
                  />
                </label>
              </div>
            </div>

            {isUploading && (
              <div className="text-[10px] text-neutral-300 italic px-7 py-0.5 animate-pulse">
                Uploading & indexing file...
              </div>
            )}

            {isExpanded && item.children && item.children.length > 0 && (
              <div className="pl-4 border-l border-[#2a2a2a] ml-3.5 my-1 space-y-0.5">
                {renderItems(item.children)}
              </div>
            )}

            {isExpanded && (!item.children || item.children.length === 0) && !isUploading && (
              <div className="pl-7 text-[11px] text-neutral-500 italic py-0.5">
                (empty directory)
              </div>
            )}
          </div>
        );
      }

      // File item
      const isSelected = selectedFilePath === item.path;

      return (
        <div
          key={item.path}
          onClick={() => onSelectFile && onSelectFile(item)}
          className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg cursor-pointer group transition-all ${
            isSelected
              ? 'bg-[#282828] text-white border border-[#444444] shadow-sm'
              : 'text-neutral-400 hover:bg-[#202020] hover:text-neutral-200'
          }`}
        >
          <div className="flex items-center gap-2 truncate pr-2">
            {getFileIcon(item.extension)}
            <span className="truncate" title={item.name}>
              {item.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-neutral-500 font-mono">{item.size_formatted}</span>
            <a
              href={getWorkspaceFileUrl(item.path)}
              download={item.name}
              onClick={(e) => e.stopPropagation()}
              title="Download file"
              className="p-1 hover:text-white hover:bg-[#2c2c2c] rounded opacity-0 group-hover:opacity-100 transition-all"
            >
              <Download className="w-3 h-3" />
            </a>
            <button
              onClick={(e) => handleDelete(e, item.path)}
              title="Delete file"
              className="p-1 hover:text-white hover:bg-[#2c2c2c] rounded opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#141414] border-r border-[#262626] select-none">
      {/* Workspace Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#262626] bg-[#181818]">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-neutral-300" />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
            Workspace
          </span>
        </div>
        <div className="flex items-center gap-1">
          <label
            title="Upload file to workspace documents"
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-[#252525] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <input
              type="file"
              className="hidden"
              onChange={(e) => handleFileUpload(e, 'documents')}
            />
          </label>
          <button
            onClick={loadTree}
            title="Refresh workspace tree"
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-[#252525] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Directory Explorer Tree */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
        {treeData.directories && treeData.directories.length > 0 ? (
          renderItems(treeData.directories)
        ) : (
          <div className="text-center py-8 text-xs text-neutral-500">
            {loading ? 'Scanning workspace...' : 'Workspace empty.'}
          </div>
        )}
      </div>

      {/* Workspace Info Footer */}
      <div className="px-3 py-2.5 border-t border-[#262626] bg-[#111111] text-[10px] text-neutral-400 flex items-center justify-between">
        <span className="font-mono truncate">Local: workspace/</span>
        <span className="text-neutral-300 font-mono font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
          Air-Gapped
        </span>
      </div>
    </div>
  );
}
