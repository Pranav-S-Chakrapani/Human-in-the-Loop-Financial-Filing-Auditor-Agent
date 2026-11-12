/**
 * ValidatorGrid — 400-node verification matrix adapted from Aetheris Scene 04.
 *
 * Simulates high-frequency consensus gossip, 267/400 BLS signature threshold,
 * and aggregated finality proof generation with live millisecond timer.
 */

import React, { useEffect, useRef } from 'react';

interface Props {
  total?: number;
  quorum?: number;
  roundMs?: number;
  accent?: string;
  ink?: string;
  slow?: number;
}

export const ValidatorGrid: React.FC<Props> = ({
  total = 400,
  quorum = 267,
  roundMs = 600,
  accent = '#E8B339',
  ink = '#FFFFFF',
  slow = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const order = [...Array(total).keys()];
    let seed = 42;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = total - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const rank = new Array(total);
    order.forEach((v, i) => (rank[v] = i));

    const t0 = performance.now();
    const cols = 25;
    const rows = Math.ceil(total / cols);

    const resize = () => {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = (container.clientWidth || 300) * d;
      canvas.height = (container.clientHeight || 200) * d;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);

      const d = Math.min(window.devicePixelRatio || 1, 2);
      const W = canvas.width;
      const H = canvas.height;
      if (!W || !H) return;

      const rm = roundMs * slow;
      const f = ((now - t0) % rm) / rm;

      ctx.clearRect(0, 0, W, H);
      const pad = 10 * d;
      const cw = (W - pad * 2) / cols;
      const ch = (H - pad * 2 - 20 * d) / rows;
      const r = Math.min(cw, ch) * 0.32;
      const signed = f < 0.2 ? 0 : f < 0.75 ? Math.floor(((f - 0.2) / 0.55) * total) : total;

      for (let i = 0; i < total; i++) {
        const cx = pad + (i % cols) * cw + cw / 2;
        const cy = pad + Math.floor(i / cols) * ch + ch / 2;
        const isSigned = rank[i] < signed;
        let fill = 'rgba(255, 255, 255, 0.08)';

        if (f < 0.2) {
          const rip = Math.hypot(cx - W / 2, cy - H / 2) / Math.hypot(W / 2, H / 2);
          fill = rip < f / 0.2 ? 'rgba(232, 179, 57, 0.45)' : 'rgba(255, 255, 255, 0.08)';
        } else if (isSigned) {
          fill = f > 0.75 && f < 0.9 ? accent : rank[i] < quorum ? ink : accent;
        } else {
          fill = 'rgba(255, 255, 255, 0.15)';
        }

        ctx.beginPath();
        ctx.arc(cx, cy, r * (isSigned && f >= 0.2 ? 1.2 : 1), 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
      }

      // Bottom telemetry footer text
      ctx.fillStyle = ink;
      ctx.font = `${10 * d}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'bottom';
      const label =
        f < 0.2
          ? 'gossip verification protocol'
          : f < 0.75
          ? `${String(Math.min(signed, total)).padStart(3, '0')} / ${total} nodes signed${signed >= quorum ? ' · QUORUM REACHED' : ''}`
          : f < 0.9
          ? 'aggregate consensus proof + immutable signature'
          : 'AUDIT INVARIANT FINAL';

      ctx.fillText(label, pad, H - 2 * d);
      ctx.textAlign = 'right';
      ctx.fillText(`${String(Math.floor(f * roundMs)).padStart(3, '0')} ms`, W - pad, H - 2 * d);
      ctx.textAlign = 'left';
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [total, quorum, roundMs, accent, ink, slow]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[220px] relative">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
    </div>
  );
};
