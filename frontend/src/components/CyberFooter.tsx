import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Cpu,
  Activity,
  Terminal,
  Copy,
  Check,
  FileCode2,
  ChevronRight,
  Database
} from 'lucide-react';
import { verifyAuditChain } from '../api';

export const CyberFooter: React.FC<{
  lastCheckpointTime: string;
  onOpenShortcuts: () => void;
  onOpenDevSettings?: () => void;
  demoResetEnabled?: boolean;
}> = ({
  lastCheckpointTime,
  onOpenShortcuts,
  onOpenDevSettings,
  demoResetEnabled
}) => {
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [chainVerified, setChainVerified] = useState<boolean | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 2500);
  };

  const handleCopyManifest = () => {
    const manifest = JSON.stringify(
      {
        system: "VantageAudit",
        version: "2.0.0",
        engine: "LangGraph Deterministic Graph + SQLite Checkpoints",
        compliance: "SEC EDGAR Fair Access (10 req/s, Header Injected)",
        audit: "SHA-256 Sequential Chained Ledger, Trigger-Protected",
        isolation: "XBRL Ground Truth Isolation (RULES §1)",
        status: "OPERATIONAL"
      },
      null,
      2
    );
    navigator.clipboard.writeText(manifest);
    setCopiedManifest(true);
    showFeedback("MANIFEST COPIED TO CLIPBOARD");
    setTimeout(() => setCopiedManifest(false), 2000);
  };

  const handleQuickVerifyChain = async () => {
    setIsVerifying(true);
    try {
      const res = await verifyAuditChain();
      setChainVerified(res.ok);
      showFeedback(res.ok ? `HASH CHAIN 100% VALID (${res.rows} ENTRIES)` : "CHAIN INTEGRITY ERROR");
      setTimeout(() => setChainVerified(null), 4000);
    } catch {
      setChainVerified(false);
      showFeedback("VERIFICATION FAILED");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <footer className="mt-20 border-t border-white/[0.08] bg-[#090C12]/95 backdrop-blur-2xl relative text-slate-300 font-sans z-20">
      {/* Top glowing ambient circuit accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--signal,#E8B339)]/40 to-transparent" />

      {/* Floating Micro-Feedback Badge */}
      {feedbackToast && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[#141822] border border-[var(--signal,#E8B339)]/50 text-[var(--signal,#E8B339)] font-mono text-xs font-bold shadow-[0_0_25px_rgba(232,179,57,0.35)] flex items-center space-x-2 animate-bounce">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Main Multi-Column Matrix ("Second Homepage") */}
      <div className="max-w-7xl mx-auto px-6 py-14 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 items-start">
          {/* Col 1: Brand & Autonomous Identity */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[rgba(232,179,57,0.12)] border border-[rgba(232,179,57,0.35)] flex items-center justify-center text-[var(--signal,#E8B339)] shadow-[0_0_16px_rgba(232,179,57,0.25)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                  <line x1="12" y1="22" x2="12" y2="15.5" />
                  <polyline points="22 8.5 12 15.5 2 8.5" />
                </svg>
              </div>
              <div>
                <span className="font-display font-bold text-white text-base tracking-tight">VantageAudit</span>
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.06] text-slate-400 border border-white/[0.08]">v2.0 PRO</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-sm">
              Regulatory financial intelligence engine with dual rules + visual LLM consensus,
              four-tier balance sheet validation, human-in-the-loop state interrupts, and crash-resilient SQLite checkpointer durability.
            </p>

            {/* Proof Indicators */}
            <div className="flex flex-wrap gap-2 pt-1 font-mono text-[10px]">
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#0E121A] border border-white/[0.06] text-emerald-400">
                <ShieldCheck className="w-3 h-3" />
                <span>XBRL Isolated (RULES §1)</span>
              </div>
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#0E121A] border border-white/[0.06] text-sky-400">
                <Cpu className="w-3 h-3" />
                <span>Zero Redundant LLM</span>
              </div>
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#0E121A] border border-white/[0.06] text-amber-400">
                <Database className="w-3 h-3" />
                <span>AsyncSqlite Checkpointer</span>
              </div>
            </div>
          </div>

          {/* Col 2: System Consoles */}
          <div className="space-y-3 font-mono text-xs">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-[var(--signal,#E8B339)]" />
              <span>Consoles</span>
            </h4>
            <ul className="space-y-2 text-slate-400">
              <li>
                <Link to="/" className="hover:text-white transition-colors flex items-center space-x-1">
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>Overview & 3D Stage</span>
                </Link>
              </li>
              <li>
                <Link to="/mission" className="hover:text-white transition-colors flex items-center space-x-1">
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>Mission Control</span>
                </Link>
              </li>
              <li>
                <Link to="/reviews" className="hover:text-white transition-colors flex items-center space-x-1">
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>Review Workbench</span>
                </Link>
              </li>
              <li>
                <Link to="/metrics" className="hover:text-white transition-colors flex items-center space-x-1">
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>Metrics Grid</span>
                </Link>
              </li>
              <li>
                <Link to="/audit" className="hover:text-white transition-colors flex items-center space-x-1">
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>Audit Ledger</span>
                </Link>
              </li>
              <li>
                <Link to="/report" className="hover:text-white transition-colors flex items-center space-x-1">
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span>Executive Report</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Specifications & Protocols */}
          <div className="space-y-3 font-mono text-xs">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white flex items-center space-x-1.5">
              <FileCode2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Specifications</span>
            </h4>
            <ul className="space-y-2 text-slate-400">
              <li className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Dual Consensus Protocol</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                <span>4-Way Integrity Equations</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>State Interrupt Triage</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>SHA-256 Digest Chain</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                <span>Chaos & Fault Injection</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Interactive Quick-Actions & Proof */}
          <div className="space-y-3 font-mono text-xs">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-white flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tactile Controls</span>
            </h4>

            {/* Quick Verify Chain Button (Tactile Dip!) */}
            <button
              onClick={handleQuickVerifyChain}
              disabled={isVerifying}
              className={`w-full py-2 px-3 rounded-xl border text-xs font-mono font-bold flex items-center justify-between transition-all cursor-pointer active:scale-[0.97] active:translate-y-0.5 ${
                chainVerified === true
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : 'bg-white/[0.04] border-white/10 hover:border-emerald-500/50 text-slate-200 hover:text-white'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verify Audit Chain</span>
              </span>
              <span className="text-[10px] text-emerald-400">
                {isVerifying ? 'Checking...' : chainVerified ? '✓ Valid' : 'RUN'}
              </span>
            </button>

            {/* Copy Manifest Button (Tactile Dip!) */}
            <button
              onClick={handleCopyManifest}
              className="w-full py-2 px-3 rounded-xl border border-white/10 bg-white/[0.04] hover:border-[var(--signal,#E8B339)]/50 text-slate-200 hover:text-white text-xs font-mono font-bold flex items-center justify-between transition-all cursor-pointer active:scale-[0.97] active:translate-y-0.5"
            >
              <span className="flex items-center space-x-1.5">
                <Copy className="w-3.5 h-3.5 text-[var(--signal,#E8B339)]" />
                <span>Export System Spec</span>
              </span>
              <span className="text-[10px] text-[var(--signal,#E8B339)]">
                {copiedManifest ? 'COPIED' : 'JSON'}
              </span>
            </button>

            {/* Keyboard Shortcuts Trigger (Tactile Dip!) */}
            <button
              onClick={onOpenShortcuts}
              className="w-full py-2 px-3 rounded-xl border border-white/10 bg-white/[0.04] hover:border-sky-500/50 text-slate-200 hover:text-white text-xs font-mono font-bold flex items-center justify-between transition-all cursor-pointer active:scale-[0.97] active:translate-y-0.5"
            >
              <span className="flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                <span>Shortcut Reference</span>
              </span>
              <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[10px] text-slate-400">?</kbd>
            </button>

            {demoResetEnabled && onOpenDevSettings && (
              <button
                onClick={onOpenDevSettings}
                className="w-full py-2 px-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-mono font-bold flex items-center justify-between transition-all cursor-pointer active:scale-[0.97] active:translate-y-0.5"
              >
                <span>Demo Reset Station</span>
                <span className="text-[10px]">CONFIG</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Keyboard Shortcuts Ticker Strip */}
        <div className="pt-6 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-2 text-slate-400">
            <span className="text-slate-500 uppercase tracking-wider text-[10px] mr-1">Global Keys:</span>
            <span className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-[#0E121A] border border-white/[0.06]">
              <kbd className="text-emerald-400 font-bold">A</kbd>
              <span className="text-[11px] text-slate-300">Approve</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-[#0E121A] border border-white/[0.06]">
              <kbd className="text-[var(--signal,#E8B339)] font-bold">E</kbd>
              <span className="text-[11px] text-slate-300">Edit</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-[#0E121A] border border-white/[0.06]">
              <kbd className="text-rose-400 font-bold">R</kbd>
              <span className="text-[11px] text-slate-300">Reject</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-[#0E121A] border border-white/[0.06]">
              <kbd className="text-sky-400 font-bold">P</kbd>
              <span className="text-[11px] text-slate-300">Presenter HUD</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-[#0E121A] border border-white/[0.06]">
              <kbd className="text-purple-400 font-bold">?</kbd>
              <span className="text-[11px] text-slate-300">Cheatsheet</span>
            </span>
          </div>

          {/* Live Checkpointer Status Badge */}
          <div className="flex items-center space-x-2 text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10B981]" />
            <span>SQLite Checkpointed · Last snapshot <strong className="text-white">{lastCheckpointTime}</strong></span>
          </div>
        </div>

        {/* Bottom Baseline Bar */}
        <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-slate-500 gap-3">
          <div className="flex items-center space-x-2">
            <span>© 2026 VANTAGE AUDIT CONSORTIUM</span>
            <span>·</span>
            <span>SEC EDGAR CIK COMPLIANT</span>
            <span>·</span>
            <span>ALL RIGHTS RESERVED</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-emerald-400 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>NODES OPERATIONAL</span>
            </span>
            <span>SHA-256 LEDGER SECURED</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
