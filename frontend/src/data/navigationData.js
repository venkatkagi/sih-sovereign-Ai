import { FileText, Table, Code2, ScanEye, FileSpreadsheet } from 'lucide-react';

export const agentNavItems = [
  { id: 'ocr', label: 'OCR & Drawings', icon: FileText },
  { id: 'sheets', label: 'Local Sheets', icon: Table },
  { id: 'sandbox', label: 'Code Sandbox', icon: Code2 },
];

export const defaultActionChips = [
  { label: 'Draft Approval Note', icon: FileText, color: 'text-blue-400', view: 'home' },
  { label: 'Inspect Scanned P&ID', icon: ScanEye, color: 'text-amber-400', view: 'ocr' },
  { label: 'Python Sandbox Run', icon: Code2, color: 'text-emerald-400', view: 'sandbox' },
  { label: 'Cost Calculation Sheet', icon: FileSpreadsheet, color: 'text-cyan-400', view: 'sheets' },
];