import React from 'react';

export default function FooterStatus() {
  return (
    <div className="absolute bottom-4 flex flex-col items-center gap-1 text-[11px] text-neutral-500 select-none">
      <div className="flex items-center gap-4">
        <span>© 2026 VaultMind On-Prem</span>
        <span>Host: 127.0.0.1:8080</span>
        <span>GPU: RTX Dedicated</span>
        <span className="text-emerald-500 font-mono">NET_EGRESS: 0 BLOCKED</span>
      </div>
    </div>
  );
}