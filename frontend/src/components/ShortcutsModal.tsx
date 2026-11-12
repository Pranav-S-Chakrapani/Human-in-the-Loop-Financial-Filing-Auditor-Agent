import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'A', action: 'Approve current actionable review' },
    { key: 'E', action: 'Edit and enter correction mode' },
    { key: 'R', action: 'Reject current actionable review' },
    { key: '?', action: 'Toggle this keyboard shortcuts overlay' },
    { key: 'P', action: 'Toggle presenter mode (enlarges KPI counters)' },
    { key: 'Escape', action: 'Close dialogs or cancel edit mode' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 text-sky-400 mb-4">
          <Keyboard className="w-5 h-5" />
          <h3 className="text-base font-bold text-white">Keyboard Shortcuts</h3>
        </div>

        <div className="space-y-3 font-mono text-xs">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-300 font-sans">{s.action}</span>
              <kbd className="px-2 py-1 rounded bg-slate-800 text-sky-400 font-bold border border-slate-700">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center text-slate-500 text-xs">
          Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
};
