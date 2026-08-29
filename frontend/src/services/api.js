/**
 * API Service for communicating with VaultMind Sovereign AI Backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend health check failed:', err);
  }
  return null;
}

export async function fetchAvailableModels() {
  try {
    const res = await fetch(`${API_BASE_URL}/models`);
    if (res.ok) {
      const data = await res.json();
      return data.models;
    }
  } catch (err) {
    console.warn('Failed to fetch live models from backend:', err);
  }
  return null;
}

export async function executeSandboxCode(code) {
  try {
    const res = await fetch(`${API_BASE_URL}/sandbox/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, timeout_seconds: 5 }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Error running sandbox code:', err);
  }
  return {
    success: false,
    error: 'Could not connect to local Python sandbox.',
  };
}

export async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE_URL}/stats`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to fetch stats:', err);
  }
  return null;
}

export async function uploadDocument(file, department = null) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (department) {
      formData.append('department', department);
    }

    const res = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      return await res.json();
    } else {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Upload failed with status ${res.status}`);
    }
  } catch (err) {
    console.error('Error uploading document:', err);
    throw err;
  }
}

export async function sendRAGQuery({ question, source = null, nResults = 3, modelOverride = null }) {
  try {
    const res = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        source,
        n_results: nResults,
        model_override: modelOverride,
      }),
    });

    if (res.ok) {
      return await res.json();
    } else {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `RAG query failed with status ${res.status}`);
    }
  } catch (err) {
    console.error('Error querying RAG:', err);
    throw err;
  }
}

export async function evaluateMathExpression(expression) {
  try {
    const res = await fetch(`${API_BASE_URL}/calculator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Error evaluating expression:', err);
  }
  return { success: false, error: 'Calculator endpoint unavailable.' };
}


/**
 * Send a chat message to the ReAct Agent endpoint with SSE streaming support.
 */
export async function sendAgentMessage({
  message,
  conversationId,
  mediaPaths = [],
  history = [],
  modelOverride = null,
  stream = true,
  onEvent,
  signal,
}) {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        media_paths: mediaPaths,
        history,
        model_override: modelOverride,
        stream,
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error (${response.status}): ${response.statusText}`);
    }

    if (stream && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      let fullContent = '';
      let fullThinking = '';
      let currentEvent = 'message';
      let finalResult = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.replace('event:', '').trim();
          } else if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.replace('data:', '').trim();
            try {
              const parsedData = JSON.parse(dataStr);
              if (currentEvent === 'token' && parsedData.chunk) {
                fullContent += parsedData.chunk;
              } else if (currentEvent === 'thinking' && parsedData.chunk) {
                fullThinking += parsedData.chunk;
              }
              if (currentEvent === 'done') {
                finalResult = parsedData;
              }
              if (onEvent) {
                onEvent(currentEvent, parsedData, fullContent, fullThinking);
              }
            } catch (e) {
              console.warn('Failed to parse SSE JSON chunk:', dataStr);
            }
          }
        }
      }

      return finalResult || {
        conversation_id: conversationId,
        sender: 'assistant',
        content: fullContent,
        thinking: fullThinking,
        citations: [],
        tool_calls: [],
      };
    } else {
      // Non-streaming JSON response
      const data = await response.json();
      return data;
    }
  } catch (err) {
    console.warn('Backend unavailable, falling back to local processing:', err);
    throw err;
  }
}

// ==========================================
// Workspace & SIH Demonstration Workflows APIs
// ==========================================

export async function fetchWorkspaceTree() {
  try {
    const res = await fetch(`${API_BASE_URL}/workspace/tree`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to fetch workspace tree:', err);
  }
  return { root: '', directories: [] };
}

export async function uploadWorkspaceFile(file, subdir = 'input') {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subdir', subdir);

    const res = await fetch(`${API_BASE_URL}/workspace/upload`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      return await res.json();
    } else {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Upload failed (${res.status})`);
    }
  } catch (err) {
    console.error('Workspace upload error:', err);
    throw err;
  }
}

