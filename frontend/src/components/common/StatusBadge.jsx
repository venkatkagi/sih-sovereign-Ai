import React from 'react';

export default function StatusBadge() {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-[#162319] text-emerald-400 border border-emerald-900/60 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-medium text-xs">Air-Gap Active</span>
      </div>
      <span className="text-[10px] bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800 font-mono">
        0 KB Out
      </span>
    </div>
  );
}