import React from 'react';

export default function ActionChips({ chips, onSelectChip }) {
  return (
    <div className="flex items-center gap-2 mt-4 flex-wrap justify-center max-w-2xl">
      {chips.map((chip, idx) => {
        const Icon = chip.icon;
        return (
          <button
            key={idx}
            onClick={() => onSelectChip(`Task Agent: ${chip.label}`)}
            className="bg-[#262626] hover:bg-[#333333] px-3.5 py-1.5 rounded-xl text-xs text-neutral-300 border border-[#2e2e2e] flex items-center gap-2 transition"
          >
            <Icon size={14} className={chip.color} />
            <span>{chip.label}</span>
          </button>
        );
      })}
    </div>
  );
}