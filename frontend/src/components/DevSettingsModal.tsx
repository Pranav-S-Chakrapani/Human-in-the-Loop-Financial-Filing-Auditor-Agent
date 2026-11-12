import React, { useState } from 'react';
import { Settings, Trash2, AlertTriangle, X, Check, RefreshCw } from 'lucide-react';
import { resetDemoData } from '../api';

interface DevSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetSuccess: () => void;
}

export const DevSettingsModal: React.FC<DevSettingsModalProps> = ({
  isOpen,
  onClose,
  onResetSuccess
}) => {
  const [confirmStep, setConfirmStep] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReset = async () => {
    setIsResetting(true);
    setErrorMsg(null);
    try {
      await resetDemoData();
      setConfirmStep(false);
      onResetSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset demo data');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-2 text-sky-400 mb-2 font-mono text-xs uppercase tracking-wider font-bold">
          <Settings className="w-4 h-4" />
          <span>Developer Settings · Demo Environment</span>
        </div>

        <h3 className="text-lg font-bold text-slate-100 mb-2">
          Demo System Administration
        </h3>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          Developer options enabled via <code className="text-sky-300 font-mono bg-slate-950 px-1 py-0.5 rounded">DEMO_RESET_ENABLED=true</code>.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-mono">
            {errorMsg}
          </div>
        )}

        <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/50 space-y-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200">
                Purge All Demo Data
              </div>
              <div className="text-xs text-slate-400 mt-0.5 leading-normal">
                Clears runs, node executions, metrics, validations, reviews, audit logs, and resets checkpoint stores to clean initial state.
              </div>
            </div>
          </div>

          {!confirmStep ? (
            <button
              onClick={() => setConfirmStep(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold text-xs tracking-wide transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Demo Data</span>
            </button>
          ) : (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center space-x-2 text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Confirm reset? This action is irreversible.</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  disabled={isResetting}
                  onClick={handleReset}
                  className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isResetting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Resetting...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm Reset Demo Data</span>
                    </>
                  )}
                </button>
                <button
                  disabled={isResetting}
                  onClick={() => setConfirmStep(false)}
                  className="py-2 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
