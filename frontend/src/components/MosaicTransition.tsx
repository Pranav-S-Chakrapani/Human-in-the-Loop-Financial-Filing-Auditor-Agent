/**
 * MosaicTransition — Silky-Smooth Cinematic Geometric Veil.
 *
 * Provides a fluid, luxurious page transition:
 * A matrix of frosted obsidian glass panels with warm ambient gold refractions
 * glides smoothly across the viewport, giving a deliberate, high-end feel (~750ms)
 * before softly parting to reveal the newly mounted screen with gentle elevation.
 *
 * Respects prefers-reduced-motion with a clean instant crossfade.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const COLS = 6;
const ROWS = 4;
const TOTAL_TILES = COLS * ROWS;

export const MosaicTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const prevPathRef = useRef(location.pathname);
  const [targetPath, setTargetPath] = useState(location.pathname);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(q.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    q.addEventListener('change', handler);
    return () => q.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      prevPathRef.current = location.pathname;
      setTargetPath(location.pathname);

      if (prefersReducedMotion) {
        setDisplayedChildren(children);
        return;
      }

      // Start smooth, cinematic veil
      setIsTransitioning(true);

      // Swap page content smoothly at the apex of the veil (360ms)
      const switchTimer = setTimeout(() => {
        setDisplayedChildren(children);
      }, 360);

      // Complete the veil reveal gracefully (780ms)
      const endTimer = setTimeout(() => {
        setIsTransitioning(false);
      }, 780);

      return () => {
        clearTimeout(switchTimer);
        clearTimeout(endTimer);
      };
    } else {
      setDisplayedChildren(children);
    }
  }, [location.pathname, children, prefersReducedMotion]);

  // Compute smooth wave delays with organic curved falloff
  const tiles = Array.from({ length: TOTAL_TILES }, (_, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    // Smooth diagonal wave with quadratic easing
    const dist = (col * 0.55 + row * 0.45) / (COLS * 0.55 + ROWS * 0.45);
    const delay = Math.pow(dist, 1.2) * 0.18; // smooth 0 to 180ms delay
    return {
      id: index,
      col,
      row,
      delay,
      coord: `${col + 1}.${row + 1}`
    };
  });

  return (
    <div className="relative w-full min-h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Silky Cinematic Shutter Grid */}
      <AnimatePresence>
        {isTransitioning && !prefersReducedMotion && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            className="fixed inset-0 top-14 z-50 pointer-events-none grid grid-cols-6 grid-rows-4 overflow-hidden backdrop-blur-md"
            aria-hidden="true"
          >
            {tiles.map((tile) => (
              <motion.div
                key={tile.id}
                initial={{ opacity: 0, scale: 0.94, y: 15 }}
                animate={{
                  opacity: [0, 0.96, 0.96, 0],
                  scale: [0.94, 1, 1, 0.97],
                  y: [15, 0, 0, -10],
                }}
                transition={{
                  duration: 0.72,
                  delay: tile.delay,
                  times: [0, 0.42, 0.65, 1],
                  ease: [0.32, 0.72, 0, 1], // Smooth luxury cubic bezier
                }}
                className="relative w-full h-full bg-[#080B11]/95 border border-white/[0.04] shadow-[inset_0_0_25px_rgba(0,0,0,0.85)] flex items-center justify-center overflow-hidden"
              >
                {/* Subtle Amber Glow Filament */}
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--signal,#E8B339)]/40 to-transparent" />
                <div className="absolute bottom-2 right-2.5 font-mono text-[8px] text-[var(--signal,#E8B339)]/20 select-none tracking-widest">
                  {tile.coord}
                </div>
              </motion.div>
            ))}

            {/* Central Elegant Monogram & Route Pill */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.92, 1, 1, 0.96],
              }}
              transition={{
                duration: 0.68,
                times: [0, 0.35, 0.72, 1],
                ease: [0.25, 1, 0.5, 1]
              }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="px-6 py-2.5 rounded-2xl bg-[#121622]/95 border border-[var(--signal,#E8B339)]/35 shadow-[0_0_35px_rgba(232,179,57,0.22)] flex items-center space-x-3 font-mono text-xs text-white backdrop-blur-2xl">
                <div className="w-2 h-2 rounded-full bg-[var(--signal,#E8B339)] animate-pulse shadow-[0_0_10px_#E8B339]" />
                <span className="text-slate-400 font-sans tracking-wide">VANTAGE AUDIT</span>
                <span className="text-white/20">|</span>
                <span className="font-bold text-[var(--signal,#E8B339)] uppercase tracking-wider">
                  {targetPath === '/' ? 'OVERVIEW' : targetPath.replace('/', '')}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Content with Smooth Kinetic Reveal */}
      <motion.div
        key={location.pathname}
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        className="w-full flex-1 flex flex-col"
      >
        {displayedChildren}
      </motion.div>
    </div>
  );
};
