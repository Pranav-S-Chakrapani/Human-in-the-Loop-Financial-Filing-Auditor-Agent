import React, { useState, useEffect } from 'react';
import { fetchAudit, verifyAuditChain, tamperAuditLog } from '../api';
import { ShieldCheck, Lock, AlertOctagon, CheckCircle2, XCircle } from 'lucide-react';

export const AuditLedgerScreen: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [verifyStatus, setVerifyStatus] = useState<any | null>(null);
  const [tamperResult, setTamperResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedHashSeq, setCopiedHashSeq] = useState<number | null>(null);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/[0.08] pb-4 gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-[rgba(232,179,57,0.1)] border border-[rgba(232,179,57,0.25)] text-[var(--signal,#E8B339)] text-[10px] font-mono uppercase tracking-wider mb-2">
            <span>IMMUTABLE CRYPTOGRAPHIC HASH CHAIN</span>
          </div>
          <h2 className="text-2xl font-display font-bold text-white tracking-[-0.02em] flex items-center space-x-2">
            <Lock className="w-5 h-5 text-[var(--signal,#E8B339)]" />
            <span>Cryptographic Audit Ledger</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Insert-only SQLite audit log protected by database triggers. <code className="text-slate-300 font-mono">row_hash = sha256(prev_hash + canonical_json(row))</code>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleVerify}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 text-emerald-300 text-xs font-mono font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Verify Chain Integrity</span>
          </button>

          <button
            onClick={handleTamper}
            className="px-4 py-2 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-300 text-xs font-mono font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.2)]"
          >
            <AlertOctagon className="w-4 h-4 text-rose-400" />
            <span>Simulate Tamper (Abort Test)</span>
          </button>
        </div>
      </div>

      {/* Verify Banner */}
      {verifyStatus && (
        <div className={`p-4 rounded-2xl border backdrop-blur-xl flex items-center justify-between shadow-lg ${
          verifyStatus.ok
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
            : 'border-rose-500/50 bg-rose-500/10 text-rose-200'
        }`}>
          <div className="flex items-center space-x-3 text-xs font-mono font-bold">
            {verifyStatus.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-400 shrink-0" />}
            <span>
              {verifyStatus.ok
                ? `Cryptographic chain 100% verified: All ${verifyStatus.rows} entries match sequential SHA-256 digests.`
                : `Integrity breach: Chain corrupted at sequence #${verifyStatus.first_bad_seq}!`}
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-400 truncate max-w-sm">
            Head Hash: <span className="text-white">{verifyStatus.head_hash?.slice(0, 24)}...</span>
          </div>
        </div>
      )}

      {/* Tamper Result Modal/Banner */}
      {tamperResult && (
        <div className="p-5 rounded-2xl border border-[var(--signal,#E8B339)]/40 bg-[#141822]/90 text-amber-200 text-xs space-y-2.5 backdrop-blur-xl shadow-xl">
          <div className="font-bold flex items-center space-x-2 text-[var(--signal,#E8B339)] font-mono text-sm">
            <AlertOctagon className="w-4 h-4" />
            <span>SQLite Database Triggers Enforced: Mutation Attempt Blocked</span>
          </div>
          <div className="font-mono text-slate-300 space-y-1.5 p-3 rounded-xl bg-[#0B0E14] border border-white/[0.06]">
            <div>UPDATE statement blocked: <strong className="text-emerald-400">{tamperResult.update_blocked ? 'TRUE (RAISE ABORT TRIGGERED)' : 'FALSE'}</strong></div>
            <div>DELETE statement blocked: <strong className="text-emerald-400">{tamperResult.delete_blocked ? 'TRUE (RAISE ABORT TRIGGERED)' : 'FALSE'}</strong></div>
            <div>Trigger Exception Message: <em className="text-rose-300">"{tamperResult.errors?.[0] || 'audit_log is append-only'}"</em></div>
          </div>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="overflow-x-auto border border-white/[0.08] rounded-2xl bg-[#141822]/85 backdrop-blur-xl shadow-xl">
        <table className="w-full text-xs text-left text-slate-300 border-collapse">
          <thead className="bg-[#0B0E14]/90 border-b border-white/[0.08] text-slate-400 uppercase font-mono tracking-wider text-[10px]">
            <tr>
              <th className="p-3.5">Seq</th>
              <th className="p-3.5">Company</th>
              <th className="p-3.5">Metric</th>
              <th className="p-3.5 text-right">Original</th>
              <th className="p-3.5 text-right">Corrected</th>
              <th className="p-3.5 text-center">Decision</th>
              <th className="p-3.5">Reviewer / Note</th>
              <th className="p-3.5">Row Hash (SHA-256)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04] font-mono text-xs">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-slate-500 font-mono">
                  No committed audit rows found. Execute a run in Mission Control to generate ledger signatures.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.seq} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-3.5 font-bold text-[var(--signal,#E8B339)]">#{entry.seq}</td>
                  <td className="p-3.5 font-sans font-semibold text-white">{entry.company}</td>
                  <td className="p-3.5 capitalize text-slate-300">{entry.metric?.replace(/_/g, ' ')}</td>
                  <td className="p-3.5 text-right text-slate-400">
                    {entry.original_value != null ? `$${entry.original_value.toLocaleString()}` : '—'}
                  </td>
                  <td className="p-3.5 text-right text-emerald-400 font-bold">
                    {entry.corrected_value != null ? `$${entry.corrected_value.toLocaleString()}` : '—'}
                  </td>
                  <td className="p-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                      entry.decision === 'approve'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : entry.decision === 'correct'
                        ? 'bg-[var(--signal,#E8B339)]/20 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {entry.decision}
                    </span>
                  </td>
                  <td className="p-3.5 font-sans text-slate-300 text-[11px]">
                    <strong className="text-white font-mono">{entry.reviewer}</strong>: {entry.note || 'None'}
                  </td>
                  <td className="p-3.5 font-mono text-slate-500 text-[10px]">
                    <button
                      onClick={() => {
                        if (entry.row_hash) {
                          navigator.clipboard.writeText(entry.row_hash);
                          setCopiedHashSeq(entry.seq);
                          setTimeout(() => setCopiedHashSeq(null), 1800);
                        }
                      }}
                      className="px-2 py-1 rounded bg-[#0E121A] hover:bg-white/[0.08] active:scale-95 text-slate-400 hover:text-white transition-all cursor-pointer border border-white/[0.06] flex items-center space-x-1.5"
                      title="Click to copy full SHA-256 hash"
                    >
                      <span className="truncate max-w-[120px]">{entry.row_hash?.slice(0, 16)}...</span>
                      {copiedHashSeq === entry.seq ? (
                        <span className="text-emerald-400 font-bold text-[9px]">COPIED</span>
                      ) : (
                        <span className="text-[9px] text-slate-600">COPY</span>
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
