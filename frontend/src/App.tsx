import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  IntroScreen,
  MissionControlScreen,
  ReviewWorkbenchScreen,
  MetricsGridScreen,
  AuditLedgerScreen,
  ReportScreen,
} from './screens';
import { fetchCounters, USE_MOCKS } from './api';

const NavigationBar: React.FC = () => {
  const location = useLocation();
  const [counters, setCounters] = useState<{ llm_calls: number; audit_rows: number; events: number } | null>(null);

  useEffect(() => {
    fetchCounters().then(setCounters).catch(() => null);
  }, []);

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
          <Link to="/" className="font-bold text-sky-400 tracking-wider text-sm uppercase">
            VantageAudit
          </Link>
          <nav className="flex space-x-1">
            {navLinks.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    active
                      ? 'bg-slate-800 text-sky-400'
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
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold tracking-wider">
              MOCK
            </span>
          )}
          {counters && (
            <div className="flex space-x-3 text-slate-400">
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
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
        <NavigationBar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<IntroScreen />} />
            <Route path="/mission" element={<MissionControlScreen />} />
            <Route path="/reviews" element={<ReviewWorkbenchScreen />} />
            <Route path="/metrics" element={<MetricsGridScreen />} />
            <Route path="/audit" element={<AuditLedgerScreen />} />
            <Route path="/report" element={<ReportScreen />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};
