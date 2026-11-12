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
import { RefreshCw, HelpCircle, Monitor, Settings, Cpu, ShieldCheck, Activity } from 'lucide-react';
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
    { path: '/', label: 'Overview' },
    { path: '/mission', label: 'Mission Control' },
    { path: '/reviews', label: 'Review Workbench' },
    { path: '/metrics', label: 'Metrics Grid' },
    { path: '/audit', label: 'Audit Ledger' },
    { path: '/report', label: 'Report' },
  ];

  return (
    <header className="border-b border-white/[0.08] bg-[#090C12]/85 backdrop-blur-2xl sticky top-0 z-50 transition-all shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      {/* Subtle glowing amber hairline indicator */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--signal,#E8B339)]/60 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand & Nav Section */}
        <div className="flex items-center space-x-6">
          {/* Cybernetic Brand Mark */}
          <button
            onClick={handleLogoClick}
            style={{
              transform: logoClicked ? 'scale(0.94)' : 'scale(1)',
              transition: 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
            className="group flex items-center space-x-2.5 cursor-pointer focus:outline-none"
            title="VantageAudit Home"
          >
            <div className="w-7 h-7 rounded-lg bg-[rgba(232,179,57,0.12)] border border-[rgba(232,179,57,0.35)] flex items-center justify-center text-[var(--signal,#E8B339)] shadow-[0_0_16px_rgba(232,179,57,0.25)] group-hover:shadow-[0_0_22px_rgba(232,179,57,0.45)] group-hover:border-[var(--signal,#E8B339)] transition-all">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                <line x1="12" y1="22" x2="12" y2="15.5" />
                <polyline points="22 8.5 12 15.5 2 8.5" />
              </svg>
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-display font-bold text-white tracking-[-0.02em] text-sm group-hover:text-[var(--signal,#E8B339)] transition-colors">
                VantageAudit
              </span>
              <span className="text-[10px] font-mono font-medium text-slate-500 tracking-wider">
                v2.0
              </span>
            </div>
          </button>

          {/* Floating Pill Navigation */}
          <nav className="hidden md:flex items-center space-x-1 bg-white/[0.03] p-1 rounded-full border border-white/[0.06]">
            {navLinks.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 flex items-center space-x-1.5 ${
                    active
                      ? 'bg-[var(--signal,#E8B339)] text-[#090C12] font-bold shadow-[0_0_15px_rgba(232,179,57,0.4)]'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.05]'
                  }`}
                >
                  {active && <span className="w-1 h-1 rounded-full bg-[#090C12]" />}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Telemetry & Controls Section */}
        <div className="flex items-center space-x-3 text-xs">
          {USE_MOCKS && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold tracking-wider font-mono text-[10px] shadow-[0_0_10px_rgba(245,158,11,0.2)]">
              MOCK MODE
            </span>
          )}

          {/* Live Pipeline Telemetry HUD */}
          {counters && (
            <div
              className={`hidden sm:flex items-center space-x-3 font-mono transition-all px-3 py-1 rounded-xl border ${
                isPresenterMode
                  ? 'bg-[var(--signal,#E8B339)]/10 border-[var(--signal,#E8B339)]/40 text-[var(--signal,#E8B339)] text-xs font-bold shadow-[0_0_18px_rgba(232,179,57,0.2)]'
                  : 'bg-[#141822]/80 border-white/[0.06] text-slate-400 text-[11px]'
              }`}
            >
              <div className="flex items-center space-x-1.5" title="Cached LLM Calls">
                <Cpu className="w-3 h-3 text-sky-400" />
                <span>LLM: <strong className="text-white font-semibold">{counters.llm_calls}</strong></span>
              </div>
              <span className="text-white/20">|</span>
              <div className="flex items-center space-x-1.5" title="Committed Audit Ledger Rows">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Audit: <strong className="text-white font-semibold">{counters.audit_rows}</strong></span>
              </div>
              <span className="text-white/20">|</span>
              <div className="flex items-center space-x-1.5" title="Event Stream Messages">
                <Activity className="w-3 h-3 text-[var(--signal,#E8B339)]" />
                <span>Events: <strong className="text-white font-semibold">{counters.events}</strong></span>
              </div>
            </div>
          )}

          {/* Presenter Mode Toggle Button (P) */}
          <button
            onClick={onTogglePresenter}
            title="Toggle Presenter Mode (Shortcut: P)"
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isPresenterMode
                ? 'bg-[var(--signal,#E8B339)]/20 border-[var(--signal,#E8B339)] text-[var(--signal,#E8B339)] shadow-[0_0_15px_rgba(232,179,57,0.3)]'
                : 'border-white/[0.08] bg-[#141822]/60 text-slate-400 hover:text-white hover:border-white/[0.16]'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>

          {/* Developer / Demo Reset Button (Visible only when demoResetEnabled) */}
          {demoResetEnabled && (
            <button
              onClick={onOpenDevSettings}
              title="Developer & Demo Reset Station"
              className="p-1.5 rounded-lg border border-[var(--signal,#E8B339)]/30 bg-[var(--signal,#E8B339)]/10 text-[var(--signal,#E8B339)] hover:bg-[var(--signal,#E8B339)]/20 transition-all cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 animate-spin-slow" />
            </button>
          )}

          {/* Keyboard Shortcuts (?) Button */}
          <button
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts (Shortcut: ?)"
            className="p-1.5 rounded-lg border border-white/[0.08] bg-[#141822]/60 text-slate-400 hover:text-white hover:border-white/[0.16] transition-all cursor-pointer"
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
    fetchDevStatus()
      .then((res) => {
        setDemoResetEnabled(res.demo_reset_enabled);
      })
      .catch(() => setDemoResetEnabled(false));
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
      <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans selection:bg-[var(--signal,#E8B339)] selection:text-black">
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
          <div
            className={`fixed bottom-10 right-6 z-50 p-4 rounded-xl border shadow-2xl flex items-center space-x-3 text-xs font-mono animate-bounce backdrop-blur-xl ${
              toastType === 'error'
                ? 'border-rose-500/50 bg-[#141822]/95 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                : 'border-emerald-500/50 bg-[#141822]/95 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
            }`}
          >
            <RefreshCw className="w-4 h-4 animate-spin text-[var(--signal,#E8B339)]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Always-visible footer chip */}
        <footer className="fixed bottom-2.5 left-6 z-40 pointer-events-none">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-white/[0.08] bg-[#0E121A]/85 backdrop-blur-md text-[10px] font-mono text-slate-400 shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10B981]" />
            <span>Checkpointed · last checkpoint {lastCheckpointTime}</span>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};
