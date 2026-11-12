import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ShieldCheck, Cpu, ArrowRight, RefreshCw, Database } from 'lucide-react';
import { MagneticButton } from '../components/MagneticButton';

export const IntroScreen: React.FC = () => {
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(q.matches);
  }, []);

  // Parallax transform strictly on background layers (RULES §G, #30)
  const bgLayer1Y = useTransform(scrollY, [0, 800], [0, prefersReducedMotion ? 0 : -140]);
  const bgLayer2Y = useTransform(scrollY, [0, 800], [0, prefersReducedMotion ? 0 : 90]);

  return (
    <div className="relative min-h-[140vh] overflow-hidden bg-[#070b12] text-slate-100 flex flex-col items-center">
      {/* Background Parallax Layers */}
      <motion.div
        style={{ y: bgLayer1Y }}
        className="pointer-events-none absolute inset-0 z-0 opacity-25"
      >
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-sky-600/30 blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-[500px] h-[500px] rounded-full bg-emerald-600/20 blur-3xl" />
        <div className="absolute top-2/3 left-1/4 w-80 h-80 rounded-full bg-indigo-600/20 blur-3xl" />
        {/* Visual grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </motion.div>

      <motion.div
        style={{ y: bgLayer2Y }}
        className="pointer-events-none absolute inset-0 z-0 opacity-15"
      >
        <div className="absolute top-1/2 left-10 w-72 h-72 rounded-full bg-amber-500/10 blur-2xl" />
      </motion.div>

      {/* Main Content with Staggered Reveals */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-32 flex flex-col items-center text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400 text-xs font-semibold uppercase tracking-widest mb-6"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>PS-01 · Human-in-the-Loop Financial Filing Auditor</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.16 }}
          className="text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight max-w-4xl"
        >
          A financial AI that knows <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400">
            when to distrust itself
          </span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.26 }}
          className="text-lg md:text-xl text-slate-400 max-w-3xl mb-10 leading-relaxed font-normal"
        >
          VantageAudit parses SEC 10-K HTML visually, corroborates dual independent extractors, validates accounting
          identities, pauses durably for human review, and mathematically proves survival through unexpected mid-run kills.
        </motion.p>

        {/* CTA Button with Magnetic Follow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.36 }}
          className="mb-20"
        >
          <MagneticButton
            radius={40}
            onClick={() => navigate('/mission')}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-slate-950 font-bold text-base shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40 hover:brightness-110 flex items-center space-x-3 transition-all cursor-pointer"
          >
            <span>Enter Mission Control</span>
            <ArrowRight className="w-5 h-5" />
          </MagneticButton>
          <div className="text-xs text-slate-500 mt-2 font-mono">10-15s skippable demo intro</div>
        </motion.div>

        {/* Feature Cards Grid (Staggered) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.44 }}
            className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur"
          >
            <div className="p-2.5 w-fit rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">Dual Consensus Extraction</h3>
            <p className="text-sm text-slate-400 leading-normal">
              Regex rule matching runs parallel to temperature-0 LLM visual parsing on plain located tables. Extractor disagreement caps confidence at 0.40.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.52 }}
            className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur"
          >
            <div className="p-2.5 w-fit rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">Durable Checkpointing</h3>
            <p className="text-sm text-slate-400 leading-normal">
              AsyncSqliteSaver persists state at every node. Human review interrupts pause execution, surviving hard `kill -9` restarts with zero duplicate LLM calls.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.60 }}
            className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur"
          >
            <div className="p-2.5 w-fit rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-4">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">Isolated SEC Ground Truth</h3>
            <p className="text-sm text-slate-400 leading-normal">
              SEC XBRL Company Facts is quarantined to verifier nodes only. Final metrics are graded with automated confusion matrices and precision metrics.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
