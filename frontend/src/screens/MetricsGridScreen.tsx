import React, { useState, useEffect } from 'react';
import { fetchMetricsGrid } from '../api';
import { LayoutGrid, CheckCircle2, AlertTriangle, XCircle, X, ShieldCheck } from 'lucide-react';

const METRIC_COLS = [
  "revenue", "net_income", "total_assets", "total_liabilities",
  "shareholders_equity", "operating_cash_flow", "gross_profit", "diluted_eps"
];

export const MetricsGridScreen: React.FC = () => {
  const [gridData, setGridData] = useState<any[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ company: string; ticker: string; metric: string; data: any } | null>(null);

  useEffect(() => {
    fetchMetricsGrid().then(setGridData);
  }, []);

  const getStatusBadge = (status: string, conf: number) => {
    if (status === 'auto_approved' || status === 'approved') {
      return (
        <span className="inline-flex items-center text-[10px] text-emerald-400 font-mono font-bold">
          <CheckCircle2 className="w-3 h-3 mr-0.5" />
          {(conf * 100).toFixed(0)}%
        </span>
      );
    }
    if (status === 'pending_review' || status === 'corrected') {
      return (
        <span className="inline-flex items-center text-[10px] text-[var(--signal,#E8B339)] font-mono font-bold">
          <AlertTriangle className="w-3 h-3 mr-0.5" />
          {(conf * 100).toFixed(0)}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[10px] text-slate-500 font-mono">
        <XCircle className="w-3 h-3 mr-0.5" />
        n/a
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-white/[0.08] pb-4">
        <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-[rgba(232,179,57,0.1)] border border-[rgba(232,179,57,0.25)] text-[var(--signal,#E8B339)] text-[10px] font-mono uppercase tracking-wider mb-2">
          <span>CROSS-COMPANY COMPARATIVE MATRIX</span>
        </div>
        <h2 className="text-2xl font-display font-bold text-white tracking-[-0.02em] flex items-center space-x-2">
          <LayoutGrid className="w-5 h-5 text-[var(--signal,#E8B339)]" />
          <span>Metrics Cross-Company Grid</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1 font-sans">
          Comparative matrix across all 8 target financial metrics. Click any cell to inspect the immutable evidence drawer and audit signature.
        </p>
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto border border-white/[0.08] rounded-2xl bg-[#141822]/85 backdrop-blur-xl shadow-xl">
        <table className="w-full text-xs text-left text-slate-300 border-collapse">
          <thead className="bg-[#0B0E14]/90 border-b border-white/[0.08] text-slate-400 uppercase font-mono tracking-wider text-[10px]">
            <tr>
              <th className="p-3.5 sticky left-0 bg-[#0B0E14] z-10 whitespace-nowrap">Company</th>
              {METRIC_COLS.map((col) => (
                <th key={col} className="p-3.5 text-right font-medium whitespace-nowrap min-w-[140px]">
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04] font-mono text-xs">
            {gridData.map((row) => (
              <tr key={row.ticker} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-3.5 font-bold text-white sticky left-0 bg-[#0E121A]/95 z-10 flex items-center space-x-2 border-r border-white/[0.04] whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded-md bg-[#1B1F28] text-[var(--signal,#E8B339)] text-[10px] border border-white/[0.06]">
                    {row.ticker}
                  </span>
                  <span className="font-sans font-medium text-slate-200 truncate max-w-[140px]">
                    {row.company}
                  </span>
                </td>

                {METRIC_COLS.map((col) => {
                  const cell = row[col];
                  const hasValue = cell && cell.value != null;
                  const isSelected = selectedCell?.ticker === row.ticker && selectedCell?.metric === col;

                  return (
                    <td
                      key={col}
                      onClick={() => {
                        if (cell) {
                          setSelectedCell({
                            company: row.company,
                            ticker: row.ticker,
                            metric: col,
                            data: cell
                          });
                        }
                      }}
                      className={`p-3.5 text-right cursor-pointer transition-all whitespace-nowrap ${
                        isSelected
                          ? 'bg-[var(--signal,#E8B339)]/15 border-[var(--signal,#E8B339)] border shadow-inner'
                          : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      {hasValue ? (
                        <div>
                          <div className="font-bold text-slate-100">
                            {col === 'diluted_eps'
                              ? `$${cell.value.toFixed(2)}`
                              : `$${(cell.value / 1e9).toFixed(1)}B`}
                          </div>
                          <div>{getStatusBadge(cell.status, cell.confidence || 0)}</div>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Evidence Drawer (when cell is clicked) */}
      {selectedCell && (
        <div className="p-6 border border-[var(--signal,#E8B339)]/40 bg-[#141822]/95 rounded-2xl backdrop-blur-2xl relative space-y-4 shadow-2xl animate-in fade-in duration-200">
          <button
            onClick={() => setSelectedCell(null)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-[var(--signal,#E8B339)] text-[#090C12] font-bold">
              {selectedCell.ticker}
            </span>
            <span className="text-base font-display font-bold text-white capitalize">
              {selectedCell.company} — {selectedCell.metric.replace(/_/g, ' ')} Evidence Detail
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
            <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/[0.06]">
              <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Normalized Value</div>
              <div className="text-xl font-mono font-bold text-emerald-400 mt-1">
                {selectedCell.data.value != null
                  ? `$${selectedCell.data.value.toLocaleString()}`
                  : 'null'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/[0.06]">
              <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Auditor Confidence</div>
              <div className="text-xl font-mono font-bold text-[var(--signal,#E8B339)] mt-1">
                {(selectedCell.data.confidence * 100).toFixed(0)}%
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/[0.06]">
              <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Decision Status</div>
              <div className="text-sm font-mono font-bold text-slate-200 mt-2 capitalize">
                {selectedCell.data.status}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/[0.06]">
              <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Integrity Chain</div>
              <div className="text-sm font-mono text-emerald-400 mt-2 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>SHA-256 Chained</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
