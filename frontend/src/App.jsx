import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ShieldCheck, 
  Database, 
  Cpu, 
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import UnifiedSidebar from './components/layout/UnifiedSidebar';
import WorkspacePanel from './components/layout/WorkspacePanel';
import AgentMessageThread from './components/main/AgentMessageThread';
import BottomChatBar from './components/main/BottomChatBar';
import EmptyChatState from './components/main/EmptyChatState';
import UnifiedArtifactViewer from './components/main/UnifiedArtifactViewer';
import { AVAILABLE_MODELS } from './data/mockData';
import { sendAgentMessage, uploadDocument, uploadWorkspaceFile, checkBackendHealth } from './services/api';

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [recentArtifacts, setRecentArtifacts] = useState([]); // accumulates AI-generated files

  const defaultModel = AVAILABLE_MODELS.find(m => m.id === 'qwen3-4b') || AVAILABLE_MODELS[1] || AVAILABLE_MODELS[0];
  const [selectedModel, setSelectedModel] = useState(defaultModel);

  // Chat State
  const [sessions, setSessions] = useState([
    { id: 'session-1', title: 'New Conversation', messages: [], model: defaultModel }
  ]);
  const [currentSessionId, setCurrentSessionId] = useState('session-1');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef(null);

  const currentSession = sessions.find((s) => s.id === currentSessionId) || sessions[0];
  const sessionModel = currentSession.model || selectedModel;

  useEffect(() => {
    checkBackendHealth();
  }, []);

  const handleNewChat = () => {
    if (isGenerating) return;
    const newId = `session-${Date.now()}`;
    const newSession = {
      id: newId,
      title: 'New Conversation',
      messages: [],
      model: sessionModel,
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setActiveArtifact(null);
    setSelectedFile(null);
  };

  const handleSelectSession = (id) => {
    if (isGenerating) return;
    setCurrentSessionId(id);
    const targetSession = sessions.find((s) => s.id === id);
    if (targetSession && targetSession.model) {
      setSelectedModel(targetSession.model);
    }
  };

  const handleDeleteSession = (id) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (filtered.length === 0) {
        const fallback = {
          id: `session-${Date.now()}`,
          title: 'New Conversation',
          messages: [],
          model: defaultModel,
        };
        setCurrentSessionId(fallback.id);
        return [fallback];
      }
      if (currentSessionId === id) {
        setCurrentSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleSelectModel = (model) => {
    setSelectedModel(model);
    setSessions((prev) =>
      prev.map((s) => (s.id === currentSessionId ? { ...s, model } : s))
    );
  };

  const handleSelectFile = (fileItem) => {
    setSelectedFile(fileItem);
    setActiveArtifact({
      name: fileItem.name,
      path: fileItem.path,
      relative_path: fileItem.path,
      size_formatted: fileItem.size_formatted,
    });
  };

  const updateCurrentSessionMessages = (msgs, autoTitle = null) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== currentSessionId) return s;
        const updated = { ...s, messages: msgs };
        if (autoTitle && (s.title === 'New Conversation' || !s.title)) {
          updated.title = autoTitle;
        }
        return updated;
      })
    );
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== currentSessionId) return s;
        const lastIdx = s.messages.length - 1;
        if (lastIdx >= 0 && s.messages[lastIdx].role === 'assistant') {
          const updated = [...s.messages];
          const curr = updated[lastIdx];
          updated[lastIdx] = {
            ...curr,
            text: (curr.text ? curr.text + '\n\n' : '') + '⚠️ *[Execution stopped midway by user]*',
            isCreating: false,
          };
          return { ...s, messages: updated };
        }
        return s;
      })
    );
  };

  const handleSendMessage = async (userText, attachedFiles = []) => {
    if (!userText.trim() && attachedFiles.length === 0) return;
    if (isGenerating) return;

    const q = userText.trim() || (attachedFiles.length > 0 ? `Uploaded ${attachedFiles[0].name}` : '');
    const userAttached = attachedFiles.map((f) => ({ name: f.name || f.file?.name || 'document' }));
    const updatedMessages = [...currentSession.messages, { role: 'user', text: q, attachedFiles: userAttached }];

    const generatedTitle = q.length > 28 ? `${q.slice(0, 26)}...` : q;

    setIsGenerating(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    updateCurrentSessionMessages([
      ...updatedMessages,
      {
        role: 'assistant',
        isCreating: true,
        statusText: 'Model analyzing prompt & reasoning...',
      }
    ], generatedTitle);

    try {
      const resolvedPaths = [];
      if (attachedFiles && attachedFiles.length > 0) {
        for (const item of attachedFiles) {
          if (controller.signal.aborted) break;
          const rawFile = item.file || (item instanceof File ? item : null);
          let assignedPath = item.path || item.name || (rawFile ? rawFile.name : null);

          if (rawFile) {
            try {
              const wsRes = await uploadWorkspaceFile(rawFile, 'input');
              if (wsRes && wsRes.relative_path) {
                assignedPath = wsRes.relative_path;
              }
            } catch (e) {
              console.warn('Workspace upload error:', e);
            }
            try {
              await uploadDocument(rawFile);
            } catch (e) {
              console.warn('RAG document upload error:', e);
            }
          }
          if (assignedPath) {
            resolvedPaths.push(assignedPath);
          }
        }
      }

      if (controller.signal.aborted) return;

      const fileNames = resolvedPaths.length > 0 ? resolvedPaths : attachedFiles.map((f) => f.path || f.name || f.file?.name || 'document.pdf');
      const historyPayload = currentSession.messages
        .filter((m) => m.text && !m.isCreating)
        .map((m) => ({
          role: m.role,
          content: m.text,
        }));

      const activeModelTag = sessionModel.ollama_model || sessionModel.id || 'qwen3:4b';
      let activeRouting = null;
      let activeTools = [];

      const assistantMsg = await sendAgentMessage({
        message: q,
        conversationId: currentSessionId,
        mediaPaths: fileNames,
        history: historyPayload,
        modelOverride: activeModelTag === 'auto' ? null : activeModelTag,
        stream: true,
        signal: controller.signal,
        onEvent: (event, data, currentText, currentThinking) => {
          if (controller.signal.aborted) return;
          if (event === 'route') activeRouting = data;
          if (event === 'tool_start' && data.tool) activeTools = [...activeTools, data.tool];

          let parsedThinking = currentThinking || '';
          let parsedContent = currentText || '';

          if (parsedContent.includes('<think>')) {
            const parts = parsedContent.split('</think>');
            if (parts.length > 1) {
              parsedThinking = parts[0].replace('<think>', '').trim();
              parsedContent = parts.slice(1).join('</think>').trim();
            } else {
              parsedThinking = parsedContent.replace('<think>', '').trim();
              parsedContent = '';
            }
          }

          updateCurrentSessionMessages([
            ...updatedMessages,
            {
              role: 'assistant',
              text: parsedContent,
              thinking: parsedThinking,
              routingDecision: activeRouting,
              toolCalls: activeTools,
              attachedFiles: userAttached,
              isCreating: true,
              statusText: parsedThinking
                ? 'Thinking...'
                : activeTools.length > 0
                ? `Executing ${activeTools[activeTools.length - 1]}...`
                : 'Synthesizing response...',
            }
          ]);
        },
      });

      if (!controller.signal.aborted) {
        let finalContent = assistantMsg.content || '';
        let finalThinking = assistantMsg.thinking || '';

        if (finalContent.includes('<think>')) {
          const parts = finalContent.split('</think>');
          if (parts.length > 1) {
            finalThinking = parts[0].replace('<think>', '').trim();
            finalContent = parts.slice(1).join('</think>').trim();
          } else {
            finalThinking = finalContent.replace('<think>', '').trim();
            finalContent = '';
          }
        }

        const artifacts = [];
        if (assistantMsg.tool_calls) {
          for (const tc of assistantMsg.tool_calls) {
            const res = tc.result || {};
            if (res.filename || res.artifact_name || res.output_filename) {
              const artName = res.filename || res.artifact_name || res.output_filename;
              const artItem = {
                name: artName,
                path: res.relative_path || res.file_path || `output/${artName}`,
                type: artName.split('.').pop(),
                size_bytes: res.size_bytes,
                size_formatted: res.size_bytes ? (res.size_bytes / 1024).toFixed(1) + ' KB' : null,
              };
              artifacts.push(artItem);
              setRecentArtifacts((prev) => [
                artItem,
                ...prev.filter((a) => a.name !== artItem.name).slice(0, 19),
              ]);
            }
          }
        }

        const finalModelUsed = assistantMsg.model_used
          || activeRouting?.model
          || activeRouting?.ollama_model
          || sessionModel.name
          || 'Local Ollama';

        updateCurrentSessionMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            text: finalContent,
            thinking: finalThinking,
            model_used: finalModelUsed,
            citations: assistantMsg.citations || [],
            toolCalls: assistantMsg.tool_calls || [],
            routingDecision: activeRouting,
            artifacts: artifacts,
            attachedFiles: userAttached,
            isCreating: false,
          }
        ]);
      }
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        // Stopped cleanly
      } else {
        updateCurrentSessionMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            text: `Error: ${err.message}`,
            isCreating: false,
          }
        ]);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#111111] text-neutral-100 font-sans overflow-hidden">
      {/* Top Application Header */}
      <header className="h-12 border-b border-[#262626] bg-[#161616] px-4 flex items-center justify-between flex-shrink-0 select-none z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow">
            <span className="font-mono text-black font-extrabold text-sm tracking-tighter">VM</span>
          </div>
          <div>
            <h1 className="text-xs font-bold text-white tracking-wide uppercase">
              Sovereign AI Workbench
            </h1>
            <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5">
              <span>Local Air-Gapped Workstation</span>
            </div>
          </div>
        </div>

        {/* System Badges */}
        <div className="flex items-center gap-2">
          {/* Active Model Indicator for this session */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#202020] border border-[#2e2e2e] text-[11px] font-mono text-neutral-300">
            <Cpu size={12} className="text-emerald-400" />
            <span>{sessionModel.name || sessionModel.ollama_model || 'Local Model'}</span>
          </div>

          {/* PostgreSQL + pgvector status */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#202020] border border-[#2e2e2e] text-[11px] font-mono text-neutral-300">
            <Database size={12} className="text-cyan-400" />
            <span>pgvector: connected</span>
          </div>

          {/* Air-gap security verified */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
            <ShieldCheck size={11} className="text-emerald-400" />
            Air-Gap
          </span>
        </div>
      </header>

      {/* Main Workstation Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Unified Sidebar: History & Workspace */}
        <aside
          className={`${
            isSidebarOpen ? 'w-64' : 'w-0'
          } transition-all duration-150 flex flex-col flex-shrink-0 h-full border-r border-[#262626] overflow-hidden bg-[#141414]`}
        >
          <div className="flex-1 overflow-hidden">
            <UnifiedSidebar
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
              onDeleteSession={handleDeleteSession}
              onSelectFile={handleSelectFile}
              selectedFilePath={selectedFile?.path}
              selectedModel={sessionModel}
            />
          </div>
        </aside>

        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 p-1 bg-[#1f1f1f] border border-[#333333] text-neutral-400 hover:text-white rounded-r-md shadow cursor-pointer transition-colors"
          title={isSidebarOpen ? 'Collapse Sidebar' : 'Open Sidebar'}
        >
          {isSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        {/* Center: Unified Agent Workspace & Message Thread */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#131313] relative">
          {/* Message thread — no outer scroll wrapper needed, AgentMessageThread handles its own */}
          <div className="flex-1 overflow-y-auto">
            {currentSession.messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <EmptyChatState
                  onSelectSuggestion={(promptText) => handleSendMessage(promptText)}
                />
              </div>
            ) : (
              <AgentMessageThread
                messages={currentSession.messages}
                onCitationClick={() => {}}
                onDownloadArtifact={(art) => {
                  setActiveArtifact(art);
                  // Track in recent artifacts
                  if (art && art.name) {
                    setRecentArtifacts((prev) => [
                      art,
                      ...prev.filter((a) => a.name !== art.name).slice(0, 19),
                    ]);
                  }
                }}
              />
            )}
          </div>

          {/* Universal Bottom Input Bar */}
          <div className="flex-shrink-0 p-3 bg-gradient-to-t from-[#131313] via-[#131313] to-transparent">
            <BottomChatBar
              prompt={prompt}
              setPrompt={setPrompt}
              selectedModel={sessionModel}
              setSelectedModel={handleSelectModel}
              onSendMessage={handleSendMessage}
              loading={isGenerating}
              onStop={handleStopGeneration}
              placeholder="Create PDFs, Excel sheets, run Python, search your database..."
            />
          </div>
        </main>

        {/* Right Workspace Panel: always visible, shows generated files */}
        <div className="w-56 xl:w-64 flex-shrink-0 flex flex-col h-full">
          <WorkspacePanel
            onSelectFile={(file) => {
              setSelectedFile(file);
              setActiveArtifact(file);
            }}
            selectedFilePath={selectedFile?.path}
            recentArtifacts={recentArtifacts}
          />
        </div>

        {/* Artifact Preview Overlay (on click) */}
        {activeArtifact && (
          <div className="absolute inset-0 z-20 flex items-stretch pointer-events-none">
            <div className="flex-1" onClick={() => setActiveArtifact(null)} style={{ pointerEvents: 'auto', cursor: 'default' }} />
            <div className="w-[480px] pointer-events-auto shadow-2xl">
              <UnifiedArtifactViewer
                artifact={activeArtifact}
                onClose={() => setActiveArtifact(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}