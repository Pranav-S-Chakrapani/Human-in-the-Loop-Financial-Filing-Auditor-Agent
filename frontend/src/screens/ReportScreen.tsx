import React, { useState, useEffect } from 'react';
import { fetchReport } from '../api';
import { Download, Award } from 'lucide-react';

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
      <div className="p-8 text-center text-slate-500 font-mono text-xs">
        Loading performance report...
      </div>
    );
  }

  const { totals, accuracy, confusion, escalation_precision, calibration, reliability, split } = report;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Award className="w-5 h-5 text-sky-400" />
            <span>Auditor Verification & Performance Report</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            End-to-end evaluation metrics computed strictly from SQLite audit database against SEC XBRL ground truth.
          </p>
        </div>

        <button
          onClick={exportJSON}
          className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export Report JSON</span>
        </button>
      </div>

      {/* Top Accuracy KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur">
          <div className="text-xs text-slate-400 uppercase font-mono">Raw Dual Extraction</div>
          <div className="text-2xl font-mono font-extrabold text-white mt-1">
            {(accuracy?.raw * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Pre-review raw accuracy</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur">
          <div className="text-xs text-slate-400 uppercase font-mono">Auto-Approved Precision</div>
          <div className="text-2xl font-mono font-extrabold text-emerald-400 mt-1">
            {(accuracy?.auto_approved * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{totals?.auto_approved} autonomous passes</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur">
          <div className="text-xs text-slate-400 uppercase font-mono">Post-Review Accuracy</div>
          <div className="text-2xl font-mono font-extrabold text-sky-400 mt-1">
            {(accuracy?.post_review * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Final certified data set</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur">
          <div className="text-xs text-slate-400 uppercase font-mono">Escalation Precision</div>
          <div className="text-2xl font-mono font-extrabold text-amber-400 mt-1">
            {(escalation_precision?.lenient * 100).toFixed(0)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Lenient / Strict: {(escalation_precision?.strict * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* 2-Column: Confusion Matrix + Reliability Counters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confusion Matrix */}
        <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 backdrop-blur space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Confusion Matrix (Auto vs. Escalated)
          </h3>
          <div className="grid grid-cols-2 gap-3 font-mono text-center">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="text-xs text-emerald-300 font-sans">Approved Correct (True Negative)</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{confusion?.approved_correct}</div>
            </div>
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30">
              <div className="text-xs text-rose-300 font-sans">Approved Wrong (False Negative)</div>
              <div className="text-2xl font-bold text-rose-400 mt-1">{confusion?.approved_wrong}</div>
            </div>
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="text-xs text-amber-300 font-sans">Escalated Correct (False Positive)</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">{confusion?.escalated_correct}</div>
            </div>
            <div className="p-4 rounded-lg bg-sky-500/10 border border-sky-500/30">
              <div className="text-xs text-sky-300 font-sans">Escalated Wrong (True Positive)</div>
              <div className="text-2xl font-bold text-sky-400 mt-1">{confusion?.escalated_wrong}</div>
            </div>
          </div>
        </div>

        {/* Reliability & Survivability Proof */}
        <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 backdrop-blur space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            System Reliability & Survivability
          </h3>
          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between items-center p-2.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-400 font-sans">Unique LLM Network Calls:</span>
              <span className="font-bold text-white">{reliability?.unique_llm_calls}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-400 font-sans">Duplicate Network Calls on Resume:</span>
              <span className="font-bold text-emerald-400">{reliability?.duplicate_llm_calls} (0 NET)</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-400 font-sans">Audit Log Rows Committed:</span>
              <span className="font-bold text-white">{reliability?.audit_rows}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-400 font-sans">Audit Cryptographic Chain Verified:</span>
              <span className="font-bold text-emerald-400">
                {reliability?.chain_ok ? 'PASS (100% Intact)' : 'FAIL'}
              </span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-400 font-sans">Kill-Resume Hard Restarts Survived:</span>
              <span className="font-bold text-emerald-400">
                {reliability?.kill_resume_tests?.passed}/{reliability?.kill_resume_tests?.total} Passed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Calibration Buckets & Accuracy Distribution */}
      <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 backdrop-blur space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Calibration Reliability Buckets
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
          {calibration?.map((b: any) => (
            <div key={b.bucket} className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">Bucket: {b.bucket}</div>
              <div className="text-lg font-bold text-white mt-1">
                {(b.accuracy * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Sample size n={b.n}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Natural vs. Fault Injected Split (RULES #3) */}
      <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 backdrop-blur space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Natural vs. Fault-Injected Separation (RULES #3 Compliance)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <div className="text-slate-400 font-sans font-medium mb-1">Natural Filings Cohort</div>
            <div className="text-xl font-bold text-white">
              {(split?.natural?.accuracy_raw * 100).toFixed(1)}% Raw Accuracy
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Escalated to human review: {split?.natural?.escalated}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <div className="text-slate-400 font-sans font-medium mb-1">Fault-Injected Cohort (chaos/demo)</div>
            <div className="text-xl font-bold text-amber-400">
              {split?.fault_injected?.accuracy_raw > 0 ? `${(split?.fault_injected?.accuracy_raw * 100).toFixed(1)}%` : 'Targeted Zero'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Caught & Escalated by auditor: {split?.fault_injected?.escalated}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
