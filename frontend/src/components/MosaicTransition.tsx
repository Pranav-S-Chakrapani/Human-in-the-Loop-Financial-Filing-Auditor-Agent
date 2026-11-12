/**
 * MosaicTransition — High-Precision Cybernetic Shutter Grid Transition.
 *
 * Provides a tactile sci-fi mosaic shutter across route transitions:
 * an 8x5 matrix of obsidian tiles with amber hairline borders and coordinate stamps
 * sweep in a diagonal wave, seamlessly switching views before parting to reveal
 * the new console.
 *
 * Respects prefers-reduced-motion with an instant subtle opacity fade.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const ROWS = 5;
const COLS = 8;
const TOTAL_TILES = ROWS * COLS;

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

      // Trigger Mosaic Sweep
      setIsTransitioning(true);

      // Switch children right as shutter reaches maximum opacity (220ms)
      const switchTimer = setTimeout(() => {
        setDisplayedChildren(children);
      }, 220);

      // Dismiss shutter after wave sweeps out (520ms)
      const endTimer = setTimeout(() => {
        setIsTransitioning(false);
      }, 520);

      return () => {
        clearTimeout(switchTimer);
        clearTimeout(endTimer);
      };
    } else {
      setDisplayedChildren(children);
    }
  }, [location.pathname, children, prefersReducedMotion]);

  // Precompute grid tiles with diagonal wavefront delay
  const tiles = Array.from({ length: TOTAL_TILES }, (_, index) => {
    const row = Math.floor(index / COLS);
    const col = index % COLS;
    // Diagonal wavefront from top-left to bottom-right
    const waveDelay = (row * 0.45 + col * 0.55) * 0.022;
    return {
      id: index,
      row,
      col,
      delay: waveDelay,
      coord: `${String(row).padStart(2, '0')}:${String(col).padStart(2, '0')}`
    };
  });

  return (
    <div className="relative w-full min-h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Mosaic Shutter Matrix Overlay */}
      <AnimatePresence>
        {isTransitioning && !prefersReducedMotion && (
          <div
            className="fixed inset-0 top-14 z-50 pointer-events-none grid grid-cols-8 grid-rows-5 overflow-hidden"
            aria-hidden="true"
          >
            {tiles.map((tile) => (
              <motion.div
                key={tile.id}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{
                  scaleY: [0, 1.02, 1, 0],
                  opacity: [0, 0.98, 0.98, 0],
                }}
                transition={{
                  duration: 0.48,
                  delay: tile.delay,
                  times: [0, 0.35, 0.65, 1],
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative w-full h-full bg-[#080B11] border border-white/[0.05] shadow-[inset_0_0_15px_rgba(0,0,0,0.9)] flex items-center justify-center origin-top overflow-hidden"
              >
                {/* Micro Amber Hairline Accents */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--signal,#E8B339)]/35 to-transparent" />
                <div className="absolute bottom-1 right-1.5 font-mono text-[7px] text-[var(--signal,#E8B339)]/25 select-none tracking-tighter">
                  {tile.coord}
                </div>
              </motion.div>
            ))}

            {/* Central routing HUD pill during transition */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.95, 1, 1, 0.95] }}
              transition={{ duration: 0.42, times: [0, 0.25, 0.75, 1] }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="px-5 py-2 rounded-xl bg-[#121620]/95 border border-[var(--signal,#E8B339)]/40 shadow-[0_0_30px_rgba(232,179,57,0.2)] flex items-center space-x-2.5 font-mono text-xs text-white backdrop-blur-xl">
                <span className="w-2 h-2 rounded-full bg-[var(--signal,#E8B339)] animate-ping" />
                <span className="text-slate-400">ROUTING:</span>
                <span className="font-bold text-[var(--signal,#E8B339)] uppercase tracking-wider">{targetPath === '/' ? 'OVERVIEW' : targetPath.replace('/', '')}</span>
                <span className="text-slate-500 text-[10px]">· CONSENSUS READY</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Page Content with Smooth Kinetic Elevation */}
      <motion.div
        key={location.pathname}
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        className="w-full flex-1 flex flex-col"
      >
        {displayedChildren}
      </motion.div>
    </div>
  );
};
