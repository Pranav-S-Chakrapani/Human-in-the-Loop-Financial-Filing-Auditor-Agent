import React, { useState, useEffect } from 'react';
import { fetchAudit, verifyAuditChain, tamperAuditLog } from '../api';
import { ShieldCheck, Lock, AlertOctagon, CheckCircle2, XCircle } from 'lucide-react';

export const AuditLedgerScreen: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [verifyStatus, setVerifyStatus] = useState<any | null>(null);
  const [tamperResult, setTamperResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAudit = () => {
    fetchAudit().then(setEntries);
  };

  useEffect(() => {
    loadAudit();
  }, []);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await verifyAuditChain();
      setVerifyStatus(res);
    } finally {
      setLoading(false);
    }
  };

  const handleTamper = async () => {
    try {
      const res = await tamperAuditLog();
      setTamperResult(res);
      // Re-verify after tamper attempt to prove integrity
      handleVerify();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            <span>Cryptographic Audit Ledger</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Append-only SQLite log with SHA-256 hash chaining: row_hash = sha256(prev_hash + canonical_json(row)).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleVerify}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verify Integrity</span>
          </button>

          <button
            onClick={handleTamper}
            className="px-3.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <AlertOctagon className="w-4 h-4" />
            <span>Attempt Tamper Demo</span>
          </button>
        </div>
      </div>

      {/* Verify Banner */}
      {verifyStatus && (
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          verifyStatus.ok
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
        }`}>
          <div className="flex items-center space-x-2 text-xs font-bold">
            {verifyStatus.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-rose-400" />}
            <span>
              {verifyStatus.ok
                ? `Cryptographic chain verified: All ${verifyStatus.rows} entries match hash sequence.`
                : `Chain corrupted at sequence #${verifyStatus.first_bad_seq}!`}
            </span>
          </div>
          <div className="font-mono text-xs text-slate-400 truncate max-w-sm">
            Head: {verifyStatus.head_hash?.slice(0, 24)}...
          </div>
        </div>
      )}

      {/* Tamper Result Modal/Banner */}
      {tamperResult && (
        <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs space-y-2">
          <div className="font-bold flex items-center space-x-1.5 text-amber-300">
            <AlertOctagon className="w-4 h-4" />
            <span>SQLITE Database Triggers Enforced: Tamper Blocked</span>
          </div>
          <div className="font-mono text-slate-300 space-y-1">
            <div>UPDATE blocked: <strong className="text-emerald-400">{tamperResult.update_blocked ? 'TRUE (RAISE ABORT)' : 'FALSE'}</strong></div>
            <div>DELETE blocked: <strong className="text-emerald-400">{tamperResult.delete_blocked ? 'TRUE (RAISE ABORT)' : 'FALSE'}</strong></div>
            <div>Trigger Error: <em>"{tamperResult.errors?.[0] || 'audit_log is append-only'}"</em></div>
          </div>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/40 backdrop-blur">
        <table className="w-full text-xs text-left text-slate-300 border-collapse">
          <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider text-[11px]">
            <tr>
              <th className="p-3">Seq</th>
              <th className="p-3">Company</th>
              <th className="p-3">Metric</th>
              <th className="p-3 text-right">Original</th>
              <th className="p-3 text-right">Corrected</th>
              <th className="p-3 text-center">Decision</th>
              <th className="p-3">Reviewer / Note</th>
              <th className="p-3">Row Hash (SHA-256)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
            {entries.map((entry) => (
              <tr key={entry.seq} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-3 font-bold text-sky-400">#{entry.seq}</td>
                <td className="p-3 font-sans font-medium text-white">{entry.company}</td>
                <td className="p-3 capitalize text-slate-300">{entry.metric?.replace(/_/g, ' ')}</td>
                <td className="p-3 text-right text-slate-400">
                  {entry.original_value != null ? `$${entry.original_value.toLocaleString()}` : '—'}
                </td>
                <td className="p-3 text-right text-emerald-400 font-bold">
                  {entry.corrected_value != null ? `$${entry.corrected_value.toLocaleString()}` : '—'}
                </td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    entry.decision === 'approve'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : entry.decision === 'correct'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {entry.decision}
                  </span>
                </td>
                <td className="p-3 font-sans text-slate-300 text-[11px]">
                  <strong className="text-slate-100 font-mono">{entry.reviewer}</strong>: {entry.note || 'None'}
                </td>
                <td className="p-3 font-mono text-slate-500 text-[10px] truncate max-w-[140px]" title={entry.row_hash}>
                  {entry.row_hash?.slice(0, 16)}...
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
