export const AVAILABLE_MODELS = [
  { id: 'auto', name: 'Auto Dynamic Router', tag: 'Smart Route', ollama_model: 'auto' },
  { id: 'qwen3-4b', name: 'Qwen3 4B', tag: 'Fast Text & Code', ollama_model: 'qwen3:4b', vram: '~3.2 GB' },
  { id: 'qwen3-vl-4b', name: 'Qwen3 VL 4B', tag: 'Vision & Drawing', ollama_model: 'qwen3-vl:4b', vram: '~4.5 GB' },
  { id: 'gemma3-4b', name: 'Gemma3 4B', tag: 'Multimodal', ollama_model: 'gemma3:4b', vram: '~3.8 GB' },
];


export function generateChatTitle(query, attachedFiles = []) {
  if (attachedFiles.length > 0) {
    return `Analysis: ${attachedFiles[0].name.slice(0, 20)}`;
  }
  const clean = query.trim().slice(0, 28);
  return clean.length > 0 ? `${clean}...` : 'New Conversation';
}

export function generateSmartResponse(query, attachedFiles = []) {
  const q = query.toLowerCase();

  // 1. Image generation request
  if (
    q.includes('image') || 
    q.includes('draw') || 
    q.includes('generate photo') || 
    q.includes('picture') ||
    q.includes('render')
  ) {
    const imageName = query
      .replace(/(generate|create|draw|make|an|a|image of|picture of|render)/gi, '')
      .trim() || 'Visual Concept';

    return {
      action: 'image',
      statusText: `Creating the image "${imageName}"...`,
      imageName: imageName,
      imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80',
      text: `Generated visual rendering for **"${imageName}"** inside the air-gapped sandbox environment.`,
      artifacts: []
    };
  }

  // 2. Reading document or analyzing uploaded file
  if (attachedFiles && attachedFiles.length > 0) {
    const fileName = attachedFiles[0].name;
    const isDoc = fileName.endsWith('.pdf') || fileName.endsWith('.docx') || fileName.endsWith('.txt');

    return {
      action: isDoc ? 'reading' : 'analyzing',
      statusText: isDoc ? `Reading your document "${fileName}"...` : `Analyzing file "${fileName}"...`,
      text: `Completed on-device inspection of **${fileName}** (${(attachedFiles[0].size / 1024).toFixed(1)} KB). All security parameters and entity constraints verified with zero network egress.`,
      artifacts: [
        {
          id: `art-${Date.now()}`,
          title: `${fileName.split('.')[0]}_Extracted_Specs.pdf`,
          type: 'pdf',
          date: 'Just now',
          pages: 3
        }
      ]
    };
  }

  // 3. Creating PDF / Executive Memo / Report request
  if (
    q.includes('pdf') || 
    q.includes('board note') || 
    q.includes('memo') || 
    q.includes('report') || 
    q.includes('document')
  ) {
    return {
      action: 'pdf',
      statusText: 'Creating PDF...',
      text: 'Drafted the formal technical documentation according to engineering standards ASME B31.3. Review the generated deliverables below.',
      artifacts: [
        {
          id: `art-${Date.now()}-1`,
          title: 'ASME_Compliance_Executive_Note.pdf',
          type: 'pdf',
          date: 'Just now',
          pages: 4
        },
        {
          id: `art-${Date.now()}-2`,
          title: 'Seal_Replacement_Procurement.xlsx',
          type: 'sheet',
          date: 'Just now',
          pages: 2
        }
      ]
    };
  }

  // 4. Default question / general chat response
  return {
    action: 'thinking',
    statusText: 'Thinking...',
    text: `Analysis complete. Local weights evaluated the query parameters with high confidence across on-premise execution nodes.`,
    artifacts: []
  };
}