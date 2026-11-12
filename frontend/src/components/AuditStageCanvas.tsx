/**
 * AuditStageCanvas — sticky ambient backdrop for the Intro screen scroll narrative.
 *
 * Pure Canvas 2D (no Three.js / WebGL). Renders a dark ink background with
 * animated amber pipeline lanes that shift their visual state to match the
 * active scene.  Respects prefers-reduced-motion by rendering a static frame.
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

// ─── Design tokens (must stay in sync with tokens.css) ──────────────────────
const INK        = '#12151C';
const SIGNAL_RGB = { r: 232, g: 179, b: 57 };

function rgba(r: number, g: number, b: number, a: number) {
  return `rgba(${r},${g},${b},${a})`;
}

// ─── Lane / block data ───────────────────────────────────────────────────────
const LANE_COUNT = 5;
const BLOCK_HEIGHT = 18;
const BLOCK_GAP    = 48;

interface Block {
  x: number;
  y: number;
  w: number;
  speed: number;
  opacity: number;
  flash: number; // 0-1, decays over time
}

interface Lane {
  x: number;
  blocks: Block[];
  paused: boolean;
}

function makeLanes(cw: number, ch: number): Lane[] {
  const laneW = cw / (LANE_COUNT + 1);
  return Array.from({ length: LANE_COUNT }, (_, i) => {
    const lx = laneW * (i + 1);
    const blocks: Block[] = Array.from({ length: 8 }, (__, j) => ({
      x: lx,
      y: ch - j * (BLOCK_HEIGHT + BLOCK_GAP) - Math.random() * BLOCK_GAP,
      w: 36 + Math.random() * 20,
      speed: 0.6 + Math.random() * 0.5,
      opacity: 0.14 + Math.random() * 0.14,
      flash: 0,
    }));
    return { x: lx, blocks, paused: false };
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
export const AuditStageCanvas: React.FC<Props> = ({ scene, prefersReducedMotion }) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number>(0);
  const lanesRef    = useRef<Lane[]>([]);
  const sceneRef    = useRef<SceneId>(scene);
  const frameRef    = useRef(0);

  // keep scene ref in sync without restarting loop
  useEffect(() => { sceneRef.current = scene; }, [scene]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;
    frameRef.current++;

    const sc = sceneRef.current;
    const paused = sc === 'hitl';
    const restored = sc === 'durability';
    const heroOrCta = sc === 'hero' || sc === 'cta';

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, cw, ch);

    // ── Radial glow behind content ──────────────────────────────────────────
    const glowAlpha = heroOrCta ? 0.055 : 0.03;
    const grd = ctx.createRadialGradient(cw / 2, ch * 0.42, 0, cw / 2, ch * 0.42, cw * 0.52);
    grd.addColorStop(0, rgba(SIGNAL_RGB.r, SIGNAL_RGB.g, SIGNAL_RGB.b, glowAlpha));
    grd.addColorStop(1, rgba(SIGNAL_RGB.r, SIGNAL_RGB.g, SIGNAL_RGB.b, 0));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, cw, ch);

    // ── Dot-grid overlay ───────────────────────────────────────────────────
    const gridSize = 28;
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let gx = 0; gx < cw; gx += gridSize) {
      for (let gy = 0; gy < ch; gy += gridSize) {
        ctx.beginPath();
        ctx.arc(gx, gy, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Lane lines (vertical guide rails) ──────────────────────────────────
    lanesRef.current.forEach((lane) => {
      ctx.strokeStyle = `rgba(255,255,255,0.03)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 12]);
      ctx.beginPath();
      ctx.moveTo(lane.x, 0);
      ctx.lineTo(lane.x, ch);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // ── Move & draw blocks ──────────────────────────────────────────────────
    lanesRef.current.forEach((lane, laneIdx) => {
      // scene-based speed modulation
      let speedMul = 1;
      if (paused) speedMul = 0;
      else if (restored) speedMul = 2.2; // blocks rush after restart
      else if (sc === 'extraction') speedMul = laneIdx < 3 ? 1.4 : 0.6; // left faster
      else if (sc === 'validation') speedMul = 1.0;
      else if (heroOrCta) speedMul = 0.7;

      lane.blocks.forEach((b) => {
        if (!prefersReducedMotion && !paused) {
          b.y -= b.speed * speedMul;
          if (b.y + BLOCK_HEIGHT < 0) {
            b.y = ch + BLOCK_GAP;
            // occasionally flash on reentry
            if (sc === 'extraction' || restored) b.flash = 1;
          }
        }
        if (b.flash > 0) b.flash = Math.max(0, b.flash - 0.04);

        // determine block color
        let alpha = b.opacity;
        let fillR = 50, fillG = 60, fillB = 70; // default muted

        if (b.flash > 0) {
          // amber flash
          fillR = SIGNAL_RGB.r; fillG = SIGNAL_RGB.g; fillB = SIGNAL_RGB.b;
          alpha = b.opacity + b.flash * 0.5;
        } else if (sc === 'validation') {
          // soft teal tint
          fillR = 63; fillG = 143; fillB = 122;
          alpha = b.opacity * 0.7;
        } else if (paused) {
          // amber tint on paused blocks
          fillR = SIGNAL_RGB.r; fillG = SIGNAL_RGB.g; fillB = SIGNAL_RGB.b;
          alpha = b.opacity * 0.4;
        }

        // block fill
        ctx.fillStyle = rgba(fillR, fillG, fillB, alpha);
        const bx = b.x - b.w / 2;
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D).roundRect(bx, b.y, b.w, BLOCK_HEIGHT, 3);
        ctx.fill();

        // block border
        ctx.strokeStyle = rgba(fillR, fillG, fillB, Math.min(1, alpha * 2.5));
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D).roundRect(bx, b.y, b.w, BLOCK_HEIGHT, 3);
        ctx.stroke();
      });
    });

    // ── Special overlays per scene ──────────────────────────────────────────

    // HERO / CTA: Central amber pulsing chip silhouette
    if (heroOrCta) {
      const cx2 = cw / 2, cy2 = ch * 0.5;
      const t = (frameRef.current * 0.015);
      const pulse = Math.sin(t) * 0.015;
      const r = 54 + pulse * 60;

      ctx.strokeStyle = rgba(SIGNAL_RGB.r, SIGNAL_RGB.g, SIGNAL_RGB.b, 0.08 + pulse * 0.5);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D).roundRect(cx2 - r, cy2 - r, r * 2, r * 2, 10);
      ctx.stroke();

      // inner glow
      const ig = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r);
      ig.addColorStop(0, rgba(SIGNAL_RGB.r, SIGNAL_RGB.g, SIGNAL_RGB.b, 0.04 + pulse * 0.3));
      ig.addColorStop(1, rgba(SIGNAL_RGB.r, SIGNAL_RGB.g, SIGNAL_RGB.b, 0));
      ctx.fillStyle = ig;
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D).roundRect(cx2 - r, cy2 - r, r * 2, r * 2, 10);
      ctx.fill();
    }

    // HITL: "PAUSED" text overlay at top-center
    if (paused && !prefersReducedMotion) {
      const alpha = 0.3 + Math.sin(frameRef.current * 0.08) * 0.2;
      ctx.fillStyle = rgba(SIGNAL_RGB.r, SIGNAL_RGB.g, SIGNAL_RGB.b, alpha);
      ctx.font = `bold 11px 'JetBrains Mono', monospace`;
      ctx.letterSpacing = '0.2em';
      ctx.textAlign = 'center';
      ctx.fillText('⏸  AWAITING HUMAN REVIEW', cw / 2, 54);
      ctx.letterSpacing = '0em';
    }

    // DURABILITY: "RESTORED" flash banner
    if (restored && frameRef.current < 180 && !prefersReducedMotion) {
      const progress = frameRef.current / 180;
      const alpha2 = Math.max(0, 0.7 - progress * 0.7);
      ctx.fillStyle = rgba(SIGNAL_RGB.r, SIGNAL_RGB.g, SIGNAL_RGB.b, alpha2 * 0.1);
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = rgba(SIGNAL_RGB.r, SIGNAL_RGB.g, SIGNAL_RGB.b, alpha2);
      ctx.font = `bold 12px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('↺  CHECKPOINT RESTORED · RESUMING', cw / 2, 54);
    }

    // EXTRACTION: Two-column separator
    if (sc === 'extraction') {
      ctx.strokeStyle = rgba(SIGNAL_RGB.r, SIGNAL_RGB.g, SIGNAL_RGB.b, 0.08);
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 10]);
      ctx.beginPath();
      ctx.moveTo(cw / 2, ch * 0.1);
      ctx.lineTo(cw / 2, ch * 0.9);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // VALIDATION: 4-quadrant subtle markers
    if (sc === 'validation') {
      const checks = [
        { x: cw * 0.25, y: ch * 0.3 },
        { x: cw * 0.75, y: ch * 0.3 },
        { x: cw * 0.25, y: ch * 0.72 },
        { x: cw * 0.75, y: ch * 0.72 },
      ];
      checks.forEach((pt, ci) => {
        const phase = (frameRef.current * 0.02 + ci * 1.5);
        const a = (Math.sin(phase) * 0.5 + 0.5) * 0.06;
        ctx.fillStyle = rgba(63, 143, 122, a);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 70, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (!prefersReducedMotion) {
      rafRef.current = requestAnimationFrame(draw);
    }
  }, [prefersReducedMotion]);

  // init canvas & start loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      lanesRef.current = makeLanes(canvas.width, canvas.height);
      if (prefersReducedMotion) draw(); // single static frame
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
  }, [draw, prefersReducedMotion]);

  // Reset frame counter when scene changes (for RESTORED flash)
  useEffect(() => {
    if (scene === 'durability') frameRef.current = 0;
  }, [scene]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: 'block' }}
      aria-hidden="true"
    />
  );
};
