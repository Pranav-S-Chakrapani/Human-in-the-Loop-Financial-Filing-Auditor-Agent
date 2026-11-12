/**
 * IntroScreen — Elevated Editorial Scrollytelling for VantageAudit.
 *
 * Design Language:
 * - Architected for clarity & elegance over stuffiness (Linear / Stripe Press meets high-precision financial auditing)
 * - Strict spacing rhythm ("Same spacing everywhere"): uniform gaps, unified card architecture
 * - Distinctive typography hierarchy: Space Grotesk display + JetBrains Mono telemetry + Inter copy
 * - Two-tone editorial punch headlines (Off-white / Electric Amber)
 * - Tactile interaction states ("Taps should answer back"): magnetic button with press dip
 * - Sticky dynamic canvas background (`AuditStageCanvas`) synchronized with active scroll scene
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Pause,
  Scale,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  Cpu,
  Database,
  Terminal,
} from 'lucide-react';
import { MagneticButton } from '../components/MagneticButton';
import { AuditStageCanvas, SceneId } from '../components/AuditStageCanvas';

// ─── Section Definition ───────────────────────────────────────────────────────
const SECTIONS: { id: string; sceneId: SceneId; tag: string; label: string }[] = [
  { id: 'scene-hero',       sceneId: 'hero',       tag: '01 // THESIS',        label: 'Autonomous Trust' },
  { id: 'scene-extraction', sceneId: 'extraction', tag: '02 // CONSENSUS',     label: 'Dual Extractor' },
  { id: 'scene-validation', sceneId: 'validation', tag: '03 // INVARIANTS',    label: 'Four Checks' },
  { id: 'scene-hitl',       sceneId: 'hitl',       tag: '04 // INTERRUPT',     label: 'Human-in-the-Loop' },
  { id: 'scene-durability', sceneId: 'durability', tag: '05 // PERSISTENCE',   label: 'Zero Data Loss' },
  { id: 'scene-cta',        sceneId: 'cta',        tag: '06 // DEPLOYMENT',    label: 'Mission Control' },
];

export const IntroScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activeIdx, setActiveIdx] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Per-section animated reveal triggers
  const [dualVisible, setDualVisible] = useState(false);
  const [valVisible, setValVisible]   = useState(false);
  const [hitlVisible, setHitlVisible] = useState(false);
  const [durVisible, setDurVisible]   = useState(false);

  // HITL interactive demo state in Section 4
  const [hitlAction, setHitlAction] = useState<'pending' | 'approved' | 'corrected' | 'rejected'>('pending');

  const outerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // ── Reduced motion listener ─────────────────────────────────────────────────
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(q.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    q.addEventListener('change', handler);
    return () => q.removeEventListener('change', handler);
  }, []);

  // ── Scene detection on scroll ───────────────────────────────────────────────
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const onScroll = () => {
      const vpHalf = el.clientHeight / 2;
      let closestIdx = 0;
      let minDistance = Infinity;

      sectionRefs.current.forEach((sec, idx) => {
        if (!sec) return;
        const rect = sec.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(center - vpHalf);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });
      setActiveIdx(closestIdx);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // ── IntersectionObserver for staggered reveals ─────────────────────────────
  useEffect(() => {
    const options = { threshold: 0.45 };

    const observeSection = (
      index: number,
      onEnter: () => void,
      onLeave?: () => void
    ) => {
      const el = sectionRefs.current[index];
      if (!el) return null;
      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          onEnter();
        } else if (onLeave) {
          onLeave();
        }
      }, options);
      io.observe(el);
      return io;
    };

    const observers = [
      observeSection(1, () => setDualVisible(true), () => setDualVisible(false)),
      observeSection(2, () => setValVisible(true),  () => setValVisible(false)),
      observeSection(3, () => setHitlVisible(true), () => setHitlVisible(false)),
      observeSection(4, () => setDurVisible(true),  () => setDurVisible(false)),
    ];

    return () => observers.forEach((io) => io?.disconnect());
  }, []);

  const scrollToSection = useCallback(
    (index: number) => {
      const target = sectionRefs.current[index];
      if (!target) return;
      target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    },
    [prefersReducedMotion]
  );

  const SECTION_HEIGHT = 'h-[calc(100vh-3.5rem)]';

  return (
    <div
      ref={outerRef}
      className={`relative w-full ${SECTION_HEIGHT} overflow-y-auto selection:bg-[var(--signal,#E8B339)] selection:text-black`}
      style={{
        scrollSnapType: prefersReducedMotion ? 'none' : 'y mandatory',
        scrollBehavior: prefersReducedMotion ? 'auto' : 'smooth',
        background: '#090C12',
      }}
    >
      {/* ══════════════════════════════════════════════════════════════════════
          STICKY CANVAS BACKDROP
          (Remains pinned in place behind the scroll container)
         ══════════════════════════════════════════════════════════════════════ */}
      <div
        className={`sticky top-0 ${SECTION_HEIGHT} overflow-hidden pointer-events-none select-none`}
        aria-hidden="true"
        style={{ zIndex: 0 }}
      >
        <AuditStageCanvas
          scene={SECTIONS[activeIdx]?.sceneId ?? 'hero'}
          prefersReducedMotion={prefersReducedMotion}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SCENES CONTAINER (Negative margin matches viewport height)
         ══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          marginTop: `calc(-1 * (100vh - 3.5rem))`,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* ── SECTION 1: HERO ───────────────────────────────────────────────── */}
        <section
          id="scene-hero"
          ref={(el) => { sectionRefs.current[0] = el; }}
          className={`relative w-full ${SECTION_HEIGHT} flex flex-col items-center justify-center text-center px-6 md:px-12`}
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
            {/* Minimalist Top Index Badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-[#141822]/80 backdrop-blur-md text-xs font-mono tracking-wider text-slate-300 mb-8 shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--signal,#E8B339)] shadow-[0_0_8px_rgba(232,179,57,0.8)]" />
              <span>PS-01</span>
              <span className="text-white/20">|</span>
              <span className="text-slate-400">FINANCIAL FILING AUDITOR</span>
            </motion.div>

            {/* Main Typographic Headline */}
            <h1 className="font-display font-bold text-5xl md:text-7xl tracking-[-0.03em] text-white mb-6 leading-[1.08]">
              <span className="block text-slate-100">A financial AI that knows</span>
              <span className="block text-[var(--signal,#E8B339)] mt-1">
                when to distrust itself.
              </span>
            </h1>

            {/* Editorial Body Text */}
            <p className="font-sans text-lg md:text-xl text-slate-300/80 max-w-2xl mb-10 leading-relaxed font-normal">
              VantageAudit parses SEC 10-K filings as visual documents, corroborates dual independent extractors, enforces strict accounting theorems, and halts execution before uncertainty reaches the ledger.
            </p>

            {/* Primary Action Button (Tactile Dip & Magnetic Feel) */}
            <div className="flex flex-col items-center space-y-3">
              <MagneticButton
                maxShift={8}
                onClick={() => navigate('/mission')}
                className="px-8 py-4 rounded-xl bg-[var(--signal,#E8B339)] text-[#0E121A] font-bold text-base hover:brightness-110 active:scale-[0.98] transition-all flex items-center space-x-3 cursor-pointer shadow-[0_0_30px_rgba(232,179,57,0.35)]"
              >
                <span>Enter Mission Control</span>
                <ArrowRight className="w-5 h-5 text-[#0E121A]" />
              </MagneticButton>
              <span className="text-[11px] font-mono text-slate-500 tracking-wider">
                10-15s skippable demo intro
              </span>
            </div>

            {/* Downward Scroll Cue */}
            <div className="absolute bottom-6 flex flex-col items-center text-slate-500">
              <span className="text-[10px] font-mono tracking-widest uppercase mb-1.5 text-slate-500">
                scroll to explore
              </span>
              <div className="w-px h-6 bg-gradient-to-b from-white/30 to-transparent" />
            </div>
          </div>
        </section>

        {/* ── SECTION 2: DUAL EXTRACTION ────────────────────────────────────── */}
        <section
          id="scene-extraction"
          ref={(el) => { sectionRefs.current[1] = el; }}
          className={`relative w-full ${SECTION_HEIGHT} flex flex-col items-center justify-center px-6 md:px-12`}
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="max-w-5xl w-full mx-auto">
            {/* Editorial Section Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-4 border-b border-white/[0.08]">
              <div>
                <span className="text-[11px] font-mono tracking-widest text-[var(--signal,#E8B339)] uppercase block mb-1">
                  SEC // 02 — CONSENSUS ENGINE
                </span>
                <h2 className="font-display font-bold text-3xl md:text-5xl text-white tracking-[-0.02em]">
                  Two extractors. <span className="text-[var(--signal,#E8B339)]">One truth.</span>
                </h2>
              </div>
              <p className="text-xs md:text-sm font-sans text-slate-400 max-w-md mt-2 md:mt-0 leading-relaxed">
                Deterministic regex rules corroborate temperature-0 LLM visual parsing. If models diverge, confidence collapses to 0.40 and quarantine triggers.
              </p>
            </div>

            {/* Dual Column Architecture */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Rules Extractor Column */}
              <div className="rounded-2xl bg-[#141822]/80 border border-white/[0.08] border-t-2 border-t-sky-400/60 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.06]">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-sm text-white">Rules Engine</h3>
                      <span className="text-[10px] font-mono text-slate-400">AST & Regular Expressions</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    PASS · ZERO LATENCY
                  </span>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'Revenue (Consolidated)', val: '$391,035M', delay: 0 },
                    { label: 'Net Income', val: '$93,736M', delay: 80 },
                    { label: 'Total Assets', val: '$364,980M', delay: 160 },
                    { label: 'Total Liabilities', val: '$308,030M', delay: 240 },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        animationDelay: prefersReducedMotion || !dualVisible ? '0ms' : `${item.delay}ms`,
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border border-white/[0.04] bg-[#0E121A]/70 text-xs ${
                        dualVisible && !prefersReducedMotion ? 'animate-cell-reveal' : ''
                      }`}
                    >
                      <span className="text-slate-400 font-sans">{item.label}</span>
                      <span className="font-mono font-medium text-slate-200">{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* LLM Visual Parser Column */}
              <div className="rounded-2xl bg-[#141822]/80 border border-white/[0.08] border-t-2 border-t-emerald-400/60 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.06]">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-sm text-white">LLM Visual Parser</h3>
                      <span className="text-[10px] font-mono text-slate-400">Temp 0 · Schema Validation</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    MATCH CONFIRMED
                  </span>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'Revenue (Consolidated)', val: '$391,035M', delay: 40 },
                    { label: 'Net Income', val: '$93,736M', delay: 120 },
                    { label: 'Total Assets', val: '$364,980M', delay: 200 },
                    { label: 'Total Liabilities', val: '$308,030M', delay: 280 },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        animationDelay: prefersReducedMotion || !dualVisible ? '0ms' : `${item.delay}ms`,
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border border-white/[0.04] bg-[#0E121A]/70 text-xs ${
                        dualVisible && !prefersReducedMotion ? 'animate-cell-reveal' : ''
                      }`}
                    >
                      <span className="text-slate-400 font-sans">{item.label}</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-medium text-emerald-300">{item.val}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Consensus Synthesis Bar */}
            <div className="mt-5 p-3 rounded-xl bg-[#141822]/60 border border-white/[0.06] flex items-center justify-between text-xs font-mono">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                <span className="text-slate-300">Corroboration Score: <strong className="text-white">100% Concordance</strong></span>
              </div>
              <span className="text-[var(--signal,#E8B339)]">Tolerances ±0.0% · No Inferred Values</span>
            </div>
          </div>
        </section>

        {/* ── SECTION 3: FOUR CHECKS ────────────────────────────────────────── */}
        <section
          id="scene-validation"
          ref={(el) => { sectionRefs.current[2] = el; }}
          className={`relative w-full ${SECTION_HEIGHT} flex flex-col items-center justify-center px-6 md:px-12`}
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="max-w-5xl w-full mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-4 border-b border-white/[0.08]">
              <div>
                <span className="text-[11px] font-mono tracking-widest text-[var(--signal,#E8B339)] uppercase block mb-1">
                  SEC // 03 — MATHEMATICAL INVARIANTS
                </span>
                <h2 className="font-display font-bold text-3xl md:text-5xl text-white tracking-[-0.02em]">
                  Four checks. <span className="text-[var(--signal,#E8B339)]">Every single run.</span>
                </h2>
              </div>
              <p className="text-xs md:text-sm font-sans text-slate-400 max-w-md mt-2 md:mt-0 leading-relaxed">
                Accounting theorems must balance algebraically. A single penny discrepancy invalidates automated approval.
              </p>
            </div>

            {/* 4 Invariant Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                {
                  code: 'INV-01',
                  title: 'Accounting Equation',
                  formula: 'Assets = Liabilities + Equity (±0.5%)',
                  desc: 'Enforces the foundational identity across balance sheet lines before ledger write-back.',
                  icon: Scale,
                  delay: 0,
                },
                {
                  code: 'INV-02',
                  title: 'Segment Synthesis',
                  formula: 'Σ(Segments) == Consolidated Revenue',
                  desc: 'Disaggregates operating geographic & product segments to ensure internal consistency.',
                  icon: Layers,
                  delay: 90,
                },
                {
                  code: 'INV-03',
                  title: 'Year-on-Year Continuity',
                  formula: 'Prior_Year(Reported) == Historical(Current)',
                  desc: 'Audits restatements and variance anomalies exceeding 50% year-over-year bounds.',
                  icon: TrendingUp,
                  delay: 180,
                },
                {
                  code: 'INV-04',
                  title: 'Cross-Statement Reconciliation',
                  formula: 'Net Income -> Operating Cash Flow Base',
                  desc: 'Reconciles Income Statement net earnings against cash flow operating starting balances.',
                  icon: FileSpreadsheet,
                  delay: 270,
                },
              ].map((inv) => {
                const Icon = inv.icon;
                return (
                  <div
                    key={inv.code}
                    style={{
                      opacity: valVisible || prefersReducedMotion ? 1 : 0,
                      transform: valVisible || prefersReducedMotion ? 'translateY(0)' : 'translateY(16px)',
                      transition: `opacity 0.4s ease ${inv.delay}ms, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${inv.delay}ms`,
                    }}
                    className="p-6 rounded-2xl bg-[#141822]/80 border border-white/[0.08] hover:border-white/[0.16] transition-all backdrop-blur-xl group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 rounded-lg bg-[rgba(232,179,57,0.1)] text-[var(--signal,#E8B339)]">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-mono text-xs text-slate-400">{inv.code}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                        VERIFIED IDENTITIES
                      </span>
                    </div>

                    <h3 className="font-display font-bold text-lg text-white mb-1.5 group-hover:text-[var(--signal,#E8B339)] transition-colors">
                      {inv.title}
                    </h3>
                    <div className="text-[11px] font-mono text-[var(--signal,#E8B339)] bg-[#0E121A] px-2.5 py-1 rounded-md mb-2.5 inline-block border border-white/[0.04]">
                      {inv.formula}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">
                      {inv.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── SECTION 4: HUMAN-IN-THE-LOOP ──────────────────────────────────── */}
        <section
          id="scene-hitl"
          ref={(el) => { sectionRefs.current[3] = el; }}
          className={`relative w-full ${SECTION_HEIGHT} flex flex-col items-center justify-center px-6 md:px-12`}
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="max-w-5xl w-full mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-4 border-b border-white/[0.08]">
              <div>
                <span className="text-[11px] font-mono tracking-widest text-[var(--signal,#E8B339)] uppercase block mb-1">
                  SEC // 04 — DURABLE TRIAGE
                </span>
                <h2 className="font-display font-bold text-3xl md:text-5xl text-white tracking-[-0.02em]">
                  It pauses. <span className="text-[var(--signal,#E8B339)]">You decide.</span>
                </h2>
              </div>
              <p className="text-xs md:text-sm font-sans text-slate-400 max-w-md mt-2 md:mt-0 leading-relaxed">
                When confidence dips below threshold, LangGraph issues a native durable interrupt. The pipeline suspends in SQLite until human review.
              </p>
            </div>

            {/* Split Screen: Autonomous Stream vs Interactive Human Review HUD */}
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
              style={{
                opacity: hitlVisible || prefersReducedMotion ? 1 : 0,
                transform: hitlVisible || prefersReducedMotion ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Left: Execution Stream Suspended */}
              <div className="rounded-2xl bg-[#141822]/80 border border-white/[0.08] p-6 backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06]">
                    <div className="flex items-center space-x-2">
                      <Terminal className="w-4 h-4 text-slate-400" />
                      <span className="font-mono text-xs text-slate-300">PIPELINE EXECUTION TRACE</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-mono flex items-center space-x-1.5">
                      <Pause className="w-2.5 h-2.5 fill-current" />
                      <span>HALTED AT INTERRUPT</span>
                    </span>
                  </div>

                  <div className="space-y-2.5 font-mono text-xs">
                    <div className="p-2.5 rounded-lg bg-[#0E121A] border border-white/[0.04] text-slate-400">
                      <div className="text-[10px] text-slate-500">NODE 01: INGESTION</div>
                      <div className="text-emerald-400">✓ SEC 10-K HTML located (Apple Inc. FY2024)</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#0E121A] border border-white/[0.04] text-slate-400">
                      <div className="text-[10px] text-slate-500">NODE 02: DUAL EXTRACTION</div>
                      <div className="text-emerald-400">✓ 4/4 Core statements verified</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200">
                      <div className="text-[10px] text-amber-400 font-bold">NODE 03: TRIAGE ESCALATION</div>
                      <div>⚠ Non-controlling equity split confidence 0.65 &lt; 0.75</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center text-[11px] font-mono text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse mr-2" />
                  Awaiting resume via Command(resume=decision)
                </div>
              </div>

              {/* Right: Interactive Review HUD */}
              <div className="rounded-2xl bg-[#141822]/80 border border-white/[0.08] border-t-2 border-t-[var(--signal,#E8B339)] p-6 backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06]">
                    <span className="font-mono text-xs text-[var(--signal,#E8B339)] font-bold">
                      HUMAN REVIEW WORKBENCH
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">ID: REV-8402</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#0E121A] border border-amber-500/20 mb-4">
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="text-white font-bold">Total Stockholders&apos; Equity</span>
                      <span className="text-amber-400 font-bold">FLAGGED: LOW_CONF</span>
                    </div>
                    <p className="text-xs text-slate-400 font-sans leading-relaxed">
                      Footnote 14 mentions subsidiary restructuring not reflected in consolidated totals. Reviewer confirmation required.
                    </p>
                  </div>

                  {/* Interactive Buttons — "Taps should answer back" */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono text-slate-500 block uppercase">
                      Select reviewer action to simulate resume:
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setHitlAction('approved')}
                        className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all active:scale-[0.97] cursor-pointer ${
                          hitlAction === 'approved'
                            ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                        }`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setHitlAction('corrected')}
                        className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all active:scale-[0.97] cursor-pointer ${
                          hitlAction === 'corrected'
                            ? 'bg-[var(--signal,#E8B339)] text-black shadow-[0_0_15px_rgba(232,179,57,0.5)]'
                            : 'bg-[var(--signal,#E8B339)]/15 text-amber-300 border border-amber-500/30 hover:bg-[var(--signal,#E8B339)]/25'
                        }`}
                      >
                        Correct
                      </button>
                      <button
                        onClick={() => setHitlAction('rejected')}
                        className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all active:scale-[0.97] cursor-pointer ${
                          hitlAction === 'rejected'
                            ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)]'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                        }`}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>

                {/* Feedback note responding to tap */}
                <div className="mt-4 pt-3 border-t border-white/[0.06] text-xs font-mono flex items-center justify-between">
                  <span className="text-slate-400">Audit Status:</span>
                  <span className="text-white font-bold">
                    {hitlAction === 'pending' && 'WAITING ON HUMAN DECISION'}
                    {hitlAction === 'approved' && 'COMMITTED → PIPELINE ADVANCED'}
                    {hitlAction === 'corrected' && 'VALUE RE-ENTERED → REVALIDATING'}
                    {hitlAction === 'rejected' && 'RECORD QUARANTINED FROM LEDGER'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 5: DURABILITY ─────────────────────────────────────────── */}
        <section
          id="scene-durability"
          ref={(el) => { sectionRefs.current[4] = el; }}
          className={`relative w-full ${SECTION_HEIGHT} flex flex-col items-center justify-center px-6 md:px-12`}
          style={{ scrollSnapAlign: 'start' }}
        >
          <div
            className="max-w-4xl w-full mx-auto flex flex-col items-center text-center"
            style={{
              opacity: durVisible || prefersReducedMotion ? 1 : 0,
              transform: durVisible || prefersReducedMotion ? 'translateY(0)' : 'translateY(24px)',
              transition: 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Top Indicator Badge */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-[#141822]/80 backdrop-blur-md text-xs font-mono text-slate-300 mb-6">
              <RefreshCw className="w-3.5 h-3.5 text-[var(--signal,#E8B339)] animate-spin" style={{ animationDuration: '6s' }} />
              <span>PERSISTENCE GUARANTEE</span>
            </div>

            {/* Giant Bold Headline */}
            <h2 className="font-display font-bold text-5xl md:text-7xl text-white tracking-[-0.03em] mb-6 leading-[1.08]">
              Killed mid-run. <br />
              <span className="text-[var(--signal,#E8B339)]">Nothing lost.</span>
            </h2>

            {/* Architectural Telemetry Box */}
            <div className="rounded-2xl bg-[#141822]/80 border border-white/[0.08] border-t-2 border-t-[var(--signal,#E8B339)] p-8 max-w-3xl text-left backdrop-blur-xl mb-6 shadow-2xl w-full">
              <p className="text-base md:text-lg text-slate-300 font-sans leading-relaxed mb-6">
                Every node transition is atomically committed using <code className="px-1.5 py-0.5 rounded bg-[#0E121A] text-[var(--signal,#E8B339)] font-mono text-sm border border-white/[0.06]">AsyncSqliteSaver</code>. When a process suffers a sudden <code className="px-1.5 py-0.5 rounded bg-[#0E121A] text-rose-400 font-mono text-sm border border-white/[0.06]">SIGKILL / kill -9</code>, state rehydrates instantly without re-issuing a single duplicate LLM call.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-white/[0.06] font-mono text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] mb-1">REHYDRATION</span>
                  <span className="text-white font-bold">ainvoke(None, config)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] mb-1">CACHE VERIFICATION</span>
                  <span className="text-white font-bold">sha256(model + prompt)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] mb-1">RESUMPTION FLAG</span>
                  <span className="text-emerald-400 font-bold">system_recovered ✓</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 6: FINAL CTA ──────────────────────────────────────────── */}
        <section
          id="scene-cta"
          ref={(el) => { sectionRefs.current[5] = el; }}
          className={`relative w-full ${SECTION_HEIGHT} flex flex-col items-center justify-center text-center px-6 md:px-12`}
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="max-w-3xl mx-auto flex flex-col items-center relative z-10">
            {/* Deployment Badge */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-[#141822]/80 backdrop-blur-md text-slate-300 text-xs font-mono tracking-wider mb-6">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--signal,#E8B339)]" />
              <span>PIPELINE VERIFIED · 8 PINNED FILINGS</span>
            </div>

            {/* Headline */}
            <h2 className="font-display font-bold text-4xl md:text-6xl text-white tracking-[-0.03em] mb-6 leading-tight">
              Ready to explore the financial audit ledger?
            </h2>

            <p className="font-sans text-base md:text-lg text-slate-400 max-w-xl mb-10 leading-relaxed">
              Launch autonomous runs across pinned SEC filings, inject intentional anomalies, and witness durable audit consensus in action.
            </p>

            {/* Primary Magnetic CTA */}
            <MagneticButton
              maxShift={10}
              onClick={() => navigate('/mission')}
              className="px-10 py-5 rounded-2xl bg-[var(--signal,#E8B339)] text-[#0E121A] font-bold text-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center space-x-3 cursor-pointer shadow-[0_0_35px_rgba(232,179,57,0.45)] font-sans"
            >
              <span>Enter Mission Control</span>
              <ArrowRight className="w-6 h-6 text-[#0E121A]" />
            </MagneticButton>

            <span className="text-xs font-mono text-slate-500 mt-4 tracking-wider">
              10-15s skippable demo intro
            </span>
          </div>
        </section>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          FIXED HUD NAVIGATION & TELEMETRY
         ══════════════════════════════════════════════════════════════════════ */}

      {/* Skip Button (Top Right) */}
      <div className="fixed top-18 right-8 z-50 pointer-events-auto">
        <button
          onClick={() => navigate('/mission')}
          className="group px-3.5 py-1.5 rounded-xl border border-white/[0.08] bg-[#141822]/80 hover:bg-[#1C2230] text-xs font-mono text-slate-400 hover:text-white flex items-center space-x-2 transition-all shadow-lg backdrop-blur-md cursor-pointer active:scale-[0.98]"
        >
          <span>Skip Demo Intro</span>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--signal,#E8B339)] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Scene Telemetry Indicator (Bottom Left) */}
      <div className="fixed bottom-8 left-8 z-50 flex items-center space-x-3 pointer-events-none select-none">
        <div className="relative w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-[var(--signal,#E8B339)] opacity-60 animate-ping" />
          <span className="relative w-2 h-2 rounded-full bg-[var(--signal,#E8B339)] block" />
        </div>
        <div className="font-mono text-xs text-slate-500 tracking-wider flex items-center space-x-2">
          <span className="text-[var(--signal,#E8B339)] font-bold">
            0{activeIdx + 1}
          </span>
          <span className="opacity-40">/</span>
          <span>06</span>
          <span className="opacity-30">·</span>
          <span className="text-slate-300 font-medium">
            {SECTIONS[activeIdx]?.tag}
          </span>
        </div>
      </div>

      {/* Vertical Rail Dot Navigation (Right Edge) */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center space-y-3">
        {SECTIONS.map((sec, idx) => {
          const isActive = activeIdx === idx;
          return (
            <button
              key={sec.id}
              onClick={() => scrollToSection(idx)}
              className="group relative flex items-center justify-end p-1.5 cursor-pointer focus:outline-none"
              title={sec.label}
            >
              {/* Tooltip Label */}
              <span className="absolute right-7 px-2.5 py-1 rounded-md bg-[#141822]/90 border border-white/[0.08] text-[10px] font-mono text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap backdrop-blur-md shadow-lg">
                {sec.label}
              </span>
              <span
                className={`rounded-full transition-all duration-300 ${
                  isActive
                    ? 'w-2.5 h-2.5 bg-[var(--signal,#E8B339)] scale-125 shadow-[0_0_12px_rgba(232,179,57,0.7)]'
                    : 'w-1.5 h-1.5 bg-slate-700 hover:bg-slate-400'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
