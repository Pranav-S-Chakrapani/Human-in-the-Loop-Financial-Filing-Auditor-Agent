/**
 * AuditStageCanvas — High-elegance ambient canvas backdrop for VantageAudit.
 *
 * Visual architecture:
 * - Obsidian deep-space base (#090C12 -> #10141F)
 * - Delicate mathematical grid with hairline crosshairs (+)
 * - Dynamic luminous bezier filaments (representing cryptographic/audit streams)
 * - Harmonic particle flows that adapt to active scene dynamics:
 *     * hero: expansive golden ambient field + central focal resonance
 *     * extraction: dual symmetric streams converging towards consensus
 *     * validation: quad geometric validation lattices with harmonic pulse
 *     * hitl: suspended temporal freeze (slow amber drift) + horizon pulse
 *     * durability: resilience shockwave + state restoration burst
 *     * cta: high-coherence luminous amber field
 */

import React, { useEffect, useRef, useCallback } from 'react';

export type SceneId =
  | 'hero'
  | 'extraction'
  | 'validation'
  | 'hitl'
  | 'durability'
  | 'cta';

interface Props {
  scene: SceneId;
  prefersReducedMotion: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  baseAlpha: number;
  pulsePhase: number;
  streamIndex: number;
}

interface Stream {
  x1: number;
  x2: number;
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  phase: number;
  speed: number;
  alpha: number;
}

