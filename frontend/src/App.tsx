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
import { fetchCounters, fetchDevStatus, USE_MOCKS, subscribeToEvents } from './api';
import { Shield, RefreshCw, HelpCircle, Monitor, Settings } from 'lucide-react';
import { ShortcutsModal } from './components/ShortcutsModal';
import { DevSettingsModal } from './components/DevSettingsModal';

const NavigationBar: React.FC<{
  isPresenterMode: boolean;
  onTogglePresenter: () => void;
  onOpenShortcuts: () => void;
  onOpenDevSettings: () => void;
  demoResetEnabled: boolean;
}> = ({ isPresenterMode, onTogglePresenter, onOpenShortcuts, onOpenDevSettings, demoResetEnabled }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [counters, setCounters] = useState<{ llm_calls: number; audit_rows: number; events: number } | null>(null);
  const [logoClicked, setLogoClicked] = useState(false);

  useEffect(() => {
    fetchCounters().then(setCounters).catch(() => null);
    const unsub = subscribeToEvents(() => {
      fetchCounters().then(setCounters).catch(() => null);
    });
    return () => unsub();
  }, []);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setLogoClicked(true);
    setTimeout(() => setLogoClicked(false), 200);
    navigate('/');
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
          {/* Logo with subtle scale-down-then-up on click */}
          <button
            onClick={handleLogoClick}
            style={{
              transform: logoClicked ? 'scale(0.92)' : 'scale(1)',
              transition: 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
            className="flex items-center space-x-2 font-display font-bold text-sky-400 tracking-wider text-sm uppercase cursor-pointer focus:outline-none"
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

          {/* Presenter Mode enlarged counters or compact counters */}
          {counters && (
            <div className={`flex items-center space-x-3 font-mono transition-all ${
              isPresenterMode
                ? 'bg-sky-500/10 border border-sky-500/30 px-3 py-1 rounded-lg text-sm font-bold text-sky-300'
                : 'text-slate-400 text-[11px]'
            }`}>
              <span>LLM: <strong className="text-slate-100">{counters.llm_calls}</strong></span>
              <span>Audit: <strong className="text-slate-100">{counters.audit_rows}</strong></span>
              <span>Events: <strong className="text-slate-100">{counters.events}</strong></span>
            </div>
          )}

          {/* Toggle Presenter Mode button */}
          <button
            onClick={onTogglePresenter}
            title="Toggle Presenter Mode (P)"
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isPresenterMode
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>

          {/* Dev / Demo Settings button: visible ONLY when demoResetEnabled is true */}
          {demoResetEnabled && (
            <button
              onClick={onOpenDevSettings}
              title="Developer & Demo Settings"
              className="p-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 text-sky-400 hover:text-sky-200 hover:bg-sky-500/20 transition-colors cursor-pointer font-mono"
            >
              <Settings className="w-3.5 h-3.5 animate-spin-slow" />
            </button>
          )}

          {/* Keyboard Shortcuts helper button */}
          <button
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts (?)"
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export const App: React.FC = () => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'info' | 'error'>('info');
  const [lastCheckpointTime, setLastCheckpointTime] = useState<string>('Just now');
  const [isPresenterMode, setIsPresenterMode] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isDevSettingsOpen, setIsDevSettingsOpen] = useState<boolean>(false);
  const [demoResetEnabled, setDemoResetEnabled] = useState<boolean>(false);

  useEffect(() => {
    fetchDevStatus().then((res) => {
      setDemoResetEnabled(res.demo_reset_enabled);
    }).catch(() => setDemoResetEnabled(false));
  }, []);

  useEffect(() => {
    const unsub = subscribeToEvents((event) => {
      if (event.type === 'system_recovered') {
        setToastType('info');
        setToastMessage(`System Recovered: Resumed ${event.payload.resumed_runs?.length || 1} run(s) from checkpointer`);
        setTimeout(() => setToastMessage(null), 6000);
      } else if (event.type === 'run_failed') {
        setToastType('error');
        setToastMessage(`Run Failed: ${event.payload.error || 'Pipeline error'}`);
        setTimeout(() => setToastMessage(null), 8000);
      }
      setLastCheckpointTime(new Date().toLocaleTimeString());
    });
    return () => unsub();
  }, []);

  // Global keyboard shortcuts (? and P)
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) return;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setIsPresenterMode((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsShortcutsOpen(false);
        setIsDevSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans">
        <NavigationBar
          isPresenterMode={isPresenterMode}
          onTogglePresenter={() => setIsPresenterMode(!isPresenterMode)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenDevSettings={() => setIsDevSettingsOpen(true)}
          demoResetEnabled={demoResetEnabled}
        />

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

        <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
        
        {demoResetEnabled && (
          <DevSettingsModal
            isOpen={isDevSettingsOpen}
            onClose={() => setIsDevSettingsOpen(false)}
            onResetSuccess={() => {
              setToastType('info');
              setToastMessage('Demo Data Cleared: Database reset to pristine schema.');
              setTimeout(() => setToastMessage(null), 5000);
            }}
          />
        )}

        {/* System Recovered / Error Toasts */}
        {toastMessage && (
          <div className={`fixed bottom-10 right-6 z-50 p-4 rounded-xl border shadow-2xl flex items-center space-x-3 text-xs font-mono animate-bounce ${
            toastType === 'error'
              ? 'border-rose-500/50 bg-slate-900/95 text-rose-300'
              : 'border-emerald-500/50 bg-slate-900/95 text-emerald-300'
          }`}>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Always-visible footer chip */}
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
