import React from 'react';

export const IntroScreen: React.FC = () => (
  <div className="p-8 max-w-4xl mx-auto">
    <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-8 backdrop-blur">
      <h1 className="text-3xl font-bold tracking-tight text-sky-400 mb-2">VantageAudit</h1>
      <p className="text-slate-400 text-lg mb-6">
        Human-in-the-Loop Financial Filing Auditor — verifiable extraction, accounting equation checks,
        and hash-chained durable audit trail.
      </p>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="border border-slate-800 bg-slate-950 p-4 rounded-lg">
          <div className="text-2xl font-bold text-white">Dual LLM/Rules</div>
          <div className="text-xs text-slate-400">Extractor Consensus</div>
        </div>
        <div className="border border-slate-800 bg-slate-950 p-4 rounded-lg">
          <div className="text-2xl font-bold text-emerald-400">Durable Checkpoint</div>
          <div className="text-xs text-slate-400">Survives Mid-Run Kill</div>
        </div>
        <div className="border border-slate-800 bg-slate-950 p-4 rounded-lg">
          <div className="text-2xl font-bold text-amber-400">XBRL Verified</div>
          <div className="text-xs text-slate-400">SEC Ground Truth Isolation</div>
        </div>
      </div>
    </div>
  </div>
);

export const MissionControlScreen: React.FC = () => (
  <div className="p-8 max-w-6xl mx-auto">
    <h2 className="text-2xl font-bold text-slate-100 mb-4">Mission Control</h2>
    <div className="border border-slate-800 bg-slate-900/40 rounded-lg p-6 text-slate-400">
      Pipeline execution overview, active runs, and ticker triggers.
    </div>
  </div>
);

export const ReviewWorkbenchScreen: React.FC = () => (
  <div className="p-8 max-w-6xl mx-auto">
    <h2 className="text-2xl font-bold text-slate-100 mb-4">Review Workbench</h2>
    <div className="border border-slate-800 bg-slate-900/40 rounded-lg p-6 text-slate-400">
      Human-in-the-loop review queue for low confidence or equation failures.
    </div>
  </div>
);

export const MetricsGridScreen: React.FC = () => (
  <div className="p-8 max-w-6xl mx-auto">
    <h2 className="text-2xl font-bold text-slate-100 mb-4">Metrics Grid</h2>
    <div className="border border-slate-800 bg-slate-900/40 rounded-lg p-6 text-slate-400">
      Multi-company tabular view with side-by-side comparative column metrics.
    </div>
  </div>
);

export const AuditLedgerScreen: React.FC = () => (
  <div className="p-8 max-w-6xl mx-auto">
    <h2 className="text-2xl font-bold text-slate-100 mb-4">Audit Ledger</h2>
    <div className="border border-slate-800 bg-slate-900/40 rounded-lg p-6 text-slate-400">
      Cryptographic SHA-256 hash-chained immutable audit log.
    </div>
  </div>
);

export const ReportScreen: React.FC = () => (
  <div className="p-8 max-w-6xl mx-auto">
    <h2 className="text-2xl font-bold text-slate-100 mb-4">Auditor Performance Report</h2>
    <div className="border border-slate-800 bg-slate-900/40 rounded-lg p-6 text-slate-400">
      Full confusion matrix, calibration buckets, precision metrics, and natural vs. fault-injected split.
    </div>
  </div>
);
