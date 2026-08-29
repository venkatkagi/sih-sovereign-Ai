import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  FileCode, 
  Image as ImageIcon, 
  Copy, 
  Check,
  RefreshCw,
  ExternalLink,
  Table as TableIcon
} from 'lucide-react';
import { fetchSheetPreview } from '../../services/api';

export default function UnifiedArtifactViewer({ artifact, onClose }) {
  const [copied, setCopied] = useState(false);
  const [sheetData, setSheetData] = useState(null);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [textContent, setTextContent] = useState('');

  if (!artifact) return null;

  const fileName = artifact.name || artifact.title || artifact.filename || 'Artifact';
  const fileExt = fileName.split('.').pop().toLowerCase();
  const filePath = artifact.path || artifact.relative_path || (artifact.filename ? `output/${artifact.filename}` : fileName);

  const isExcel = fileExt === 'xlsx' || fileExt === 'xlsm' || fileExt === 'csv';
  const isPdf = fileExt === 'pdf';
  const isDocx = fileExt === 'docx';
  const isMarkdown = fileExt === 'md' || fileExt === 'markdown';
  const isCode = fileExt === 'py' || fileExt === 'json' || fileExt === 'txt' || fileExt === 'log';
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(fileExt);

  useEffect(() => {
    if (isExcel) {
      setLoadingSheet(true);
      fetchSheetPreview(filePath)
        .then((data) => {
          if (data && data.status === 'success') {
            setSheetData(data);
          } else {
            setSheetData(null);
          }
        })
        .catch(() => setSheetData(null))
        .finally(() => setLoadingSheet(false));
    } else if (isMarkdown || isCode) {
      if (artifact.content) {
        setTextContent(artifact.content);
      } else {
        // Fetch text content from file endpoint
        fetch(`/api/v1/workspace/file?path=${encodeURIComponent(filePath)}`)
          .then((res) => res.ok ? res.text() : '')
          .then((txt) => setTextContent(txt))
          .catch(() => setTextContent(artifact.content || ''));
      }
    }
  }, [filePath, isExcel, isMarkdown, isCode]);

  const handleCopy = () => {
    const textToCopy = textContent || artifact.content || JSON.stringify(sheetData || {}, null, 2);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadUrl = `/api/v1/workspace/file?path=${encodeURIComponent(filePath)}`;

  const renderIcon = () => {
    if (isExcel) return <FileSpreadsheet size={16} className="text-emerald-400" />;
    if (isPdf) return <FileText size={16} className="text-rose-400" />;
    if (isDocx) return <FileText size={16} className="text-blue-400" />;
    if (isCode) return <FileCode size={16} className="text-amber-400" />;
    if (isImage) return <ImageIcon size={16} className="text-purple-400" />;
    return <FileText size={16} className="text-neutral-400" />;
  };

  return (
    <aside className="w-80 lg:w-96 flex flex-col h-full bg-[#161616] border-l border-[#262626] flex-shrink-0 z-20 shadow-2xl animate-in slide-in-from-right-4 duration-200">
      {/* Top Header */}
      <div className="h-12 px-4 border-b border-[#262626] flex items-center justify-between bg-[#191919] select-none">
        <div className="flex items-center gap-2 overflow-hidden">
          {renderIcon()}
          <span className="text-xs font-semibold text-white truncate max-w-[170px]" title={fileName}>
            {fileName}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <a
            href={downloadUrl}
            download={fileName}
            className="p-1.5 rounded-lg bg-[#222222] hover:bg-[#2e2e2e] text-neutral-300 hover:text-white transition cursor-pointer"
            title="Download File"
          >
            <Download size={13} />
          </a>

          {(isMarkdown || isCode) && (
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-[#222222] hover:bg-[#2e2e2e] text-neutral-300 hover:text-white transition cursor-pointer"
              title="Copy Content"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#282828] text-neutral-400 hover:text-white transition cursor-pointer"
            title="Close Preview"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 select-text">
        {/* EXCEL SPREADSHEET PREVIEW */}
        {isExcel && (
          <div className="flex flex-col h-full">
            {loadingSheet ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-neutral-400 text-xs">
                <RefreshCw size={18} className="animate-spin text-emerald-400" />
                <span>Parsing workbook...</span>
              </div>
            ) : sheetData && sheetData.headers && sheetData.headers.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span>Sheet: <strong className="text-neutral-200">{sheetData.active_sheet || 'Sheet1'}</strong></span>
                  <span>{sheetData.total_rows} rows × {sheetData.total_cols} cols</span>
                </div>

                <div className="border border-[#2a2a2a] rounded-xl overflow-x-auto bg-[#121212] shadow-inner max-h-[500px]">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="bg-[#1f2937] text-neutral-200 border-b border-[#374151]">
                        <th className="py-2 px-2.5 text-[10px] text-neutral-400 border-r border-[#374151] w-8 text-center">#</th>
                        {sheetData.headers.map((h, i) => (
                          <th key={i} className="py-2 px-3 text-xs font-semibold whitespace-nowrap border-r border-[#374151] last:border-r-0">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222222]">
                      {sheetData.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[#1c1c1c] transition-colors">
                          <td className="py-1.5 px-2 text-[10px] text-neutral-500 border-r border-[#262626] text-center select-none bg-[#161616]">
                            {rIdx + 1}
                          </td>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="py-1.5 px-3 text-neutral-300 text-xs whitespace-nowrap border-r border-[#262626] last:border-r-0">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <a
                  href={downloadUrl}
                  download={fileName}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-700/30 hover:bg-emerald-700/50 border border-emerald-600/40 text-emerald-300 text-xs font-medium flex items-center justify-center gap-2 transition"
                >
                  <Download size={13} />
                  <span>Download .xlsx File</span>
                </a>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center gap-3 border border-dashed border-[#2e2e2e] rounded-xl">
                <FileSpreadsheet size={32} className="text-emerald-400/60" />
                <div className="text-xs text-neutral-300 font-medium">{fileName}</div>
                <p className="text-[11px] text-neutral-500">Spreadsheet created in workspace.</p>
                <a
                  href={downloadUrl}
                  download={fileName}
                  className="py-1.5 px-4 rounded-lg bg-[#282828] hover:bg-[#333333] text-xs text-white flex items-center gap-1.5"
                >
                  <Download size={12} /> Download
                </a>
              </div>
            )}
          </div>
        )}

        {/* MARKDOWN / CODE PREVIEW */}
        {(isMarkdown || isCode) && (
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
              {isMarkdown ? 'Markdown Document' : 'Source Code / Data'}
            </div>
            <pre className="p-3.5 bg-[#121212] border border-[#2a2a2a] rounded-xl text-xs font-mono text-neutral-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {textContent || artifact.content || '(Empty file content)'}
            </pre>
          </div>
        )}

        {/* PDF & DOCX CARDS */}
        {(isPdf || isDocx) && (
          <div className="flex flex-col items-center justify-center p-8 text-center gap-4 border border-[#2a2a2a] rounded-2xl bg-[#141414]">
            <div className="w-14 h-14 rounded-2xl bg-[#202020] border border-[#333333] flex items-center justify-center shadow-lg">
              {isPdf ? (
                <FileText size={28} className="text-rose-400" />
              ) : (
                <FileText size={28} className="text-blue-400" />
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">{fileName}</h4>
              <p className="text-xs text-neutral-400 mt-1 font-mono">{filePath}</p>
            </div>

            {artifact.size_formatted && (
              <span className="text-[11px] font-mono text-neutral-500">
                Size: {artifact.size_formatted}
              </span>
            )}

            <a
              href={downloadUrl}
              download={fileName}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow transition ${
                isPdf
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              <Download size={14} />
              <span>Download {isPdf ? 'PDF Document' : 'Word (.docx) Document'}</span>
            </a>
          </div>
        )}

        {/* IMAGE PREVIEW */}
        {isImage && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl overflow-hidden border border-[#2e2e2e] bg-black">
              <img
                src={downloadUrl}
                alt={fileName}
                className="w-full h-auto object-contain max-h-[400px]"
              />
            </div>
            <a
              href={downloadUrl}
              download={fileName}
              className="py-2 px-3 rounded-xl bg-[#252525] hover:bg-[#303030] text-neutral-200 text-xs font-medium flex items-center justify-center gap-2 transition"
            >
              <Download size={13} />
              <span>Save Image</span>
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
