/**
 * IntroScreen — Aetheris-inspired scroll-snap narrative with sticky canvas backdrop.
 *
 * Architecture (matches Aetheris scrollytelling pattern):
 *   ┌─ outer wrapper (relative, overflow-y scroll-snap) ──────────────────────┐
 *   │  ┌─ sticky stage (position: sticky, top: 0, h: 100%) ─────────────────┐ │
 *   │  │  AuditStageCanvas (position: absolute, inset-0)                    │ │
 *   │  └─────────────────────────────────────────────────────────────────────┘ │
 *   │  ┌─ scenes overlay (margin-top: -100%, each section scroll-snap-start) ┐ │
 *   │  │  Section 1: Hero                                                    │ │
 *   │  │  Section 2: Dual Extraction                                         │ │
 *   │  │  Section 3: Four Checks (Validation)                                │ │
 *   │  │  Section 4: Human Review (HITL)                                     │ │
 *   │  │  Section 5: Durability                                              │ │
 *   │  │  Section 6: Final CTA                                               │ │
 *   │  └─────────────────────────────────────────────────────────────────────┘ │
 *   └────────────────────────────────────────────────────────────────────────────┘
 *
 * Scene detection: native scroll listener + getBoundingClientRect on each section.
 * IntersectionObserver re-arms section-specific reveals (cell animation, card fadein).
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Play,
  Pause,
  Scale,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  Cpu,
  Database,
} from 'lucide-react';
import { MagneticButton } from '../components/MagneticButton';
import { AuditStageCanvas, SceneId } from '../components/AuditStageCanvas';

// ─── Section registry ─────────────────────────────────────────────────────────
const SECTIONS: { id: string; sceneId: SceneId; label: string }[] = [
  { id: 'scene-hero',       sceneId: 'hero',       label: 'Hero' },
  { id: 'scene-extraction', sceneId: 'extraction', label: 'Extraction' },
  { id: 'scene-validation', sceneId: 'validation', label: 'Validation' },
  { id: 'scene-hitl',       sceneId: 'hitl',       label: 'Human Review' },
  { id: 'scene-durability', sceneId: 'durability', label: 'Durability' },
  { id: 'scene-cta',        sceneId: 'cta',        label: 'Enter' },
];

// ─── Glass card style (Aetheris-inspired, using VA tokens) ───────────────────
const glassCard = [
  'rounded-2xl',
  'bg-[rgba(27,31,40,0.78)]',
  'border border-[rgba(232,179,57,0.14)]',
  'backdrop-blur-[20px]',
  'shadow-[0_8px_40px_rgba(0,0,0,0.5)]',
].join(' ');

const glassCardLedger = [
  'rounded-2xl',
  'bg-[rgba(27,31,40,0.78)]',
  'border-x border-b border-[rgba(232,179,57,0.14)]',
  'border-t-2 border-t-[rgba(232,179,57,0.50)]',
  'backdrop-blur-[20px]',
  'shadow-[0_8px_40px_rgba(0,0,0,0.5)]',
].join(' ');

// ─── Component ─────────────────────────────────────────────────────────────────
export const IntroScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activeIdx, setActiveIdx]   = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // per-section reveal state
  const [dualVisible, setDualVisible] = useState(false);
  const [valVisible,  setValVisible]  = useState(false);
  const [hitlVisible, setHitlVisible] = useState(false);
  const [durVisible,  setDurVisible]  = useState(false);

  const outerRef = useRef<HTMLDivElement>(null); // the scroll container
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // ── reduced-motion ────────────────────────────────────────────────────────
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(q.matches);
    const h = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    q.addEventListener('change', h);
    return () => q.removeEventListener('change', h);
  }, []);

  // ── Scene detection: scroll listener on outer container ───────────────────
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const detect = () => {
      const ch = el.clientHeight;
      let best = 0;
      let bestDist = Infinity;
      sectionRefs.current.forEach((sec, i) => {
        if (!sec) return;
        const rect = sec.getBoundingClientRect();
        // how close is this section's center to the viewport center?
        const secCenter = rect.top + rect.height / 2;
        const vpCenter  = ch / 2;
        const dist = Math.abs(secCenter - vpCenter);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      setActiveIdx(best);
    };

    el.addEventListener('scroll', detect, { passive: true });
    detect();
    return () => el.removeEventListener('scroll', detect);
  }, []);

  // ── IntersectionObserver for per-section reveals ───────────────────────────
  useEffect(() => {
    const opts = { threshold: 0.5 };

    const makeObserver = (
      idx: number,
      onEnter: () => void,
      onLeave?: () => void
    ) => {
      const sec = sectionRefs.current[idx];
      if (!sec) return null;
      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) onEnter();
        else onLeave?.();
      }, opts);
      io.observe(sec);
      return io;
    };

    const ios = [
      makeObserver(1, () => setDualVisible(true), () => setDualVisible(false)),
      makeObserver(2, () => setValVisible(true),  () => setValVisible(false)),
      makeObserver(3, () => setHitlVisible(true), () => setHitlVisible(false)),
      makeObserver(4, () => setDurVisible(true),  () => setDurVisible(false)),
    ];
    return () => ios.forEach(io => io?.disconnect());
  }, []);

  // ── Scroll to section ─────────────────────────────────────────────────────
  const scrollToSection = useCallback((idx: number) => {
    const sec = sectionRefs.current[idx];
    if (!sec) return;
    sec.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }, [prefersReducedMotion]);

  const SH = 'h-[calc(100vh-3.5rem)]'; // section height shorthand

  return (
    <div
      ref={outerRef}
      className={`relative w-full ${SH} overflow-y-auto`}
      style={{
        scrollSnapType: prefersReducedMotion ? 'none' : 'y mandatory',
        scrollBehavior: prefersReducedMotion ? 'auto' : 'smooth',
        background: 'var(--ink, #12151C)',
      }}
    >
      {/* ════════════════════════════════════════════════════════════════════
          STICKY BACKDROP — always visible, scene-driven canvas animation
          (Aetheris pattern: position:sticky + margin-top:-100% on scenes)
         ════════════════════════════════════════════════════════════════════ */}
      <div
        className={`sticky top-0 ${SH} overflow-hidden pointer-events-none`}
        aria-hidden="true"
        style={{ zIndex: 0 }}
      >
        <AuditStageCanvas
          scene={SECTIONS[activeIdx]?.sceneId ?? 'hero'}
          prefersReducedMotion={prefersReducedMotion}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SCENES OVERLAY — overlaps sticky layer via negative margin
         ════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          marginTop: `calc(-1 * (100vh - 3.5rem))`,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* ── SECTION 1: HERO ─────────────────────────────────────────────── */}
        <section
          id="scene-hero"
          ref={(el) => { sectionRefs.current[0] = el; }}
          className={`relative w-full ${SH} flex flex-col items-center justify-center text-center px-6`}
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-slate-700/60 bg-[#1B1F28]/90 text-slate-300 text-xs font-medium tracking-wide mb-6 backdrop-blur-sm"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--signal,#E8B339)]" />
              <span>
                PS-01 <span className="text-slate-500 font-light mx-0.5">|</span>{' '}
                Human-in-the-Loop Financial Filing Auditor
              </span>
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
              VantageAudit parses SEC 10-K HTML visually, corroborates dual independent extractors,
              validates accounting identities, pauses durably for human review, and mathematically
              proves survival through unexpected mid-run kills.
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.38 }}
              className="mb-6"
            >
              <MagneticButton
                maxShift={8}
                onClick={() => navigate('/mission')}
                className="px-8 py-4 rounded-xl bg-[var(--signal,#E8B339)] text-[#12151C] font-bold text-base hover:shadow-[0_0_28px_-4px_rgba(232,179,57,0.5)] hover:brightness-105 flex items-center space-x-3 transition-all cursor-pointer font-sans"
              >
                <span>Enter Mission Control</span>
                <ArrowRight className="w-5 h-5 text-[#12151C]" />
              </MagneticButton>
              <div className="text-xs text-slate-400/60 mt-2 font-mono">
                10-15s skippable demo intro
              </div>
            </motion.div>

            {/* Scroll hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.6 }}
              className="flex flex-col items-center text-slate-500 mt-2"
            >
              <span className="text-[10px] font-mono tracking-widest uppercase mb-1">scroll</span>
              <svg width="14" height="20" viewBox="0 0 14 20" className="animate-bounce" aria-hidden>
                <rect x="5" y="2" width="4" height="4" rx="2" fill="currentColor" opacity="0.5" />
                <rect x="6" y="1" width="2" height="18" rx="1" fill="currentColor" opacity="0.15" />
              </svg>
            </motion.div>
          </div>
        </section>

        {/* ── SECTION 2: DUAL EXTRACTION ──────────────────────────────────── */}
        <section
          id="scene-extraction"
          ref={(el) => { sectionRefs.current[1] = el; }}
          className={`relative w-full ${SH} flex flex-col items-center justify-center px-6`}
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="max-w-5xl w-full mx-auto flex flex-col items-center">
            <div className="text-xs font-mono uppercase tracking-widest text-[var(--signal,#E8B339)] mb-2 opacity-80">
              Consensus Protocol · Independent Corroboration
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-white mb-4 text-center tracking-tight">
              Two extractors. One truth.
            </h2>
            <p className="text-sm md:text-base text-slate-400/90 max-w-2xl text-center mb-10 font-sans">
              Regex rule matching runs parallel to temperature-0 LLM visual parsing.
              Extractor disagreement caps confidence at&nbsp;0.40.
            </p>

            {/* Comparison grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-4xl">
              {/* Rules engine */}
              <div className={`p-6 ${glassCardLedger}`}>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/70">
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
                    { label: 'Revenue (Current)',    val: '$391,035M', delay: 0 },
                    { label: 'Net Income (Current)', val: '$93,736M',  delay: 80 },
                    { label: 'Total Assets',         val: '$364,980M', delay: 160 },
                    { label: 'Total Liabilities',    val: '$308,030M', delay: 240 },
                  ].map((row) => (
                    <div
                      key={row.label}
                      style={{
                        animationDelay:
                          prefersReducedMotion || !dualVisible ? '0ms' : `${row.delay}ms`,
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-lg border border-slate-800/80 text-xs transition-colors ${
                        dualVisible && !prefersReducedMotion
                          ? 'animate-cell-reveal'
                          : 'bg-[#12151C] opacity-100'
                      }`}
                    >
                      <span className="text-slate-400 font-sans">{row.label}</span>
                      <span className="font-mono font-medium text-slate-200">{row.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* LLM parser */}
              <div className={`p-6 ${glassCardLedger}`}>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/70">
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
                    { label: 'Revenue (Current)',    val: '$391,035M', delay: 40 },
                    { label: 'Net Income (Current)', val: '$93,736M',  delay: 120 },
                    { label: 'Total Assets',         val: '$364,980M', delay: 200 },
                    { label: 'Total Liabilities',    val: '$308,030M', delay: 280 },
                  ].map((row) => (
                    <div
                      key={row.label}
                      style={{
                        animationDelay:
                          prefersReducedMotion || !dualVisible ? '0ms' : `${row.delay}ms`,
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-lg border border-slate-800/80 text-xs ${
                        dualVisible && !prefersReducedMotion
                          ? 'animate-cell-reveal'
                          : 'bg-[#12151C] opacity-100'
                      }`}
                    >
                      <span className="text-slate-400 font-sans">{row.label}</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-medium text-emerald-300">{row.val}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Consensus badge */}
            <div
              className="mt-6 inline-flex items-center space-x-2 px-4 py-2 rounded-full border border-[rgba(232,179,57,0.3)] bg-[rgba(232,179,57,0.07)] text-[var(--signal,#E8B339)] text-xs font-mono"
              style={{
                opacity: dualVisible || prefersReducedMotion ? 1 : 0,
                transform: dualVisible || prefersReducedMotion ? 'translateY(0)' : 'translateY(10px)',
                transition: 'opacity 0.5s ease 0.4s, transform 0.5s ease 0.4s',
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Consensus reached · confidence 0.91 · auto-approved</span>
            </div>
          </div>
        </section>

        {/* ── SECTION 3: FOUR CHECKS ──────────────────────────────────────── */}
        <section
          id="scene-validation"
          ref={(el) => { sectionRefs.current[2] = el; }}
          className={`relative w-full ${SH} flex flex-col items-center justify-center px-6`}
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="max-w-5xl w-full mx-auto flex flex-col items-center">
            <div className="text-xs font-mono uppercase tracking-widest text-[var(--signal,#E8B339)] mb-2 opacity-80">
              Mathematical Invariants · Multi-Statement Verification
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-white mb-4 text-center tracking-tight">
              Four checks, every time.
            </h2>
            <p className="text-sm md:text-base text-slate-400/90 max-w-2xl text-center mb-10 font-sans">
              Accounting theorems must hold before numbers pass. Any breakdown
              triggers an automatic quarantine.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
              {[
                {
                  title: 'Accounting Equation',
                  desc: 'Total Assets = Total Liabilities + Stockholders\u2019 Equity (\u00b10.5% tolerance).',
                  icon: Scale,       delay: 0,
                },
                {
                  title: 'Segment Validation',
                  desc: 'Sum of operating segment revenues corroborates total consolidated revenue.',
                  icon: Layers,      delay: 110,
                },
                {
                  title: 'Year-on-Year Analysis',
                  desc: 'Detects unexpected variance shifts greater than \u00b150% against prior-year filing.',
                  icon: TrendingUp,  delay: 220,
                },
                {
                  title: 'Cross-Statement Check',
                  desc: 'Reconciles Income Statement Net Income against starting operating cash flow.',
                  icon: FileSpreadsheet, delay: 330,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    style={{
                      opacity:    valVisible || prefersReducedMotion ? 1 : 0,
                      transform:  valVisible || prefersReducedMotion ? 'translateY(0)' : 'translateY(18px)',
                      transition: `opacity 0.45s ease ${item.delay}ms, transform 0.45s cubic-bezier(0.16,1,0.3,1) ${item.delay}ms`,
                    }}
                    className={`p-5 ${glassCardLedger} flex items-start space-x-3.5`}
                  >
                    <div className="p-2.5 rounded-lg bg-[rgba(232,179,57,0.10)] text-[var(--signal,#E8B339)] border border-[rgba(232,179,57,0.25)] shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-slate-100 mb-1">{item.title}</h3>
                      <p className="text-xs text-slate-400/90 leading-relaxed font-sans">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── SECTION 4: HUMAN-IN-THE-LOOP ───────────────────────────────── */}
        <section
          id="scene-hitl"
          ref={(el) => { sectionRefs.current[3] = el; }}
          className={`relative w-full ${SH} flex flex-col items-center justify-center px-6`}
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="max-w-5xl w-full mx-auto flex flex-col items-center">
            <div className="text-xs font-mono uppercase tracking-widest text-[var(--signal,#E8B339)] mb-2 opacity-80">
              LangGraph Native Interrupt · Durable Triage
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-white mb-4 text-center tracking-tight">
              It pauses. You decide.
            </h2>
            <p className="text-sm md:text-base text-slate-400/90 max-w-2xl text-center mb-10 font-sans">
              Autonomous execution halts before untrusted figures enter report ledgers.
              Reviewers approve, correct, or reject with immutable audit trail.
            </p>

            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-4xl"
              style={{
                opacity:   hitlVisible || prefersReducedMotion ? 1 : 0,
                transform: hitlVisible || prefersReducedMotion ? 'translateY(0)' : 'translateY(22px)',
                transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              {/* Running state */}
              <div className={`p-5 ${glassCard} flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/60">
                    <span className="font-mono text-xs text-slate-400">STATE: RUNNING</span>
                    <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-mono flex items-center space-x-1">
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Pipeline Active</span>
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 mb-2">
                    Current Node: <span className="text-sky-300">validate</span>
                  </div>
                  <p className="text-xs text-slate-400/80 font-sans leading-normal">
                    Pipeline executes automated ingestion, table localization, dual consensus
                    matching, and formula checks in millisecond batches.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center text-[11px] text-slate-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse mr-2 shrink-0" />
                  Streaming events through persistent event bus...
                </div>
              </div>

              {/* Paused / interrupted state */}
              <div className={`p-5 ${glassCardLedger} flex flex-col`}>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/60">
                  <span className="font-mono text-xs text-amber-400">STATE: PAUSED</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-mono flex items-center space-x-1">
                    <Pause className="w-2.5 h-2.5" />
                    <span>Human Review Interrupt</span>
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[rgba(18,21,28,0.8)] border border-amber-500/20 mb-3 flex-1">
                  <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                    <span className="text-white font-bold">Total Shareholders&apos; Equity</span>
                    <span className="text-amber-400">LOW_CONF: 0.65</span>
                  </div>
                  <div className="text-[11px] text-slate-400/80 font-sans leading-snug">
                    Extracted table row contains ambiguous non-controlling interest split.
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30">
                    Approve
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[var(--signal,#E8B339)] text-[#12151C] text-[10px] font-mono font-bold">
                    Correct & Revalidate
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold border border-rose-500/30">
                    Reject
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 5: DURABILITY ────────────────────────────────────────── */}
        <section
          id="scene-durability"
          ref={(el) => { sectionRefs.current[4] = el; }}
          className={`relative w-full ${SH} flex flex-col items-center justify-center px-6`}
          style={{ scrollSnapAlign: 'start' }}
        >
          <div
            className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center"
            style={{
              opacity:   durVisible || prefersReducedMotion ? 1 : 0,
              transform: durVisible || prefersReducedMotion ? 'translateY(0)' : 'translateY(28px)',
              transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <div className="p-3.5 rounded-2xl bg-[rgba(232,179,57,0.12)] text-[var(--signal,#E8B339)] border border-[rgba(232,179,57,0.30)] mb-5 shadow-[0_0_28px_rgba(232,179,57,0.18)]">
              <RefreshCw className="w-8 h-8" />
            </div>

            <div className="text-xs font-mono uppercase tracking-widest text-[var(--signal,#E8B339)] mb-3 opacity-80">
              Durable SQLite Checkpointer · Zero Duplicate LLM Calls
            </div>

            <h2 className="font-display font-bold text-4xl md:text-6xl text-white mb-6 tracking-tight leading-[1.1]">
              Killed mid-run.{' '}
              <span className="block text-[var(--signal,#E8B339)]">Nothing lost.</span>
            </h2>

            <div className={`p-7 ${glassCardLedger} max-w-3xl text-left mb-6`}>
              <p className="text-base md:text-lg text-slate-300/90 font-sans leading-relaxed mb-5">
                AsyncSqliteSaver persists state at every node. Human review interrupts pause
                execution, surviving hard{' '}
                <code className="px-1.5 py-0.5 rounded bg-[#12151C] text-[var(--signal,#E8B339)] font-mono text-sm border border-slate-800">
                  kill -9
                </code>{' '}
                restarts with zero duplicate LLM calls.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 border-t border-slate-800/60 font-mono text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] mb-1">RECOVERY MECHANISM</span>
                  <span className="text-white font-bold">ainvoke(None, config)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] mb-1">CACHE INTEGRITY</span>
                  <span className="text-white font-bold">sha256(model+prompt)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] mb-1">RESUME STATUS</span>
                  <span className="text-emerald-400 font-bold">system_recovered ✓</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 6: FINAL CTA ────────────────────────────────────────── */}
        <section
          id="scene-cta"
          ref={(el) => { sectionRefs.current[5] = el; }}
          className={`relative w-full ${SH} flex flex-col items-center justify-center text-center px-6`}
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="max-w-3xl mx-auto flex flex-col items-center relative z-10">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-slate-700/60 bg-[#1B1F28]/90 text-slate-300 text-xs font-medium tracking-wide mb-6 backdrop-blur-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--signal,#E8B339)]" />
              <span>Full Pipeline Deployment Ready</span>
            </div>

            <h2 className="font-display font-bold text-4xl md:text-5xl text-white mb-6 tracking-tight">
              Ready to explore the financial audit ledger?
            </h2>
            <p className="font-sans text-base text-slate-400/90 max-w-xl mb-10 leading-relaxed">
              Launch live runs across 8 SEC-pinned corporate filings, inject anomalies, and witness
              autonomous corroboration in real time.
            </p>

            <MagneticButton
              maxShift={10}
              onClick={() => navigate('/mission')}
              className="px-10 py-5 rounded-2xl bg-[var(--signal,#E8B339)] text-[#12151C] font-bold text-lg hover:shadow-[0_0_36px_-4px_rgba(232,179,57,0.55)] hover:brightness-105 flex items-center space-x-3 transition-all cursor-pointer font-sans"
            >
              <span>Enter Mission Control</span>
              <ArrowRight className="w-6 h-6 text-[#12151C]" />
            </MagneticButton>

            <div className="text-xs text-slate-400/60 mt-3 font-mono">10-15s skippable demo intro</div>
          </div>
        </section>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          FIXED UI CHROME — dots nav, skip button
         ════════════════════════════════════════════════════════════════════ */}

      {/* Skip button */}
      <div className="fixed top-18 right-8 z-50 pointer-events-auto">
        <button
          onClick={() => navigate('/mission')}
          className="group px-3 py-1.5 rounded-lg border border-slate-700/80 bg-[#1B1F28]/90 hover:bg-[#242936] text-xs font-mono text-slate-400 hover:text-white flex items-center space-x-2 transition-all shadow-lg backdrop-blur"
          title="Skip intro to Mission Control"
        >
          <span>Skip Demo Intro</span>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--signal,#E8B339)] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Scene indicator — bottom-left (Aetheris .sn-scene-indicator) */}
      <div className="fixed bottom-8 left-8 z-50 flex items-center space-x-3 pointer-events-none">
        <div className="relative w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-[var(--signal,#E8B339)] opacity-50 animate-ping" />
          <span className="relative w-2 h-2 rounded-full bg-[var(--signal,#E8B339)] block" />
        </div>
        <span className="font-mono text-[10px] text-slate-500 tracking-widest">
          <span className="text-[var(--signal,#E8B339)]">0{activeIdx + 1}</span>
          <span className="mx-1.5 opacity-40">/</span>
          06
          <span className="mx-2 opacity-30">·</span>
          <span className="text-slate-400">{SECTIONS[activeIdx]?.label}</span>
        </span>
      </div>

      {/* Dot nav — right edge */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center space-y-3">
        {SECTIONS.map((sec, i) => {
          const isActive = activeIdx === i;
          return (
            <button
              key={sec.id}
              onClick={() => scrollToSection(i)}
              className="group relative flex items-center justify-end p-1 cursor-pointer focus:outline-none"
              title={sec.label}
            >
              <span className="absolute right-6 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap backdrop-blur-sm">
                {sec.label}
              </span>
              <span
                className={`rounded-full transition-all duration-300 ${
                  isActive
                    ? 'w-2.5 h-2.5 bg-[var(--signal,#E8B339)] scale-125 shadow-[0_0_10px_rgba(232,179,57,0.65)]'
                    : 'w-2 h-2 bg-slate-700 hover:bg-slate-500 scale-90'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