export function getWorkspaceFileUrl(path) {
  return `${API_BASE_URL}/workspace/file?path=${encodeURIComponent(path)}`;
}

export async function deleteWorkspaceFile(path) {
  try {
    const res = await fetch(`${API_BASE_URL}/workspace/file?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Delete workspace file error:', err);
  }
  return { status: 'error' };
}

async function consumeSSE(url, payload, onEvent, signal = null) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Request failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Streaming response body is unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';
  let finalResult = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('event:')) {
        currentEvent = trimmed.replace('event:', '').trim();
      } else if (trimmed.startsWith('data:')) {
        const dataStr = trimmed.replace('data:', '').trim();
        try {
          const parsedData = JSON.parse(dataStr);
          if (currentEvent === 'task_completed' || currentEvent === 'done') {
            finalResult = parsedData;
          }
          if (onEvent) {
            onEvent(currentEvent, parsedData);
          }
        } catch (e) {
          console.warn('Failed to parse SSE JSON chunk:', dataStr);
        }
      }
    }
  }

  return finalResult;
}

export async function runDocumentApprovalWorkflow({ documentPath, prompt = null, outputFilename = null, onEvent = null, signal = null }) {
  if (onEvent) {
    return await consumeSSE(
      `${API_BASE_URL}/workspace/workflow/document-approval/stream`,
      { document_path: documentPath, prompt, output_filename: outputFilename },
      onEvent,
      signal
    );
  }
  const res = await fetch(`${API_BASE_URL}/workspace/workflow/document-approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      document_path: documentPath,
      prompt,
      output_filename: outputFilename,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Document workflow failed with status ${res.status}`);
  }
  return await res.json();
}

export async function runDocumentQAWorkflow({ documentPath, question, onEvent = null, signal = null }) {
  if (onEvent) {
    return await consumeSSE(
      `${API_BASE_URL}/workspace/workflow/document-qa/stream`,
      { document_path: documentPath, question },
      onEvent,
      signal
    );
  }
  const res = await fetch(`${API_BASE_URL}/workspace/workflow/document-qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      document_path: documentPath,
      question,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Document QA failed with status ${res.status}`);
  }
  return await res.json();
}

export async function runCodingSandboxWorkflow({ prompt, timeoutSeconds = 10, onEvent = null, signal = null }) {
  if (onEvent) {
    return await consumeSSE(
      `${API_BASE_URL}/workspace/workflow/coding-sandbox/stream`,
      { prompt, timeout_seconds: timeoutSeconds },
      onEvent,
      signal
    );
  }
  const res = await fetch(`${API_BASE_URL}/workspace/workflow/coding-sandbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      prompt,
      timeout_seconds: timeoutSeconds,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Coding workflow failed with status ${res.status}`);
  }
  return await res.json();
}

export async function runMultimodalWorkflow({ imagePath, prompt = null, onEvent = null, signal = null }) {
  if (onEvent) {
    return await consumeSSE(
      `${API_BASE_URL}/workspace/workflow/multimodal/stream`,
      { image_path: imagePath, prompt },
      onEvent,
      signal
    );
  }
  const res = await fetch(`${API_BASE_URL}/workspace/workflow/multimodal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      image_path: imagePath,
      prompt,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Multimodal workflow failed with status ${res.status}`);
  }
  return await res.json();
}

export async function runAutoRouteWorkflow({ query, onEvent = null, signal = null }) {
  if (onEvent) {
    return await consumeSSE(
      `${API_BASE_URL}/workspace/workflow/autoroute/stream`,
      { query },
      onEvent,
      signal
    );
  }
  return await consumeSSE(
    `${API_BASE_URL}/workspace/workflow/autoroute/stream`,
    { query },
    () => {},
    signal
  );
}

export async function fetchSheetPreview(path) {
  try {
    const res = await fetch(`${API_BASE_URL}/workspace/sheet/preview?path=${encodeURIComponent(path)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to fetch spreadsheet preview:', err);
  }
  return null;
}

