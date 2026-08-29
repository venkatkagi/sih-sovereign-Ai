import { Sparkles, Database, FileSpreadsheet, FileText, Code2 } from 'lucide-react';

export default function EmptyChatState({ onSelectSuggestion }) {
  const suggestions = [
    {
      icon: <Database size={16} className="text-cyan-400" />,
      title: 'Search Database & Standards',
      subtitle: 'Query pgvector for compliance protocols',
      prompt: 'Search the database for safety protocol requirements under section 4.1.',
    },
    {
      icon: <FileSpreadsheet size={16} className="text-emerald-400" />,
      title: 'Create Excel Spreadsheet',
      subtitle: 'Build formatted .xlsx workbook with items & cost',
      prompt: 'Create an Excel spreadsheet named Procurement_Schedule.xlsx with columns Part Name, Quantity, Unit Price ($), and Total ($).',
    },
    {
      icon: <FileText size={16} className="text-rose-400" />,
      title: 'Generate PDF Report',
      subtitle: 'Draft styled PDF document with tables & sign-off',
      prompt: 'Generate a PDF report titled "Industrial Compliance Assessment" summarizing audit status and safety findings.',
    },
    {
      icon: <Code2 size={16} className="text-amber-400" />,
      title: 'Python Numerical Sandbox',
      subtitle: 'Calculate Darcy-Weisbach friction loss & verify',
      prompt: 'Write a Python program to calculate pressure drop using the Darcy-Weisbach equation in a 0.2m pipe over 100m at 2.5 m/s velocity.',
    },
  ];

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto flex flex-col items-center justify-center px-4 py-8 select-none">
      {/* Silver / Grey Sparkling Glow Animation */}
      <div className="relative flex items-center justify-center mb-6">
        {/* Outer Silver Radial Ambient Glow */}
        <div className="absolute w-40 h-40 rounded-full bg-gradient-to-tr from-neutral-500/20 via-neutral-300/10 to-transparent blur-2xl animate-pulse" />
        
        {/* Sparkling Orbit Accent */}
        <div className="relative w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-[#333333] shadow-[0_0_30px_rgba(200,200,200,0.15)] flex items-center justify-center group">
          <Sparkles 
            size={28} 
            className="text-neutral-200 animate-[spin_8s_linear_infinite] drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" 
          />
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-neutral-300 animate-ping opacity-75" />
        </div>
      </div>

      {/* Main Silver Metallic Greeting */}
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-neutral-200 to-neutral-500">
          How can VaultMind assist you today?
        </h2>
        <p className="text-xs md:text-sm text-neutral-400 max-w-md mx-auto">
          Local, air-gapped intelligence for documents, drawings, and analytics.
        </p>
      </div>

      {/* Starter Suggestion Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {suggestions.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectSuggestion(item.prompt || item.title)}
            className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#191919] hover:bg-[#222222] border border-[#2a2a2a] hover:border-neutral-500 transition-all duration-200 text-left group cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(255,255,255,0.04)]"
          >
            <div className="p-2 rounded-xl bg-[#222222] border border-[#333333] group-hover:bg-[#2a2a2a] transition-colors shrink-0">
              {item.icon}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-neutral-200 group-hover:text-white transition-colors truncate">
                {item.title}
              </span>
              <span className="text-[11px] text-neutral-400 truncate mt-0.5">
                {item.subtitle}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}