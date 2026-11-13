/**
 * SupernovaStage — 3D WebGL Background Engine adapted from Aetheris for VantageAudit.
 *
 * Features:
 * - 3D Silicon Processor Die with beveled extrusion, sharp core emblem, and glowing rim.
 * - Radiating PCB Circuit Traces with glowing data packet sprites traveling along the paths.
 * - 3D Pipeline Lanes (6 lanes of 34 extruded data blocks) with wireframe heads and emissive lighting.
 * - Dynamic camera interpolation matching the active scroll scene (hero, extraction, validation, hitl, durability, cta).
 * - Full WebGL cleanup on unmount, responsive ResizeObserver, and prefers-reduced-motion fallback.
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type SceneId =
  | 'hero'
  | 'extraction'
  | 'validation'
  | 'hitl'
  | 'durability'
  | 'cta';

interface Props {
  scene: SceneId;
  accent?: string;
  paper?: string;
  prefersReducedMotion?: boolean;
}

const LANES = 6;
const N = 34;
const STEP = 1.25;

interface SceneConfig {
  cam: [number, number, number];
  look: [number, number, number];
  gap: number;
  lanes: number;
  ts: number;
  chip?: number;
}

const SCENE_CONFIGS: Record<SceneId, SceneConfig> = {
  hero: {
    cam: [0.01, 30, 0.01],
    look: [0, 0, 0],
    gap: 2.4,
    lanes: 4,
    ts: 1.0,
    chip: 1.0,
  },
  extraction: {
    cam: [10, 7.5, 15],
    look: [0, 0, -6],
    gap: 2.6,
    lanes: 4,
    ts: 1.2,
    chip: 0.15,
  },
  validation: {
    cam: [-5.2, 2.2, 9],
    look: [-3.6, 0.2, 4],
    gap: 2.4,
    lanes: 4,
    ts: 0.8,
    chip: 0.2,
  },
  hitl: {
    cam: [0, 14, 10],
    look: [0, 0, -4],
    gap: 1.2,
    lanes: 4,
    ts: 0.15, // Suspended / slow motion
    chip: 0.4,
  },
  durability: {
    cam: [9, 4, 14],
    look: [0, 0, -4],
    gap: 2.4,
    lanes: 4,
    ts: 2.2, // Rapid recovery flow
    chip: 0.2,
  },
  cta: {
    cam: [0.01, 30, 0.01],
    look: [0, 0, 0],
    gap: 2.4,
    lanes: 4,
    ts: 1.0,
    chip: 1.0,
  },
};

export const SupernovaStage: React.FC<Props> = ({
  scene,
  accent = '#E8B339',
  paper = '#090C12',
  prefersReducedMotion = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneId>(scene);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = mountRef.current;
    if (!canvas || !container) return;

    let isDisposed = false;
    const accentColor = new THREE.Color(accent);
    const paperColor = new THREE.Color(paper);
    const greyColor = accentColor.clone().multiplyScalar(0.35);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Three Scene & Fog
    const threeScene = new THREE.Scene();
    threeScene.fog = new THREE.Fog(paperColor.getHex(), 14, 48);

    // Camera
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
    const initialConfig = SCENE_CONFIGS[sceneRef.current] || SCENE_CONFIGS.hero;
    camera.position.set(...initialConfig.cam);
    const lookTarget = new THREE.Vector3(...initialConfig.look);
    camera.lookAt(lookTarget);

    let currentGap = initialConfig.gap;
    let currentTs = initialConfig.ts;
    let currentChip = initialConfig.chip || 0;

    // Lighting
    threeScene.add(new THREE.HemisphereLight(0xffffff, 0x101010, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(6, 14, 8);
    threeScene.add(sun);

    // Materials
    const railMat = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.35 });
    const blockGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const frameGeo = new THREE.BoxGeometry(1.15, 1.15, 1.15);
    const edgeGeo = new THREE.EdgesGeometry(blockGeo);
    const hullMat = new THREE.MeshBasicMaterial({ color: accentColor, side: THREE.BackSide });
    const edgeMat = new THREE.LineBasicMaterial({ color: accentColor });

    const rails: THREE.Mesh[] = [];
    const blocks: THREE.Group[][] = [];
    const heads: THREE.Mesh[] = [];
    const phases: number[] = [];
    const speeds: number[] = [];
    const laneVisibilities: number[] = [];

    // Create 6 3D Pipeline Lanes
    for (let l = 0; l < LANES; l++) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, N * STEP + 6), railMat);
      rail.position.set(0, -0.5, (-N * STEP) / 2 + 6);
      threeScene.add(rail);
      rails.push(rail);

      const row: THREE.Group[] = [];
      for (let i = 0; i < N; i++) {
        const group = new THREE.Group();
        const faceMat = new THREE.MeshStandardMaterial({
          color: 0x0f131a,
          roughness: 0.4,
          metalness: 0.6,
        });
        const face = new THREE.Mesh(blockGeo, faceMat);
        const hull = new THREE.Mesh(blockGeo, hullMat);
        hull.scale.setScalar(1.05);
        const edges = new THREE.LineSegments(edgeGeo, edgeMat);
        group.add(face, hull, edges);
        group.userData = { face: faceMat };
        threeScene.add(group);
        row.push(group);
      }
      blocks.push(row);

      const head = new THREE.Mesh(
        frameGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true })
      );
      threeScene.add(head);
      heads.push(head);

      phases.push(l * 0.25);
      speeds.push(1);
      laneVisibilities.push(l < 4 ? 1 : 0);
    }

    // ── Build 3D Processor Chip & Radiating PCB Traces ────────────────────────
    const chipGroup = new THREE.Group();
    threeScene.add(chipGroup);

    const S = 6.2 / 100;
    const offset = 50;
    const pts: [number, number][] = [
      [12, 2], [19, 2], [27, 10.5], [32, 12.5], [68, 12.5], [73, 10.5], [81, 2], [88, 2],
      [98, 12], [98, 88], [88, 98], [81, 98], [73, 89.5], [68, 87.5], [32, 87.5], [27, 89.5],
      [19, 98], [12, 98], [2, 88], [2, 12],
    ];
    const shape = new THREE.Shape();
    pts.forEach(([px, py], i) => {
      const x = (px - offset) * S;
      const y = (py - offset) * S;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.closePath();

    const depth = 0.5;
    const chipBody = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 3,
      }),
      new THREE.MeshStandardMaterial({ color: 0x0f131a, roughness: 0.35, metalness: 0.7 })
    );
    chipBody.rotation.x = -Math.PI / 2;
    chipBody.position.y = -0.25;
    chipGroup.add(chipBody);

    // Glowing Rim
    const rimPts = shape.getPoints(4).map((p) => new THREE.Vector3(p.x, depth - 0.25 + 0.07, p.y));
    const rimMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const rim = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true, 'catmullrom', 0), 400, 0.03, 8, true),
      rimMat
    );
    chipGroup.add(rim);

    // Core Emblem: 3D Isometric Cryptographic Vault (VantageAudit Core)
    const coreGroup = new THREE.Group();
    coreGroup.position.y = depth - 0.25 + 0.1;
    chipGroup.add(coreGroup);

    // 3D Hexagonal Vault Base
    const vaultShape = new THREE.Shape();
    const R = 1.35;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 6;
      const vx = Math.cos(a) * R;
      const vy = Math.sin(a) * R;
      if (i === 0) vaultShape.moveTo(vx, vy);
      else vaultShape.lineTo(vx, vy);
    }
    vaultShape.closePath();

    const vaultGeo = new THREE.ExtrudeGeometry(vaultShape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    });
    const vaultBody = new THREE.Mesh(
      vaultGeo,
      new THREE.MeshStandardMaterial({
        color: 0x121622,
        roughness: 0.3,
        metalness: 0.85,
      })
    );
    vaultBody.rotation.x = -Math.PI / 2;
    coreGroup.add(vaultBody);

    // Glowing Isometric Vault Facet Edges (Hexagon + 3 internal radiating axes)
    const lineMat = new THREE.LineBasicMaterial({
      color: accentColor,
    });
    const vaultLinePts: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const a = ((i % 6) * Math.PI) / 3 - Math.PI / 6;
      vaultLinePts.push(new THREE.Vector3(Math.cos(a) * R, 0.22, Math.sin(a) * R));
    }
    const outerHexLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(vaultLinePts),
      lineMat
    );
    coreGroup.add(outerHexLine);

    // 3 internal isometric cube division lines radiating from center to every other vertex
    for (let k = 0; k < 3; k++) {
      const a = (k * 2 * Math.PI) / 3 - Math.PI / 6;
      const radPts = [
        new THREE.Vector3(0, 0.23, 0),
        new THREE.Vector3(Math.cos(a) * R, 0.23, Math.sin(a) * R),
      ];
      const radLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(radPts),
        lineMat
      );
      coreGroup.add(radLine);
    }

    // Central Floating Luminous Audit Gem (Octahedron)
    const gemGeo = new THREE.OctahedronGeometry(0.36, 0);
    const gemMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.9,
    });
    const centralGem = new THREE.Mesh(gemGeo, gemMat);
    centralGem.position.set(0, 0.38, 0);
    coreGroup.add(centralGem);

    // Mini pipeline blocks seen on the chip die
    const miniRows: THREE.Group[][] = [];
    const MG = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    const ME = new THREE.EdgesGeometry(MG);
    for (let l = 0; l < 4; l++) {
      const row: THREE.Group[] = [];
      for (let i = 0; i < 12; i++) {
        const grp = new THREE.Group();
        const fMat = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.05 });
        const eMat = new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0.15 });
        const face = new THREE.Mesh(MG, fMat);
        const edge = new THREE.LineSegments(ME, eMat);
        grp.add(face, edge);
        grp.userData = { face: fMat, edge: eMat };
        grp.position.set((l - 1.5) * 0.95, 0.32, 0);
        chipGroup.add(grp);
        row.push(grp);
      }
      miniRows.push(row);
    }

    // ── Dot Texture for PCB Data Sprites ─────────────────────────────────────
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = 64;
    spriteCanvas.height = 64;
    const sCtx = spriteCanvas.getContext('2d')!;
    const sGrad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    sGrad.addColorStop(0, 'rgba(255,255,255,1)');
    sGrad.addColorStop(0.3, 'rgba(232,179,57,0.8)');
    sGrad.addColorStop(1, 'rgba(232,179,57,0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 64, 64);
    const spriteTexture = new THREE.CanvasTexture(spriteCanvas);

    // Radiating PCB Traces
    const tracesGroup = new THREE.Group();
    chipGroup.add(tracesGroup);
    const nodeGeo = new THREE.TorusGeometry(0.14, 0.025, 8, 24);
    interface Trace {
      mat: THREE.MeshBasicMaterial;
      pts: THREE.Vector3[];
      len: number;
      offset: number;
      speed: number;
      pulse: THREE.Sprite;
      node?: THREE.Mesh;
    }
    const traces: Trace[] = [];

    const addTrace = (startX: number, startZ: number, dirX: number, steps: number) => {
      let p = new THREE.Vector3(startX, 0, startZ);
      const traceMat = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.18 });
      const pulseMat = new THREE.SpriteMaterial({
        map: spriteTexture,
        color: accentColor,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const traceData: Trace = {
        mat: traceMat,
        pts: [p.clone()],
        len: 0,
        offset: Math.random(),
        speed: 0.7 + Math.random() * 0.8,
        pulse: new THREE.Sprite(pulseMat),
      };
      traceData.pulse.scale.setScalar(0.45);
      tracesGroup.add(traceData.pulse);
      traces.push(traceData);

      for (let s = 0; s < steps; s++) {
        const straight = 0.5 + Math.floor(Math.random() * 3) * 0.5;
        const q = p.clone();
        q.x += dirX * straight;
        const segLen = p.distanceTo(q);
        if (segLen > 0.01) {
          traceData.pts.push(q.clone());
          traceData.len += segLen;
          const segmentMesh = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.03, 0.05), traceMat);
          segmentMesh.position.copy(p).add(q).multiplyScalar(0.5);
          segmentMesh.position.y = -0.44;
          segmentMesh.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x);
          tracesGroup.add(segmentMesh);
        }
        p = q;
        if (s < steps - 1) {
          const sideZ = Math.random() < 0.5 ? -1 : 1;
          const sideStep = p.clone();
          sideStep.z += sideZ * 0.8;
          const sLen = p.distanceTo(sideStep);
          if (sLen > 0.01) {
            traceData.pts.push(sideStep.clone());
            traceData.len += sLen;
            const sideMesh = new THREE.Mesh(new THREE.BoxGeometry(sLen, 0.03, 0.05), traceMat);
            sideMesh.position.copy(p).add(sideStep).multiplyScalar(0.5);
            sideMesh.position.y = -0.44;
            sideMesh.rotation.y = -Math.atan2(sideStep.z - p.z, sideStep.x - p.x);
            tracesGroup.add(sideMesh);
          }
          p = sideStep;
        }
      }

      const endNode = new THREE.Mesh(nodeGeo, traceMat);
      endNode.rotation.x = Math.PI / 2;
      endNode.position.set(p.x, -0.44, p.z);
      tracesGroup.add(endNode);
      traceData.node = endNode;
    };

    const half = 3.8;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        addTrace(side * half, -1.8 + i * 1.2, side, 2 + Math.floor(Math.random() * 2));
      }
    }

    // Resize handling
    const resize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w < 720 ? 46 : 32;
      camera.updateProjectionMatrix();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let lastTime = performance.now();

    // ── Animation Loop ────────────────────────────────────────────────────────
    const loop = (now: number) => {
      if (isDisposed) return;
      rafRef.current = requestAnimationFrame(loop);

      const dt = Math.min(50, now - lastTime);
      lastTime = now;

      const activeConfig = SCENE_CONFIGS[sceneRef.current] || SCENE_CONFIGS.hero;
      const k = 1 - Math.pow(0.001, dt / 1000);

      currentGap += (activeConfig.gap - currentGap) * k * 1.2;
      currentChip += ((activeConfig.chip || 0) - currentChip) * k * 1.1;
      currentTs += (activeConfig.ts - currentTs) * k * 1.4;

      const chipScale = Math.max(0.001, currentChip);
      chipGroup.scale.set(chipScale, chipScale, chipScale);
      chipGroup.visible = chipScale > 0.01;
      chipGroup.rotation.y = prefersReducedMotion ? 0 : (1 - currentChip) * 0.6;

      const pulsePhase = phases[0] % 1;
      gemMat.emissiveIntensity = 0.8 + Math.max(0, 1 - pulsePhase) * 0.9;
      centralGem.rotation.y += prefersReducedMotion ? 0 : 0.015;
      centralGem.rotation.x += prefersReducedMotion ? 0 : 0.008;
      coreGroup.position.y = 0.35 + Math.sin(Math.PI * Math.max(0, 1 - pulsePhase)) * 0.35;

      // Animate PCB Traces
      if (chipGroup.visible && traces.length) {
        const timeSec = now / 1000;
        traces.forEach((tr) => {
          tr.mat.opacity = 0.12 + 0.08 * (0.5 + 0.5 * Math.sin(timeSec * 1.2 + tr.offset * 6.28));
          const cycle = (phases[0] * 0.2 * tr.speed + tr.offset) % 1;
          const u = Math.min(1, cycle / 0.55);
          let remaining = u * tr.len;
          let a = tr.pts[0];

          for (let i = 1; i < tr.pts.length; i++) {
            const b = tr.pts[i];
            const segDist = a.distanceTo(b);
            if (remaining <= segDist) {
              tr.pulse.position.lerpVectors(a, b, segDist ? remaining / segDist : 0);
              break;
            }
            remaining -= segDist;
            a = b;
            if (i === tr.pts.length - 1) tr.pulse.position.copy(b);
          }
          tr.pulse.position.y = -0.4;
          tr.pulse.material.opacity = cycle < 0.55 ? 0.65 * Math.sin(Math.PI * u) : 0;
          if (tr.node) {
            tr.node.scale.setScalar(
              1 + (cycle > 0.5 && cycle < 0.7 ? 0.6 * Math.sin((Math.PI * (cycle - 0.5)) / 0.2) : 0)
            );
          }
        });
      }

      // Animate Mini blocks on the die
      if (chipGroup.visible) {
        const MS = 0.46;
        const span = 1.95;
        const fadeW = 0.5;
        for (let l = 0; l < 4; l++) {
          const ph = phases[l] % 1;
          const row = miniRows[l];
          for (let i = 0; i < row.length; i++) {
            const m = row[i];
            const pos = i + ph;
            const z = span - pos * MS;
            const live = Math.max(0, 1 - Math.max(0, pos - 1));
            const fade = Math.max(0, Math.min(1, (span - Math.abs(z)) / fadeW));
            m.position.z = z;
            m.visible = z > -span && fade > 0;
            m.userData.face.opacity = (0.04 + live * 0.18) * fade;
            m.userData.edge.opacity = (0.12 + live * 0.4) * fade;
          }
        }
      }

      // Smooth Camera Transitions
      const tgtCam = activeConfig.cam;
      const tgtLook = activeConfig.look;
      const drift = prefersReducedMotion ? 0 : Math.sin(now / 9000) * 0.5;

      camera.position.x += (tgtCam[0] + drift - camera.position.x) * k;
      camera.position.y += (tgtCam[1] - camera.position.y) * k;
      camera.position.z += (tgtCam[2] - camera.position.z) * k;
      lookTarget.x += (tgtLook[0] - lookTarget.x) * k;
      lookTarget.y += (tgtLook[1] - lookTarget.y) * k;
      lookTarget.z += (tgtLook[2] - lookTarget.z) * k;
      camera.lookAt(lookTarget);

      // Animate 3D Pipeline Lanes
      const count = activeConfig.lanes;
      for (let l = 0; l < LANES; l++) {
        if (!prefersReducedMotion) {
          phases[l] += (dt * currentTs) / (600 * speeds[l]);
        }
        const visT = l < count ? 1 : 0;
        laneVisibilities[l] += (visT - laneVisibilities[l]) * k * 1.5;
        const vis = laneVisibilities[l];
        const x = (l - (count - 1) / 2) * currentGap;
        const ph = phases[l] % 1;

        rails[l].position.x = x;
        rails[l].scale.x = Math.max(0.001, vis * (1 - currentChip));
        rails[l].visible = vis > 0.02;

        const row = blocks[l];
        for (let i = 0; i < N; i++) {
          const m = row[i];
          const pos = i + ph;
          const live = Math.max(0, 1 - Math.max(0, pos - 1));
          m.position.set(
            x * (1 - currentChip),
            live * 0.55 * Math.sin(Math.PI * ph) * (1 - currentChip) + 0.35 * currentChip,
            (5 - pos * STEP) * (1 - currentChip)
          );
          m.scale.setScalar((0.8 + live * 0.2) * Math.max(0.001, vis * (1 - currentChip)));
          m.userData.face.emissive.copy(accentColor).multiplyScalar(live * 0.6);
          m.userData.face.color.lerpColors(paperColor, greyColor, live);
          m.visible = pos < N - 1 && vis > 0.02;
        }

        const head = heads[l];
        head.position.set(x * (1 - currentChip), 0.1, (5 - ph * STEP) * (1 - currentChip));
        head.rotation.y = prefersReducedMotion ? 0 : (ph * Math.PI) / 2;
        head.scale.setScalar(Math.max(0.001, vis * (1 - currentChip)));
        head.visible = vis > 0.02;
        (head.material as THREE.MeshBasicMaterial).color.copy(accentColor);
        (head.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.65 * (1 - ph);
      }

      renderer.render(threeScene, camera);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      renderer.dispose();
    };
  }, [accent, paper, prefersReducedMotion]);

  return (
    <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
