import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  IntroScreen,
  MissionControlScreen,
  ReviewWorkbenchScreen,
  MetricsGridScreen,
  AuditLedgerScreen,
  ReportScreen,
} from './screens';
import { fetchCounters, USE_MOCKS, subscribeToEvents } from './api';
import { Shield, RefreshCw } from 'lucide-react';

const NavigationBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [counters, setCounters] = useState<{ llm_calls: number; audit_rows: number; events: number } | null>(null);
  const [logoClicked, setLogoClicked] = useState(false);

  useEffect(() => {
    fetchCounters().then(setCounters).catch(() => null);
  }, []);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setLogoClicked(true);
    setTimeout(() => setLogoClicked(false), 200);
    navigate('/mission');
  };

  const navLinks = [
    { path: '/', label: 'Intro' },
    { path: '/mission', label: 'Mission Control' },
    { path: '/reviews', label: 'Review Workbench' },
    { path: '/metrics', label: 'Metrics Grid' },
    { path: '/audit', label: 'Audit Ledger' },
    { path: '/report', label: 'Report' },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {/* Logo with subtle scale-down-then-up on click (prompt req) */}
          <button
            onClick={handleLogoClick}
            style={{
              transform: logoClicked ? 'scale(0.92)' : 'scale(1)',
              transition: 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
            className="flex items-center space-x-2 font-bold text-sky-400 tracking-wider text-sm uppercase cursor-pointer focus:outline-none"
          >
            <Shield className="w-4 h-4 text-sky-400" />
            <span>VantageAudit</span>
          </button>

          <nav className="flex space-x-1">
            {navLinks.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    active
                      ? 'bg-slate-800 text-sky-400 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          {USE_MOCKS && (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold tracking-wider font-mono">
              MOCK
            </span>
          )}
          {counters && (
            <div className="flex space-x-3 text-slate-400 font-mono text-[11px]">
              <span>LLM: <strong className="text-slate-200">{counters.llm_calls}</strong></span>
              <span>Audit: <strong className="text-slate-200">{counters.audit_rows}</strong></span>
              <span>Events: <strong className="text-slate-200">{counters.events}</strong></span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export const App: React.FC = () => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastCheckpointTime, setLastCheckpointTime] = useState<string>('Just now');

  useEffect(() => {
    const unsub = subscribeToEvents((event) => {
      if (event.type === 'system_recovered') {
        setToastMessage(`System Recovered: Resumed ${event.payload.resumed_runs?.length || 1} run(s) from checkpointer`);
        setTimeout(() => setToastMessage(null), 6000);
      }
      setLastCheckpointTime(new Date().toLocaleTimeString());
    });
    return () => unsub();
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans">
        <NavigationBar />
        <main className="flex-1 pb-12">
          <Routes>
            <Route path="/" element={<IntroScreen />} />
            <Route path="/mission" element={<MissionControlScreen />} />
            <Route path="/reviews" element={<ReviewWorkbenchScreen />} />
            <Route path="/metrics" element={<MetricsGridScreen />} />
            <Route path="/audit" element={<AuditLedgerScreen />} />
            <Route path="/report" element={<ReportScreen />} />
          </Routes>
        </main>

        {/* System Recovered Toast */}
        {toastMessage && (
          <div className="fixed bottom-10 right-6 z-50 p-4 rounded-xl border border-emerald-500/50 bg-slate-900/95 text-emerald-300 shadow-2xl flex items-center space-x-3 text-xs font-mono animate-bounce">
            <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Always-visible footer chip (PROMPT & SPEC §15) */}
        <footer className="fixed bottom-2 left-6 z-40 pointer-events-none">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-slate-800 bg-slate-950/80 backdrop-blur text-[10px] font-mono text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Checkpointed · last checkpoint {lastCheckpointTime}</span>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};
