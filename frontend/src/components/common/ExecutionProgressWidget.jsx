import React from 'react';
import { CheckCircle2, Circle, Clock, Loader2, FileText, Cpu, AlertCircle } from 'lucide-react';

export default function ExecutionProgressWidget({
  status = 'idle', // 'idle', 'working', 'completed', 'error'
  statusMessage = 'Working...',
  attachedFile = null,
  steps = [],
  timings = null,
  error = null,
}) {
  if (status === 'idle') return null;

  return (
    <div className="w-full my-4 rounded-2xl bg-[#181818] border border-[#2a2a2a] overflow-hidden text-xs text-neutral-200 shadow-sm">
      {/* Attached File Chip like ChatGPT/Claude */}
      {attachedFile && (
        <div className="px-4 py-2.5 bg-[#141414] border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2 text-neutral-300 font-mono text-[11px] truncate">
            <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="text-neutral-500">File:</span>
            <span className="text-white font-medium truncate">
              {attachedFile.name || attachedFile}
            </span>
          </div>
          {attachedFile.size_formatted && (
            <span className="text-[10px] text-neutral-500 font-mono">
              {attachedFile.size_formatted}
            </span>
          )}
        </div>
      )}

      {/* Header Bar */}
      <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between bg-[#191919]">
        <div className="flex items-center gap-2">
          {status === 'working' && (
            <span className="w-2 h-2 rounded-full bg-white animate-pulse shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
          )}
          {status === 'completed' && (
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          )}
          {status === 'error' && (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          
          <span className="font-semibold text-white tracking-wide">
            {status === 'working' ? '● Working' : status === 'completed' ? '✓ Completed' : 'Execution Notice'}
          </span>
          <span className="text-neutral-400 text-[11px] ml-1">
            — {statusMessage}
          </span>
        </div>

        {timings?.total_ms && (
          <div className="text-[10px] font-mono text-neutral-400">
            {(timings.total_ms / 1000).toFixed(2)}s
          </div>
        )}
      </div>

      {/* Step Sequence List */}
      {steps && steps.length > 0 && (
        <div className="p-4 space-y-2.5 bg-[#161616]">
          {steps.map((step, idx) => {
            const isDone = step.status === 'completed';
            const isActive = step.status === 'active' || step.status === 'running';
            const isPending = step.status === 'pending';

            return (
              <div
                key={idx}
                className={`flex items-start gap-2.5 text-xs transition-opacity ${
                  isPending ? 'opacity-40' : 'opacity-100'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  ) : isActive ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-neutral-600" />
                  )}
                </div>

                <div className="flex-1 flex items-baseline justify-between gap-2 min-w-0">
                  <div className="truncate">
                    <span className={isDone ? 'text-neutral-200' : isActive ? 'text-white font-medium' : 'text-neutral-400'}>
                      {step.label || step.name}
                    </span>
                    {step.detail && (
                      <span className="text-[11px] text-neutral-400 ml-1.5 font-mono">
                        ({step.detail})
                      </span>
                    )}
                  </div>

                  {step.duration_ms && (
                    <span className="text-[10px] font-mono text-neutral-500 shrink-0">
                      {step.duration_ms}ms
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Error display if any */}
      {error && (
        <div className="p-3 bg-[#241717] border-t border-[#3e2222] text-red-300 text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
