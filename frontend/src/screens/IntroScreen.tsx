import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Cpu,
  ArrowRight,
  RefreshCw,
  Database,
  CheckCircle2,
  Play,
  Pause,
  Scale,
  TrendingUp,
  FileSpreadsheet,
  Layers
} from 'lucide-react';
import { MagneticButton } from '../components/MagneticButton';

const SECTIONS = [
  { id: 'hero', label: 'Hero' },
  { id: 'dual-extraction', label: 'Dual Extraction' },
  { id: 'validation', label: 'Four Checks' },
  { id: 'human-review', label: 'Human Review' },
  { id: 'durability', label: 'Durability' },
  { id: 'cta', label: 'Enter' }
];

export const IntroScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Section visibility states
  const [dualVisible, setDualVisible] = useState(false);
  const [valVisible, setValVisible] = useState(false);

  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(q.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    q.addEventListener('change', handler);
    return () => q.removeEventListener('change', handler);
  }, []);

  // Update active section on scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const top = el.scrollTop;
      const height = el.clientHeight;
      const idx = Math.min(
        SECTIONS.length - 1,
        Math.max(0, Math.round(top / height))
      );
      setActiveSection(idx);

      if (idx >= 1) setDualVisible(true);
      if (idx >= 2) setValVisible(true);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (idx: number) => {
    if (!containerRef.current) return;
    const targetY = idx * containerRef.current.clientHeight;
    containerRef.current.scrollTo({
      top: targetY,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
  };

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] overflow-hidden bg-[var(--ink,#12151C)] text-slate-100">
      {/* Persistent 10-15s skippable demo intro affordance */}
      <div className="fixed top-18 right-8 z-40 pointer-events-auto">
        <button
          onClick={() => navigate('/mission')}
          className="group px-3 py-1.5 rounded-lg border border-slate-700/80 bg-[#1B1F28]/90 hover:bg-[#242936] text-xs font-mono text-slate-400 hover:text-white flex items-center space-x-2 transition-all shadow-lg backdrop-blur"
          title="Skip intro to Mission Control"
        >
          <span>Skip Demo Intro</span>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--signal,#E8B339)] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Floating Vertical Section Navigation Dots */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center space-y-3">
        {SECTIONS.map((sec, i) => {
          const isActive = activeSection === i;
          return (
            <button
              key={sec.id}
              onClick={() => scrollToSection(i)}
              className="group relative flex items-center justify-end p-1 cursor-pointer focus:outline-none"
              title={sec.label}
            >
              {/* Tooltip Label */}
              <span className="absolute right-6 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {sec.label}
              </span>
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  isActive
                    ? 'bg-[var(--signal,#E8B339)] scale-125 shadow-[0_0_10px_rgba(232,179,57,0.6)]'
                    : 'bg-slate-700 hover:bg-slate-500 scale-90'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Main Scroll Container with Scroll-Snap */}
      <div
        ref={containerRef}
        className={`w-full h-full overflow-y-auto ${
          prefersReducedMotion ? 'scroll-auto' : 'scroll-smooth'
        }`}
        style={{
          scrollSnapType: prefersReducedMotion ? 'none' : 'y mandatory',
          scrollBehavior: prefersReducedMotion ? 'auto' : 'smooth'
        }}
      >
        {/* =========================================================================
            SECTION 1: HERO
           ========================================================================= */}
        <section
          id="section-hero"
          className="relative w-full h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center text-center px-6"
          style={{ scrollSnapAlign: 'start' }}
        >
          {/* Subtle static amber radial gradient */}
          <div
            className="pointer-events-none absolute top-12 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full blur-[140px]"
            style={{
              background: 'radial-gradient(circle, rgba(232, 179, 57, 0.055) 0%, rgba(18, 21, 28, 0) 70%)',
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:28px_28px] opacity-25" />

          <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-slate-700/60 bg-[#1B1F28]/80 text-slate-300 text-xs font-medium tracking-wide mb-6"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--signal,#E8B339)]" />
              <span>PS-01 <span className="text-slate-500 font-light mx-0.5">|</span> Human-in-the-Loop Financial Filing Auditor</span>
            </motion.div>

            {/* Headline */}
            <h1 className="font-display font-bold text-5xl md:text-6xl tracking-tight text-white mb-6 leading-[1.12]">
              <motion.span
                className="block"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              >
                A financial AI that knows
              </motion.span>
              <motion.span
                className="block text-[var(--signal,#E8B339)]"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                when to distrust itself
              </motion.span>
            </h1>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.32 }}
              className="font-sans text-lg md:text-xl text-slate-300/80 max-w-3xl mb-10 leading-relaxed font-normal"
            >
              VantageAudit parses SEC 10-K HTML visually, corroborates dual independent extractors, validates accounting
              identities, pauses durably for human review, and mathematically proves survival through unexpected mid-run kills.
            </motion.p>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.38 }}
              className="mb-6"
            >
              <MagneticButton
                maxShift={8}
                onClick={() => navigate('/mission')}
                className="px-8 py-4 rounded-xl bg-[var(--signal,#E8B339)] text-[#12151C] font-bold text-base hover:shadow-[0_0_25px_-4px_rgba(232,179,57,0.45)] hover:brightness-105 flex items-center space-x-3 transition-all cursor-pointer font-sans"
              >
                <span>Enter Mission Control</span>
                <ArrowRight className="w-5 h-5 text-[#12151C]" />
              </MagneticButton>
              <div className="text-xs text-slate-400/60 mt-2 font-mono">10-15s skippable demo intro</div>
            </motion.div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 2: DUAL EXTRACTION
           ========================================================================= */}
        <section
          id="section-dual-extraction"
          className="relative w-full h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-6"
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="max-w-5xl w-full mx-auto flex flex-col items-center">
            <div className="text-xs font-mono uppercase tracking-widest text-[var(--signal,#E8B339)] mb-2">
              Consensus Protocol · Independent Corroboration
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-white mb-4 text-center tracking-tight">
              Two extractors. One truth.
            </h2>
            <p className="text-sm md:text-base text-slate-400 max-w-2xl text-center mb-10 font-sans">
              Regex rule matching runs parallel to temperature-0 LLM visual parsing on plain located tables. Extractor disagreement caps confidence at 0.40.
            </p>

            {/* Comparison Grid with Cell Reveal Stagger */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
              {/* Column 1: Rules Engine */}
              <div className="p-6 rounded-xl bg-[var(--ink-raised,#1B1F28)] border-x border-b border-slate-800/80 border-t-2 border-t-[rgba(232,179,57,0.50)] shadow-none">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-4 h-4 text-sky-400" />
                    <span className="font-display font-bold text-sm text-slate-200">Rules Extractor</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    Deterministic RegEx
                  </span>
                </div>

                <div className="space-y-2.5">
                  {[
                    { label: 'Revenue (Current)', val: '$391,035M', delay: 0 },
                    { label: 'Net Income (Current)', val: '$93,736M', delay: 80 },
                    { label: 'Total Assets', val: '$364,980M', delay: 160 },
                    { label: 'Total Liabilities', val: '$308,030M', delay: 240 }
                  ].map((row) => (
                    <div
                      key={row.label}
                      style={{
                        animationDelay: prefersReducedMotion || !dualVisible ? '0ms' : `${row.delay}ms`,
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-lg border border-slate-800/80 text-xs ${
                        dualVisible && !prefersReducedMotion ? 'animate-cell-reveal' : 'bg-[#12151C]'
                      }`}
                    >
                      <span className="text-slate-400 font-sans">{row.label}</span>
                      <span className="font-mono font-medium text-slate-200">{row.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: Visual LLM Engine */}
              <div className="p-6 rounded-xl bg-[var(--ink-raised,#1B1F28)] border-x border-b border-slate-800/80 border-t-2 border-t-[rgba(232,179,57,0.50)] shadow-none">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span className="font-display font-bold text-sm text-slate-200">LLM Visual Parser</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Temperature 0 · Strict JSON
                  </span>
                </div>

                <div className="space-y-2.5">
                  {[
                    { label: 'Revenue (Current)', val: '$391,035M', match: true, delay: 40 },
                    { label: 'Net Income (Current)', val: '$93,736M', match: true, delay: 120 },
                    { label: 'Total Assets', val: '$364,980M', match: true, delay: 200 },
                    { label: 'Total Liabilities', val: '$308,030M', match: true, delay: 280 }
                  ].map((row) => (
                    <div
                      key={row.label}
                      style={{
                        animationDelay: prefersReducedMotion || !dualVisible ? '0ms' : `${row.delay}ms`,
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-lg border border-slate-800/80 text-xs ${
                        dualVisible && !prefersReducedMotion ? 'animate-cell-reveal' : 'bg-[#12151C]'
                      }`}
                    >
                      <span className="text-slate-400 font-sans">{row.label}</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-medium text-emerald-300">{row.val}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 3: CONFIDENCE & VALIDATION
           ========================================================================= */}
        <section
          id="section-validation"
          className="relative w-full h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-6"
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="max-w-5xl w-full mx-auto flex flex-col items-center">
            <div className="text-xs font-mono uppercase tracking-widest text-[var(--signal,#E8B339)] mb-2">
              Mathematical Invariants · Multi-Statement Verification
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-white mb-4 text-center tracking-tight">
              Four checks, every time.
            </h2>
            <p className="text-sm md:text-base text-slate-400 max-w-2xl text-center mb-10 font-sans">
              Accounting theorems must hold before numbers pass. Any breakdown triggers an automatic quarantine.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
              {[
                {
                  title: 'Accounting Equation',
                  desc: 'Total Assets = Total Liabilities + Total Stockholders’ Equity (±0.5% tolerance).',
                  icon: Scale,
                  delay: 0
                },
                {
                  title: 'Segment Validation',
                  desc: 'Sum of operating business segment revenues corroborates total consolidated revenue.',
                  icon: Layers,
                  delay: 100
                },
                {
                  title: 'Year-on-Year Analysis',
                  desc: 'Detects unexpected variance shifts greater than ±50% against historical prior-year filing.',
                  icon: TrendingUp,
                  delay: 200
                },
                {
                  title: 'Cross-Statement Check',
                  desc: 'Reconciles Income Statement Net Income against starting operating cash flow balance.',
                  icon: FileSpreadsheet,
                  delay: 300
                }
              ].map((item) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.title}
                    style={{
                      opacity: prefersReducedMotion || valVisible ? 1 : 0,
                      transform: prefersReducedMotion || valVisible ? 'translateY(0)' : 'translateY(16px)',
                      transition: `opacity 0.4s ease-out ${item.delay}ms, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${item.delay}ms`
                    }}
                    className="p-5 rounded-xl bg-[var(--ink-raised,#1B1F28)] border-x border-b border-slate-800/80 border-t-2 border-t-[rgba(232,179,57,0.50)] flex items-start space-x-3.5 shadow-none"
                  >
                    <div className="p-2.5 rounded-lg bg-[rgba(232,179,57,0.10)] text-[var(--signal,#E8B339)] border border-[rgba(232,179,57,0.25)] shrink-0">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-slate-100 mb-1">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed font-sans">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 4: HUMAN-IN-THE-LOOP (PAUSE & DECIDE)
           ========================================================================= */}
        <section
          id="section-human-review"
          className="relative w-full h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-6"
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="max-w-5xl w-full mx-auto flex flex-col items-center">
            <div className="text-xs font-mono uppercase tracking-widest text-[var(--signal,#E8B339)] mb-2">
              LangGraph Native Interrupt · Durable Triage
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-white mb-4 text-center tracking-tight">
              It pauses. You decide.
            </h2>
            <p className="text-sm md:text-base text-slate-400 max-w-2xl text-center mb-10 font-sans">
              Autonomous execution halts before untrusted figures enter report ledgers. Reviewers approve, correct, or reject with audit trail immutability.
            </p>

            {/* Before / After Mockup */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
              {/* Running State */}
              <div className="p-5 rounded-xl bg-[var(--ink-raised,#1B1F28)] border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                    <span className="font-mono text-xs text-slate-400">STATE: RUNNING</span>
                    <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-mono flex items-center space-x-1">
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Pipeline Active</span>
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 mb-2">Current Node: <span className="text-sky-300">validate</span></div>
                  <p className="text-xs text-slate-400 font-sans leading-normal">
                    Pipeline executes automated ingestion, table localization, dual consensus matching, and formula checks in millisecond batches.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center text-[11px] text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse mr-2" />
                  Streaming events through persistent event bus...
                </div>
              </div>

              {/* Interrupted / Paused State */}
              <div className="p-5 rounded-xl bg-[var(--ink-raised,#1B1F28)] border-x border-b border-slate-800 border-t-2 border-t-[var(--signal,#E8B339)]">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <span className="font-mono text-xs text-amber-400">STATE: PAUSED</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-mono flex items-center space-x-1">
                    <Pause className="w-2.5 h-2.5" />
                    <span>Human Review Interrupted</span>
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-[#12151C] border border-amber-500/20 mb-3">
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="text-white font-bold">Total Shareholders' Equity</span>
                    <span className="text-amber-400">LOW_CONF: 0.65</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Extracted table row contains ambiguous non-controlling interest split.
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30">
                    Approve
                  </span>
                  <span className="px-2.5 py-1 rounded bg-[var(--signal,#E8B339)] text-[#12151C] text-[10px] font-mono font-bold">
                    Correct & Revalidate
                  </span>
                  <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold border border-rose-500/30">
                    Reject
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 5: DURABILITY (KILLED MID-RUN. NOTHING LOST.)
           ========================================================================= */}
        <section
          id="section-durability"
          className="relative w-full h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-6"
          style={{ scrollSnapAlign: 'start' }}
        >
          {/* Subtle amber pulse backdrop */}
          <div
            className="pointer-events-none absolute w-[600px] h-[400px] rounded-full blur-[160px]"
            style={{
              background: 'radial-gradient(circle, rgba(232, 179, 57, 0.08) 0%, rgba(18, 21, 28, 0) 70%)',
            }}
          />

          <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center">
            <div className="p-3 rounded-xl bg-[rgba(232,179,57,0.12)] text-[var(--signal,#E8B339)] border border-[rgba(232,179,57,0.30)] mb-4 shadow-[0_0_20px_rgba(232,179,57,0.2)]">
              <RefreshCw className="w-7 h-7" />
            </div>

            <div className="text-xs font-mono uppercase tracking-widest text-[var(--signal,#E8B339)] mb-2">
              Durable SQLite Checkpointer · Zero Duplicate LLM Calls
            </div>

            <h2 className="font-display font-bold text-4xl md:text-6xl text-white mb-6 tracking-tight leading-[1.1]">
              Killed mid-run. <br />
              <span className="text-[var(--signal,#E8B339)]">Nothing lost.</span>
            </h2>

            <div className="p-6 rounded-2xl bg-[var(--ink-raised,#1B1F28)] border-x border-b border-slate-800 border-t-2 border-t-[var(--signal,#E8B339)] max-w-3xl text-left shadow-2xl mb-6">
              <p className="text-base text-slate-300 font-sans leading-relaxed mb-4">
                AsyncSqliteSaver persists state at every node. Human review interrupts pause execution, surviving hard <code className="px-1.5 py-0.5 rounded bg-[#12151C] text-[var(--signal,#E8B339)] font-mono text-sm border border-slate-800">kill -9</code> restarts with zero duplicate LLM calls.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800 font-mono text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">RECOVERY MECHANISM</span>
                  <span className="text-white font-bold">ainvoke(None, config)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CACHE INTEGRITY</span>
                  <span className="text-white font-bold">sha256(model+prompt)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">RESUME STATUS</span>
                  <span className="text-emerald-400 font-bold">system_recovered</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 6: FINAL CTA
           ========================================================================= */}
        <section
          id="section-cta"
          className="relative w-full h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center text-center px-6"
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="max-w-3xl mx-auto flex flex-col items-center">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-slate-700/60 bg-[#1B1F28]/80 text-slate-300 text-xs font-medium tracking-wide mb-6">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--signal,#E8B339)]" />
              <span>Full Pipeline Deployment Ready</span>
            </div>

            <h2 className="font-display font-bold text-4xl md:text-5xl text-white mb-6 tracking-tight">
              Ready to explore the financial audit ledger?
            </h2>
            <p className="font-sans text-base text-slate-400 max-w-xl mb-10 leading-relaxed">
              Launch live runs across 8 SEC-pinned corporate filings, inject anomalies, and witness autonomous corroboration in real time.
            </p>

            <MagneticButton
              maxShift={10}
              onClick={() => navigate('/mission')}
              className="px-10 py-5 rounded-2xl bg-[var(--signal,#E8B339)] text-[#12151C] font-bold text-lg hover:shadow-[0_0_30px_-4px_rgba(232,179,57,0.5)] hover:brightness-105 flex items-center space-x-3 transition-all cursor-pointer font-sans"
            >
              <span>Enter Mission Control</span>
              <ArrowRight className="w-6 h-6 text-[#12151C]" />
            </MagneticButton>

            <div className="text-xs text-slate-400/60 mt-3 font-mono">10-15s skippable demo intro</div>
          </div>
        </section>
      </div>
    </div>
  );
};
