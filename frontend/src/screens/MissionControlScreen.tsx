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
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-400" />
            <span>Mission Control Canvas</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time execution pipeline monitor with WebSocket stream and interrupt detection.
          </p>
        </div>

        {/* Trigger Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Ticker selector chips */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {/* Pinned 8 */}
            {pinnedTickers.map((t) => {
              const active = selectedTickers.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTicker(t)}
                  className={`px-2 py-1 text-xs font-mono rounded ${
                    active
                      ? "bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40"
                      : "text-slate-400 hover:text-slate-200"
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
                  className={`px-2 py-1 text-xs font-mono rounded border flex items-center space-x-1 ${
                    active
                      ? "bg-teal-500/20 text-teal-300 font-bold border-teal-500/50"
                      : "bg-slate-900/80 text-teal-400/80 border-teal-500/30 hover:border-teal-500/60"
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
                className="px-2 py-1 text-xs font-mono text-slate-400 hover:text-sky-300 hover:bg-slate-900 rounded flex items-center space-x-1 transition-colors"
                title="Add company by ticker via SEC EDGAR"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Company</span>
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
                  className="w-20 px-2 py-0.5 text-xs font-mono bg-slate-900 border border-sky-500/50 rounded text-sky-200 placeholder-slate-500 focus:outline-none uppercase"
                />
                <button
                  type="submit"
                  disabled={isLookingUp || !newTickerInput.trim()}
                  className="px-2 py-0.5 text-xs font-medium rounded bg-sky-500 hover:bg-sky-400 text-slate-950 disabled:opacity-50 flex items-center"
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
                  className="px-1.5 py-0.5 text-xs text-slate-400 hover:text-white"
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
            className="bg-slate-950 text-xs font-mono text-slate-300 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500"
          >
            <option value="">No Fault (Natural)</option>
            <option value="wrong_column">Fault: wrong_column</option>
            <option value="wrong_scale">Fault: wrong_scale</option>
            <option value="wrong_row">Fault: wrong_row</option>
            <option value="llm_hallucination">Fault: llm_hallucination</option>
          </select>

          {/* Magnetic Start Run button */}
          <MagneticButton
            radius={20}
            onClick={handleStartRun}
            className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-sky-500/20 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch Run ({selectedTickers.length})</span>
          </MagneticButton>
        </div>
      </div>

      {/* Add Company Error Banner */}
      {addCompanyError && (
        <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs flex items-center justify-between font-mono">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{addCompanyError}</span>
          </div>
          <button
            onClick={() => setAddCompanyError(null)}
            className="text-slate-400 hover:text-white text-xs px-2 py-0.5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Pipelines Lane + Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 cols: Company Pipeline Lanes */}
        <div className="lg:col-span-3 space-y-4">
          {runs.map((r) => {
            const isPaused = r.status === "paused";
            const isRunning = r.status === "running";
            const isCompleted = r.status === "completed";

            return (
              <div
                key={r.run_id}
                className={`p-4 rounded-xl border bg-slate-900/40 backdrop-blur transition-all ${
                  isPaused
                    ? "border-amber-500/50 bg-amber-500/5 shadow-lg shadow-amber-500/10"
                    : "border-slate-800"
                }`}
              >
                {/* Lane Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-base font-bold text-white px-2 py-0.5 rounded bg-slate-800">
                      {r.ticker}
                    </span>
                    <span className="text-sm text-slate-300 font-medium">{r.company}</span>
                    <span className="text-xs font-mono text-slate-500">({r.run_id})</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center space-x-1 ${
                        isPaused
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                          : isRunning
                          ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                          : isCompleted
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
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
                        className="px-2.5 py-1 text-xs font-bold rounded bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer"
                      >
                        Open Review
                      </button>
                    )}
                  </div>
                </div>

                {/* Nodes Horizontal Pipeline Track */}
                <div className="overflow-x-auto pb-1">
                  <div className="flex items-center space-x-2 min-w-[700px]">
                    {PIPELINE_NODES.map((n, idx) => {
                      // Check status of node relative to current_node
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
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border text-center transition-all ${
                              isInterrupted
                                ? "bg-amber-500/20 border-amber-500 text-amber-300 font-bold animate-pulse cursor-pointer shadow-md shadow-amber-500/20"
                                : isNodeActive
                                ? "bg-sky-500/20 border-sky-400 text-sky-200 font-bold animate-pulse"
                                : isNodeDone
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-slate-950 border-slate-800 text-slate-600"
                            }`}
                          >
                            {n}
                          </div>
                          {idx < PIPELINE_NODES.length - 1 && (
                            <div
                              className={`h-0.5 w-3 ${
                                isNodeDone ? "bg-emerald-500/40" : "bg-slate-800"
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
          })}
        </div>

        {/* Right 1 col: Live Side Event Feed */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex flex-col h-[650px] backdrop-blur">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Live Event Feed</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">{events.length} events</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
            {events.length === 0 ? (
              <div className="text-slate-600 text-center py-10">Waiting for WebSocket events...</div>
            ) : (
              events.map((ev, i) => (
                <div
                  key={i}
                  className="p-2 rounded bg-slate-950 border border-slate-850 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-sky-400">{ev.type}</span>
                    <span className="text-slate-500">{ev.run_id ? ev.run_id.slice(-6) : 'system'}</span>
                  </div>
                  <pre className="text-[10px] text-slate-400 overflow-x-auto">
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
