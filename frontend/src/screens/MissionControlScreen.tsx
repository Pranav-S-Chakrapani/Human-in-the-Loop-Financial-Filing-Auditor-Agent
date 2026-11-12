import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, AlertTriangle, CheckCircle, Clock, Zap, Activity, Plus, Loader2 } from 'lucide-react';
import { fetchRuns, createRun, subscribeToEvents, fetchCompanies, addCompany } from '../api';
import { MagneticButton } from '../components/MagneticButton';

const PIPELINE_NODES = [
  "fetch", "locate", "extract_rules", "extract_llm", "score",
  "validate", "triage", "enqueue_reviews", "human_review", "apply_decisions",
  "ground_truth_verify", "report"
];

const DEFAULT_PINNED_TICKERS = ["AAPL", "MSFT", "KO", "NKE", "PEP", "JNJ", "AMZN", "GOOGL"];

export const MissionControlScreen: React.FC = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<any[]>([]);
  const [pinnedTickers, setPinnedTickers] = useState<string[]>(DEFAULT_PINNED_TICKERS);
  const [customCompanies, setCustomCompanies] = useState<any[]>([]);
  const [selectedTickers, setSelectedTickers] = useState<string[]>(["AAPL", "MSFT"]);
  const [faultMode, setFaultMode] = useState<string>("");
  const [events, setEvents] = useState<any[]>([]);

  // Add Company input state
  const [isAddingCompany, setIsAddingCompany] = useState<boolean>(false);
  const [newTickerInput, setNewTickerInput] = useState<string>("");
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);
  const [addCompanyError, setAddCompanyError] = useState<string | null>(null);

  useEffect(() => {
    fetchRuns().then((data) => {
      setRuns(data);
    });

    fetchCompanies().then((res) => {
      if (res.pinned && res.pinned.length > 0) setPinnedTickers(res.pinned);
      if (res.custom) setCustomCompanies(res.custom);
    }).catch(() => null);

    const unsubscribe = subscribeToEvents((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 50));
      // Refresh runs list on state change
      if (["run_created", "run_paused", "run_completed", "run_failed"].includes(event.type)) {
        fetchRuns().then(setRuns);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAddCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = newTickerInput.trim().toUpperCase();
    if (!t) return;
    setAddCompanyError(null);
    setIsLookingUp(true);

    try {
      const res = await addCompany(t);
      setCustomCompanies((prev) => {
        const filtered = prev.filter((c) => c.ticker !== res.ticker);
        return [...filtered, res.company];
      });
      // Auto-select newly added ticker
      if (!selectedTickers.includes(res.ticker)) {
        setSelectedTickers((prev) => [...prev, res.ticker]);
      }
      setNewTickerInput("");
      setIsAddingCompany(false);
    } catch (err: any) {
      setAddCompanyError(err.message || `Failed to add company ${t}`);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleStartRun = async () => {
    if (selectedTickers.length === 0) return;
    try {
      await createRun(selectedTickers, faultMode ? faultMode : null);
      fetchRuns().then(setRuns);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleTicker = (t: string) => {
    if (selectedTickers.includes(t)) {
      setSelectedTickers(selectedTickers.filter((item) => item !== t));
    } else {
      setSelectedTickers([...selectedTickers, t]);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Run Trigger Panel */}
      <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#141822]/85 backdrop-blur-xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-[rgba(232,179,57,0.1)] border border-[rgba(232,179,57,0.25)] text-[var(--signal,#E8B339)] text-[10px] font-mono uppercase tracking-wider mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--signal,#E8B339)] animate-pulse" />
            <span>Autonomous Ingestion Engine</span>
          </div>
          <h2 className="text-2xl font-display font-bold text-white tracking-[-0.02em] flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--signal,#E8B339)]" />
            <span>Mission Control Canvas</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl font-sans">
            Launch multi-company financial audit runs, configure fault injection, and trace asynchronous state checkpoint transitions in real time.
          </p>
        </div>

        {/* Trigger Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Ticker selector chips */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#0B0E14]/90 p-1.5 rounded-xl border border-white/[0.06] shadow-inner">
            {/* Pinned 8 */}
            {pinnedTickers.map((t) => {
              const active = selectedTickers.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTicker(t)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-lg transition-all cursor-pointer ${
                    active
                      ? "bg-[var(--signal,#E8B339)] text-[#090C12] font-bold shadow-[0_0_12px_rgba(232,179,57,0.35)]"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {t}
                </button>
              );
            })}

            {/* Custom Session Added Tickers */}
            {customCompanies.map((c) => {
              const t = c.ticker;
              const active = selectedTickers.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTicker(t)}
                  title={c.name}
                  className={`px-2.5 py-1 text-xs font-mono rounded-lg border flex items-center space-x-1 transition-all cursor-pointer ${
                    active
                      ? "bg-teal-500 text-slate-950 font-bold border-teal-400 shadow-[0_0_12px_rgba(20,184,166,0.4)]"
                      : "bg-[#0E121A] text-teal-400 border-teal-500/30 hover:border-teal-500/60"
                  }`}
                >
                  <span>{t}</span>
                  <span className="text-[9px] px-1 rounded bg-teal-500/20 font-sans">custom</span>
                </button>
              );
            })}

            {/* + Add Company toggle/input */}
            {!isAddingCompany ? (
              <button
                onClick={() => {
                  setIsAddingCompany(true);
                  setAddCompanyError(null);
                }}
                className="px-2.5 py-1 text-xs font-mono text-slate-400 hover:text-[var(--signal,#E8B339)] hover:bg-white/[0.04] rounded-lg flex items-center space-x-1 transition-colors cursor-pointer"
                title="Add company by ticker via SEC EDGAR"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            ) : (
              <form onSubmit={handleAddCompanySubmit} className="flex items-center space-x-1">
                <input
                  type="text"
                  value={newTickerInput}
                  onChange={(e) => setNewTickerInput(e.target.value)}
                  placeholder="NVDA..."
                  disabled={isLookingUp}
                  autoFocus
                  className="w-20 px-2.5 py-0.5 text-xs font-mono bg-[#0E121A] border border-[var(--signal,#E8B339)]/60 rounded-md text-[var(--signal,#E8B339)] placeholder-slate-600 focus:outline-none uppercase"
                />
                <button
                  type="submit"
                  disabled={isLookingUp || !newTickerInput.trim()}
                  className="px-2 py-0.5 text-xs font-medium rounded bg-[var(--signal,#E8B339)] hover:brightness-110 text-[#090C12] disabled:opacity-50 flex items-center font-mono font-bold cursor-pointer"
                >
                  {isLookingUp ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                </button>
                <button
                  type="button"
                  disabled={isLookingUp}
                  onClick={() => {
                    setIsAddingCompany(false);
                    setAddCompanyError(null);
                    setNewTickerInput("");
                  }}
                  className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-white"
                >
                  ✕
                </button>
              </form>
            )}
          </div>

          {/* Fault mode dropdown */}
          <select
            value={faultMode}
            onChange={(e) => setFaultMode(e.target.value)}
            className="bg-[#0B0E14] text-xs font-mono text-slate-300 border border-white/[0.08] rounded-xl px-3 py-2 focus:outline-none focus:border-[var(--signal,#E8B339)] transition-colors cursor-pointer"
          >
            <option value="">No Fault (Natural Run)</option>
            <option value="wrong_column">Fault: wrong_column</option>
            <option value="wrong_scale">Fault: wrong_scale</option>
            <option value="wrong_row">Fault: wrong_row</option>
            <option value="llm_hallucination">Fault: llm_hallucination</option>
          </select>

          {/* Magnetic Start Run button */}
          <MagneticButton
            radius={20}
            onClick={handleStartRun}
            className="px-5 py-2 rounded-xl bg-[var(--signal,#E8B339)] hover:brightness-110 active:scale-[0.98] text-[#090C12] text-xs font-bold font-sans flex items-center space-x-2 shadow-[0_0_20px_rgba(232,179,57,0.35)] transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch Run ({selectedTickers.length})</span>
          </MagneticButton>
        </div>
      </div>

      {/* Add Company Error Banner */}
      {addCompanyError && (
        <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs flex items-center justify-between font-mono backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{addCompanyError}</span>
          </div>
          <button
            onClick={() => setAddCompanyError(null)}
            className="text-slate-400 hover:text-white text-xs px-2 py-0.5 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Pipelines Lane + Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 cols: Company Pipeline Lanes */}
        <div className="lg:col-span-3 space-y-4">
          {runs.length === 0 ? (
            <div className="p-12 rounded-2xl border border-white/[0.08] bg-[#141822]/60 text-center backdrop-blur-xl">
              <Activity className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <h3 className="font-display font-bold text-base text-slate-300 mb-1">No Active Audit Runs</h3>
              <p className="text-xs text-slate-500 font-sans max-w-sm mx-auto mb-4">
                Select one or more company tickers above and click Launch Run to execute automated table parsing and invariant checking.
              </p>
              <button
                onClick={handleStartRun}
                className="px-4 py-2 rounded-lg bg-[var(--signal,#E8B339)] text-[#090C12] text-xs font-bold font-mono inline-flex items-center space-x-1.5 cursor-pointer hover:brightness-110"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Launch Default (AAPL + MSFT)</span>
              </button>
            </div>
          ) : (
            runs.map((r) => {
              const isPaused = r.status === "paused";
              const isRunning = r.status === "running";
              const isCompleted = r.status === "completed";

              return (
                <div
                  key={r.run_id}
                  className={`p-5 rounded-2xl border backdrop-blur-xl transition-all shadow-lg ${
                    isPaused
                      ? "border-amber-500/60 bg-amber-500/10 shadow-[0_0_25px_rgba(245,158,11,0.15)]"
                      : "border-white/[0.08] bg-[#141822]/80 hover:border-white/[0.14]"
                  }`}
                >
                  {/* Lane Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-sm font-bold text-white px-2.5 py-1 rounded-lg bg-[#0B0E14] border border-white/[0.06] shadow-sm">
                        {r.ticker}
                      </span>
                      <span className="text-sm text-slate-200 font-semibold font-sans">{r.company}</span>
                      <span className="text-xs font-mono text-slate-500">({r.run_id})</span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center space-x-1.5 font-mono ${
                          isPaused
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                            : isRunning
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            : isCompleted
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {isPaused ? <AlertTriangle className="w-3 h-3 mr-1" /> : isCompleted ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                        <span>{r.status}</span>
                      </span>

                      {/* If paused, show Review Workbench direct link */}
                      {isPaused && (
                        <button
                          onClick={() => navigate('/reviews')}
                          className="px-3 py-1 text-xs font-bold rounded-lg bg-[var(--signal,#E8B339)] hover:brightness-110 active:scale-95 text-[#090C12] transition-all cursor-pointer font-sans shadow-md"
                        >
                          Open Review
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nodes Horizontal Pipeline Track */}
                  <div className="overflow-x-auto pb-1.5 pt-1">
                    <div className="flex items-center space-x-2 min-w-[720px]">
                      {PIPELINE_NODES.map((n, idx) => {
                        const currentNodeIndex = PIPELINE_NODES.indexOf(r.current_node);
                        const isNodeDone = isCompleted || (currentNodeIndex > idx && !isPaused) || (isPaused && idx < currentNodeIndex);
                        const isNodeActive = r.current_node === n;
                        const isInterrupted = isPaused && n === "human_review";

                        return (
                          <React.Fragment key={n}>
                            <div
                              onClick={() => {
                                if (isInterrupted) navigate('/reviews');
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono border text-center transition-all ${
                                isInterrupted
                                  ? "bg-amber-500/25 border-amber-400 text-amber-200 font-bold animate-pulse cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                                  : isNodeActive
                                  ? "bg-sky-500/20 border-sky-400 text-sky-200 font-bold animate-pulse"
                                  : isNodeDone
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                  : "bg-[#0B0E14] border-white/[0.04] text-slate-600"
                              }`}
                            >
                              {n}
                            </div>
                            {idx < PIPELINE_NODES.length - 1 && (
                              <div
                                className={`h-0.5 w-3.5 transition-colors ${
                                  isNodeDone ? "bg-emerald-500/50" : "bg-white/[0.06]"
                                }`}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right 1 col: Live Side Event Feed */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#141822]/85 p-5 flex flex-col h-[650px] backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06] mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-2 font-mono">
              <Zap className="w-3.5 h-3.5 text-[var(--signal,#E8B339)]" />
              <span>Live Event Stream</span>
            </h3>
            <span className="text-[11px] font-mono text-[var(--signal,#E8B339)] font-semibold bg-[rgba(232,179,57,0.1)] px-2 py-0.5 rounded-full border border-[rgba(232,179,57,0.2)]">
              {events.length} ev
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-mono text-xs">
            {events.length === 0 ? (
              <div className="text-slate-600 text-center py-16 flex flex-col items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mb-2" />
                <span>Listening on WebSocket bus...</span>
              </div>
            ) : (
              events.map((ev, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-[#0B0E14]/90 border border-white/[0.05] hover:border-white/[0.12] transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-[var(--signal,#E8B339)]">{ev.type}</span>
                    <span className="text-slate-500 text-[10px]">{ev.run_id ? ev.run_id.slice(-6) : 'system'}</span>
                  </div>
                  <pre className="text-[10px] text-slate-400 overflow-x-auto leading-relaxed">
                    {JSON.stringify(ev.payload, null, 1)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
