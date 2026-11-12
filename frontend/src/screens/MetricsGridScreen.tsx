import React, { useState, useEffect } from 'react';
import { fetchMetricsGrid } from '../api';
import { LayoutGrid, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

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
        <span className="inline-flex items-center text-[10px] text-amber-400 font-mono font-bold">
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
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <LayoutGrid className="w-5 h-5 text-sky-400" />
          <span>Metrics Cross-Company Grid</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Comparative matrix across all 8 target metrics. Click any cell to open the verifiable evidence drawer.
        </p>
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/40 backdrop-blur">
        <table className="w-full text-xs text-left text-slate-300 border-collapse">
          <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono tracking-wider text-[11px]">
            <tr>
              <th className="p-3 sticky left-0 bg-slate-950 z-10">Company</th>
              {METRIC_COLS.map((col) => (
                <th key={col} className="p-3 text-right">
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
            {gridData.map((row) => (
              <tr key={row.ticker} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-3 font-bold text-white sticky left-0 bg-slate-950/90 z-10 flex items-center space-x-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 text-[10px]">
                    {row.ticker}
                  </span>
                  <span className="font-sans font-medium text-slate-200 truncate max-w-[130px]">
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
                      className={`p-3 text-right cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-400 border'
                          : 'hover:bg-slate-800/60'
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
        <div className="p-5 border border-sky-500/40 bg-slate-900/90 rounded-xl backdrop-blur relative space-y-3">
          <button
            onClick={() => setSelectedCell(null)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
              {selectedCell.ticker}
            </span>
            <span className="text-sm font-bold text-white capitalize">
              {selectedCell.metric.replace(/_/g, ' ')} Evidence Drawer
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase">Normalized Value</div>
              <div className="text-lg font-mono font-bold text-emerald-400">
                {selectedCell.data.value != null
                  ? `$${selectedCell.data.value.toLocaleString()}`
                  : 'null'}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase">Auditor Confidence</div>
              <div className="text-lg font-mono font-bold text-sky-400">
                {(selectedCell.data.confidence * 100).toFixed(0)}%
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase">Decision Status</div>
              <div className="text-sm font-mono font-bold text-slate-200 mt-1 capitalize">
                {selectedCell.data.status}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase">Audit Trail Status</div>
              <div className="text-sm font-mono text-emerald-400 mt-1 flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>SHA-256 Chained</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
