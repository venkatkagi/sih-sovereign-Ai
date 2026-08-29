import React, { useState } from 'react';
import { ScanEye } from 'lucide-react';
import AgentMessageThread from '../main/AgentMessageThread';
import BottomChatBar from '../main/BottomChatBar';
import { AVAILABLE_MODELS } from '../../data/mockData';
import { uploadDocument, sendAgentMessage } from '../../services/api';

export default function OcrWorkspace({ onOpenArtifact }) {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[4]); // Qwen3-VL

  const handleSendMessage = async (userText, attachedFiles = []) => {
    const query = userText.trim() || (attachedFiles.length > 0 ? `Inspect ${attachedFiles[0].name}` : 'Run OCR inspection');
    setMessages((prev) => [...prev, { role: 'user', text: query }]);

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        isCreating: true,
        statusText: 'Processing document OCR & vector indexing...',
      }
    ]);

    try {
      if (attachedFiles && attachedFiles.length > 0) {
        for (const item of attachedFiles) {
          const rawFile = item.file || item;
          try {
            await uploadDocument(rawFile);
          } catch (uploadErr) {
            console.warn('OCR document upload error:', uploadErr);
          }
        }
      }

      let activeStatus = 'Extracting OCR tokens...';
      let streamedText = '';

      const agentResult = await sendAgentMessage({
        message: query,
        conversationId: `ocr-${Date.now()}`,
        mediaPaths: attachedFiles.map((f) => f.name),
        modelOverride: 'qwen3-vl-4b',
        stream: true,
        onEvent: (eventType, eventData, fullContent) => {
          if (eventType === 'tool_start') {
            activeStatus = `Executing ${eventData.tool}...`;
          } else if (eventType === 'token') {
            streamedText = fullContent;
          }
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              text: streamedText,
              isStreaming: true,
              statusText: activeStatus,
              modelName: 'qwen3-vl:4b',
            };
            return updated;
          });
        },
      });

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          text: agentResult?.content || streamedText || 'OCR processing complete.',
          isStreaming: false,
          modelName: 'qwen3-vl:4b',
          citations: agentResult?.citations || [],
          toolCalls: agentResult?.tool_calls || [],
        };
        return updated;
      });
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          text: `OCR Error: ${err.message}`,
          isStreaming: false,
          modelName: 'qwen3-vl:4b',
        };
        return updated;
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden justify-between py-4 select-none">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1f1f1f] border border-[#2a2a2a] flex items-center justify-center shadow-xl mb-3">
            <ScanEye size={34} className="text-amber-400" />
          </div>
          <span className="font-mono text-sm tracking-widest text-neutral-400 uppercase font-semibold">
            OCR & DRAWINGS
          </span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-y-auto">
          <AgentMessageThread messages={messages} onOpenArtifact={onOpenArtifact} />
        </div>
      )}

      <div className="pb-6">
        <BottomChatBar
          prompt={prompt}
          setPrompt={setPrompt}
          onSendMessage={handleSendMessage}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          isSpecializedView={true}
          placeholder="Attach drawing or type tag number to inspect..."
        />
      </div>
    </div>
  );
}