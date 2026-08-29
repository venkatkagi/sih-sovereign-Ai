import React, { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import AgentMessageThread from '../main/AgentMessageThread';
import BottomChatBar from '../main/BottomChatBar';
import { AVAILABLE_MODELS } from '../../data/mockData';

export default function SheetsWorkspace({ onOpenArtifact }) {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]);

  const handleSendMessage = (userText, attachedFiles) => {
    const query = userText.trim() || (attachedFiles.length > 0 ? `Process sheet ${attachedFiles[0].name}` : 'Generate Cost Table');
    setMessages((prev) => [...prev, { role: 'user', text: query }]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          isCreating: true,
          creatingDocName: 'Procurement_Cost_Analysis.xlsx'
        }
      ]);

      setTimeout(() => {
        setMessages((prev) => {
          const updated = [...prev];
          updated.pop();
          return [
            ...updated,
            {
              role: 'assistant',
              text: `### Material Procurement & Cost Schedule\n\n| Line Item | Spec | Qty | Unit Cost ($) | Total ($) |\n| :--- | :--- | :--- | :--- | :--- |\n| **Gate Valve 4" CL300** | ASTM A216 | 12 | 1,450.00 | 17,400.00 |\n| **Centrifugal Pump Impeller** | Duplex SS | 2 | 4,800.00 | 9,600.00 |\n| **Spiral Wound Gaskets** | 316L | 50 | 45.00 | 2,250.00 |\n| **High Tensile Studs** | B7 / 2H | 120 | 18.50 | 2,220.00 |\n\n* **Subtotal:** $31,470.00\n* **5% Contingency Buffer:** $1,573.50\n* **Grand Total:** **$33,043.50**`,
              artifacts: [
                { id: `sheet-${Date.now()}`, title: 'Procurement_Cost_Analysis.xlsx', type: 'sheet', rows: 4, date: 'Just now' }
              ]
            }
          ];
        });
      }, 1000);
    }, 400);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden justify-between py-4 select-none">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1f1f1f] border border-[#2a2a2a] flex items-center justify-center shadow-xl mb-3">
            <FileSpreadsheet size={34} className="text-cyan-400" />
          </div>
          <span className="font-mono text-sm tracking-widest text-neutral-400 uppercase font-semibold">
            LOCAL SHEETS
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
          placeholder="Enter items to calculate or attach a spreadsheet..."
        />
      </div>
    </div>
  );
}