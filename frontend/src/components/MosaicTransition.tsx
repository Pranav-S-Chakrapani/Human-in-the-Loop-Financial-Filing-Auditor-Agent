/**
 * TransitionContainer — Ultra-Smooth Fluid Cinematic Page Transition.
 *
 * Delivers an instant, buttery-smooth route transition without jarring mosaic shutters:
 * - A high-precision laser progress streak animates along the top edge of the viewport.
 * - The incoming page glides in with a gentle optical lift and silky fade-in.
 * - Completely frictionless, instantaneous, and responsive.
 * - Respects prefers-reduced-motion.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export const MosaicTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  const prevPathRef = useRef(location.pathname);
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

      if (!prefersReducedMotion) {
        setIsNavigating(true);
        const timer = setTimeout(() => {
          setIsNavigating(false);
        }, 380);
        return () => clearTimeout(timer);
      }
    }
  }, [location.pathname, prefersReducedMotion]);

  return (
    <div className="relative w-full min-h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Top Laser Progress Line */}
      <AnimatePresence>
        {isNavigating && !prefersReducedMotion && (
          <motion.div
            initial={{ scaleX: 0, opacity: 0.9 }}
            animate={{ scaleX: 1, opacity: [0.9, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-14 left-0 right-0 h-[2px] bg-gradient-to-r from-[var(--signal,#E8B339)] via-sky-400 to-emerald-400 shadow-[0_0_12px_rgba(232,179,57,0.7)] origin-left z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Silky Page Entry Motion */}
      <motion.div
        key={location.pathname}
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="w-full flex-1 flex flex-col"
      >
        {children}
      </motion.div>
    </div>
  );
};
