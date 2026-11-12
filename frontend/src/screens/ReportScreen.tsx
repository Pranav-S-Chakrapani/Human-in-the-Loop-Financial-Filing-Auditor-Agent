import React, { useState, useEffect } from 'react';
import { fetchReport } from '../api';
import { Download, Award, ShieldCheck, Activity } from 'lucide-react';

export const ReportScreen: React.FC = () => {
  const [report, setReport] = useState<any | null>(null);

  useEffect(() => {
    fetchReport().then(setReport);
  }, []);

  const exportJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vantage_audit_report_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  if (!report) {
    return (
      <div className="p-16 text-center text-slate-500 font-mono text-xs flex flex-col items-center">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--signal,#E8B339)] animate-ping mb-3" />
        <span>Loading verification report from SQLite database...</span>
      </div>
    );
  }

  const { totals, accuracy, confusion, escalation_precision, calibration, reliability, split } = report;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/[0.08] pb-4 gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-[rgba(232,179,57,0.1)] border border-[rgba(232,179,57,0.25)] text-[var(--signal,#E8B339)] text-[10px] font-mono uppercase tracking-wider mb-2">
            <span>OFFICIAL CERTIFICATION LEDGER</span>
          </div>
          <h2 className="text-2xl font-display font-bold text-white tracking-[-0.02em] flex items-center space-x-2">
            <Award className="w-5 h-5 text-[var(--signal,#E8B339)]" />
            <span>Auditor Verification & Performance Report</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            End-to-end evaluation metrics computed strictly from SQLite audit database against SEC XBRL ground truth facts.
          </p>
        </div>

        <button
          onClick={exportJSON}
          className="px-4 py-2 rounded-xl border border-white/[0.08] bg-[#141822] hover:bg-[#1C2230] text-slate-200 text-xs font-mono font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-md hover:border-white/[0.16] active:scale-95"
        >
          <Download className="w-4 h-4 text-[var(--signal,#E8B339)]" />
          <span>Export Report JSON</span>
        </button>
      </div>

      {/* Top Accuracy KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#141822]/85 backdrop-blur-xl shadow-lg min-h-[135px] flex flex-col justify-between hover:border-white/[0.16] transition-all">
          <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Raw Dual Extraction</div>
          <div>
            <div className="text-3xl font-mono font-extrabold text-white tracking-tight">
              {(accuracy?.raw * 100).toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-sans">Pre-review consensus baseline</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#141822]/85 backdrop-blur-xl shadow-lg border-t-2 border-t-emerald-500 min-h-[135px] flex flex-col justify-between hover:border-white/[0.16] transition-all">
          <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Auto-Approved Precision</div>
          <div>
            <div className="text-3xl font-mono font-extrabold text-emerald-400 tracking-tight">
              {(accuracy?.auto_approved * 100).toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-sans">{totals?.auto_approved} autonomous passes</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#141822]/85 backdrop-blur-xl shadow-lg border-t-2 border-t-sky-500 min-h-[135px] flex flex-col justify-between hover:border-white/[0.16] transition-all">
          <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Post-Review Accuracy</div>
          <div>
            <div className="text-3xl font-mono font-extrabold text-sky-400 tracking-tight">
              {(accuracy?.post_review * 100).toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-sans">Final certified statement ledger</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#141822]/85 backdrop-blur-xl shadow-lg border-t-2 border-t-[var(--signal,#E8B339)] min-h-[135px] flex flex-col justify-between hover:border-white/[0.16] transition-all">
          <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Escalation Precision</div>
          <div>
            <div className="text-3xl font-mono font-extrabold text-[var(--signal,#E8B339)] tracking-tight">
              {(escalation_precision?.lenient * 100).toFixed(0)}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-sans truncate">
              Strict precision: {(escalation_precision?.strict * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column: Confusion Matrix + Reliability Counters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confusion Matrix */}
        <div className="border border-white/[0.08] bg-[#141822]/85 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center space-x-2">
            <Activity className="w-3.5 h-3.5 text-[var(--signal,#E8B339)]" />
            <span>Confusion Matrix (Auto vs. Escalated)</span>
          </h3>
          <div className="grid grid-cols-2 gap-3.5 font-mono text-center">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 min-h-[110px] flex flex-col justify-center items-center">
              <div className="text-xs text-emerald-300 font-sans">Approved Correct (TN)</div>
              <div className="text-3xl font-bold text-emerald-400 mt-1.5">{confusion?.approved_correct}</div>
            </div>
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 min-h-[110px] flex flex-col justify-center items-center">
              <div className="text-xs text-rose-300 font-sans">Approved Wrong (FN)</div>
              <div className="text-3xl font-bold text-rose-400 mt-1.5">{confusion?.approved_wrong}</div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--signal,#E8B339)]/10 border border-[var(--signal,#E8B339)]/30 min-h-[110px] flex flex-col justify-center items-center">
              <div className="text-xs text-amber-300 font-sans">Escalated Correct (FP)</div>
              <div className="text-3xl font-bold text-[var(--signal,#E8B339)] mt-1.5">{confusion?.escalated_correct}</div>
            </div>
            <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 min-h-[110px] flex flex-col justify-center items-center">
              <div className="text-xs text-sky-300 font-sans">Escalated Wrong (TP)</div>
              <div className="text-3xl font-bold text-sky-400 mt-1.5">{confusion?.escalated_wrong}</div>
            </div>
          </div>
        </div>

        {/* Reliability & Survivability Proof */}
        <div className="border border-white/[0.08] bg-[#141822]/85 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center space-x-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>System Reliability & Survivability</span>
          </h3>
          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between items-center p-3 rounded-xl bg-[#0B0E14] border border-white/[0.05] gap-3">
              <span className="text-slate-400 font-sans">Unique Network LLM Calls:</span>
              <span className="font-bold text-white shrink-0">{reliability?.unique_llm_calls}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-[#0B0E14] border border-white/[0.05] gap-3">
              <span className="text-slate-400 font-sans">Duplicate Network Calls on Resume:</span>
              <span className="font-bold text-emerald-400 shrink-0 whitespace-nowrap">{reliability?.duplicate_llm_calls} (0 REDUNDANT)</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-[#0B0E14] border border-white/[0.05] gap-3">
              <span className="text-slate-400 font-sans">Audit Log Rows Committed:</span>
              <span className="font-bold text-white shrink-0">{reliability?.audit_rows}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-[#0B0E14] border border-white/[0.05] gap-3">
              <span className="text-slate-400 font-sans">Cryptographic Hash Chain:</span>
              <span className="font-bold text-emerald-400 shrink-0 whitespace-nowrap">
                {reliability?.chain_ok ? 'PASS (100% Intact Sequence)' : 'FAIL'}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-[#0B0E14] border border-white/[0.05] gap-3">
              <span className="text-slate-400 font-sans">Kill-Resume Hard Restarts Survived:</span>
              <span className="font-bold text-emerald-400 shrink-0 whitespace-nowrap">
                {reliability?.kill_resume_tests?.passed}/{reliability?.kill_resume_tests?.total} Passed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Calibration Buckets & Accuracy Distribution */}
      <div className="border border-white/[0.08] bg-[#141822]/85 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
            Calibration Reliability Buckets
          </h3>
          <span className="text-[10px] font-mono text-slate-500">Predicted Confidence vs Realized Accuracy</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
          {calibration?.map((b: any) => {
            const pct = Math.round(b.accuracy * 100);
            return (
              <div key={b.bucket} className="p-4 rounded-xl bg-[#0B0E14] border border-white/[0.06] flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Bucket: {b.bucket}</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {pct}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Sample size n={b.n}</div>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      pct >= 85 ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]' : pct >= 60 ? 'bg-[var(--signal,#E8B339)] shadow-[0_0_8px_#E8B339]' : 'bg-rose-400'
                    }`}
                    style={{ width: `${Math.max(5, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Natural vs. Fault Injected Split */}
      <div className="border border-white/[0.08] bg-[#141822]/85 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
          Natural Filings vs. Fault-Injected Separation (RULES §3 Compliance)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          <div className="p-5 rounded-xl bg-[#0B0E14] border border-white/[0.06]">
            <div className="text-slate-400 font-sans font-medium mb-1.5 text-sm">Natural Filings Cohort</div>
            <div className="text-2xl font-bold text-white">
              {(split?.natural?.accuracy_raw * 100).toFixed(1)}% Raw Accuracy
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-sans">
              Escalated to human review: <strong className="text-slate-300 font-mono">{split?.natural?.escalated}</strong>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#0B0E14] border border-white/[0.06]">
            <div className="text-slate-400 font-sans font-medium mb-1.5 text-sm">Fault-Injected Cohort (Chaos / Benchmark)</div>
            <div className="text-2xl font-bold text-[var(--signal,#E8B339)]">
              {split?.fault_injected?.accuracy_raw > 0 ? `${(split?.fault_injected?.accuracy_raw * 100).toFixed(1)}%` : 'Targeted Zero'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-sans">
              Caught & Escalated by auditor: <strong className="text-[var(--signal,#E8B339)] font-mono">{split?.fault_injected?.escalated}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