export const AuditStageCanvas: React.FC<Props> = ({ scene, prefersReducedMotion }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const frameRef = useRef<number>(0);
  const sceneRef = useRef<SceneId>(scene);
  const particlesRef = useRef<Particle[]>([]);
  const streamsRef = useRef<Stream[]>([]);
  const transitionRef = useRef({ currentSpeed: 1, targetSpeed: 1 });

  useEffect(() => {
    sceneRef.current = scene;
    switch (scene) {
      case 'hitl':
        transitionRef.current.targetSpeed = 0.2;
        break;
      case 'durability':
        transitionRef.current.targetSpeed = 2.4;
        break;
      case 'extraction':
        transitionRef.current.targetSpeed = 1.3;
        break;
      default:
        transitionRef.current.targetSpeed = 0.8;
    }
  }, [scene]);

  const initScene = useCallback((width: number, height: number) => {
    // Generate organic flow streams
    const streamCount = 9;
    const streams: Stream[] = [];
    const step = width / (streamCount + 1);

    for (let i = 0; i < streamCount; i++) {
      const baseX = step * (i + 1);
      streams.push({
        x1: baseX,
        x2: baseX + (Math.random() - 0.5) * 80,
        cx1: baseX + (Math.random() - 0.5) * 160,
        cy1: height * 0.35,
        cx2: baseX + (Math.random() - 0.5) * 160,
        cy2: height * 0.7,
        phase: Math.random() * Math.PI * 2,
        speed: 0.004 + Math.random() * 0.004,
        alpha: 0.06 + Math.random() * 0.08,
      });
    }
    streamsRef.current = streams;

    // Generate telemetry particles
    const pCount = 38;
    const particles: Particle[] = [];
    for (let i = 0; i < pCount; i++) {
      const sIdx = i % streamCount;
      const st = streams[sIdx];
      particles.push({
        x: st.x1 + (Math.random() - 0.5) * 60,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -0.4 - Math.random() * 0.6,
        size: 1.2 + Math.random() * 1.8,
        alpha: 0.15 + Math.random() * 0.35,
        baseAlpha: 0.15 + Math.random() * 0.35,
        pulsePhase: Math.random() * Math.PI * 2,
        streamIndex: sIdx,
      });
    }
    particlesRef.current = particles;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    frameRef.current++;
    const frame = frameRef.current;

    // Smooth speed interpolation
    const t = transitionRef.current;
    t.currentSpeed += (t.targetSpeed - t.currentSpeed) * 0.05;
    const speed = t.currentSpeed;
    const currentScene = sceneRef.current;

    // 1. Deep Obsidian Gradient Base
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#090C12');
    bgGrad.addColorStop(0.5, '#0E121A');
    bgGrad.addColorStop(1, '#080B10');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Scene-specific Ambient Light Blooms
    const cx = w / 2;
    const cy = h * 0.45;

    let glowIntensity = 0.06;
    let glowRadius = Math.min(w, h) * 0.65;
    let glowColor = '232, 179, 57'; // Amber #E8B339

    if (currentScene === 'validation') {
      glowColor = '63, 143, 122'; // Emerald / Teal
      glowIntensity = 0.05;
    } else if (currentScene === 'hitl') {
      glowIntensity = 0.08 + Math.sin(frame * 0.03) * 0.02; // Pulse
    } else if (currentScene === 'durability') {
      glowIntensity = 0.07;
    }

    const ambientGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    ambientGlow.addColorStop(0, `rgba(${glowColor}, ${glowIntensity})`);
    ambientGlow.addColorStop(0.5, `rgba(${glowColor}, ${glowIntensity * 0.35})`);
    ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = ambientGlow;
    ctx.fillRect(0, 0, w, h);

    // 3. Subtle Engineering Grid Crosshairs (+)
    const gridSize = 72;
    const crossSize = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;

    for (let gx = gridSize / 2; gx < w; gx += gridSize) {
      for (let gy = gridSize / 2; gy < h; gy += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx - crossSize, gy);
        ctx.lineTo(gx + crossSize, gy);
        ctx.moveTo(gx, gy - crossSize);
        ctx.lineTo(gx, gy + crossSize);
        ctx.stroke();
      }
    }

    // 4. Luminous Audit Filaments (Curved Bezier Paths)
    streamsRef.current.forEach((st, idx) => {
      st.phase += st.speed * speed;
      const sway1 = Math.sin(st.phase) * 35;
      const sway2 = Math.cos(st.phase * 0.8) * 30;

      ctx.beginPath();
      ctx.moveTo(st.x1, h);
      ctx.bezierCurveTo(
        st.cx1 + sway1,
        st.cy1,
        st.cx2 + sway2,
        st.cy2,
        st.x2,
        0
      );

      let strokeColor = `rgba(232, 179, 57, ${st.alpha * 0.8})`;
      if (currentScene === 'validation' && idx % 2 === 0) {
        strokeColor = `rgba(63, 143, 122, ${st.alpha * 0.9})`;
      } else if (currentScene === 'hitl') {
        strokeColor = `rgba(232, 179, 57, ${st.alpha * 0.45})`;
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = idx % 3 === 0 ? 1.5 : 0.8;
      ctx.stroke();
    });

    // 5. Telemetry Flow Particles
    particlesRef.current.forEach((p) => {
      if (!prefersReducedMotion) {
        p.y += p.vy * speed;
        p.pulsePhase += 0.03;

        // Wrap around gracefully
        if (p.y < -20) {
          p.y = h + 20;
          p.x = (streamsRef.current[p.streamIndex]?.x1 || w / 2) + (Math.random() - 0.5) * 80;
        }
      }

      const pulse = Math.sin(p.pulsePhase) * 0.3 + 0.7;
      const alpha = p.baseAlpha * pulse;

      // Draw particle halo
      const pGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.5);
      pGrad.addColorStop(0, `rgba(232, 179, 57, ${alpha * 0.9})`);
      pGrad.addColorStop(1, 'rgba(232, 179, 57, 0)');

      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Sharp core
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6. Section Specific Foreground Geometry
    if (currentScene === 'hero' || currentScene === 'cta') {
      // Elegant minimal focal rings around center
      const rot = frame * 0.003;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);

      ctx.strokeStyle = 'rgba(232, 179, 57, 0.06)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 16]);
      ctx.beginPath();
      ctx.arc(0, 0, 180, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([4, 24]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.arc(0, 0, 260, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    } else if (currentScene === 'hitl') {
      // Elegant horizon pulse line for paused state
      const pulseA = Math.sin(frame * 0.04) * 0.5 + 0.5;
      const lineY = h * 0.5;

      const horizonGrad = ctx.createLinearGradient(0, 0, w, 0);
      horizonGrad.addColorStop(0, 'rgba(232, 179, 57, 0)');
      horizonGrad.addColorStop(0.5, `rgba(232, 179, 57, ${0.12 + pulseA * 0.12})`);
      horizonGrad.addColorStop(1, 'rgba(232, 179, 57, 0)');

      ctx.strokeStyle = horizonGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(w, lineY);
      ctx.stroke();
    }

    if (!prefersReducedMotion) {
      rafRef.current = requestAnimationFrame(draw);
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initScene(canvas.width, canvas.height);
      if (prefersReducedMotion) draw();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (!prefersReducedMotion) {
      rafRef.current = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [initScene, draw, prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ display: 'block' }}
      aria-hidden="true"
    />
  );
};
