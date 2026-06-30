"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useWorkforceParticlesPreference } from "@/lib/workforce-particles";

const PARTICLE_COUNT = 360;
const DOT_GRID_SPACING = 34;
const DOT_GRID_DOT_STEP = 8.5;
const CURSOR_GLOW_SIZE = 160;
const TAU = Math.PI * 2;

function lerp(current: number, target: number, amount: number) {
  return current + (target - current) * amount;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

type PointerState = {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  speed: number;
  hasInteracted: boolean;
  lastMoveAt: number;
};

class Particle {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  size: number;
  alpha: number;
  phase: number;
  angle: number;
  depth: number;
  hueShift: number;
  radialOffset: number;

  constructor(private readonly index: number, private readonly total: number, width: number, height: number) {
    this.angle = (index / total) * TAU;
    this.phase = Math.random() * TAU;
    this.depth = 0.55 + Math.random() * 0.55;
    this.size = 1 + Math.random() * 2.2;
    this.alpha = 0.42 + Math.random() * 0.48;
    this.hueShift = Math.random();
    this.radialOffset = -96 + Math.random() * 206;
    this.x = width / 2 + Math.cos(this.angle) * 180;
    this.y = height / 2 + Math.sin(this.angle) * 180;
  }

  update(width: number, height: number, pointer: PointerState, time: number, pulse: number) {
    const centerX = width * 0.5;
    const centerY = height * 0.48;
    const baseRadius = Math.min(width, height) * 0.3;
    const bandSpread = this.radialOffset + Math.sin(time * 0.0007 + this.phase) * 18;

    // Ring home: a circular matrix with layered sine/cosine distortion so it never feels mechanically perfect.
    const waveA = Math.sin(time * 0.00125 + this.phase + this.index * 0.09) * 18;
    const waveB = Math.cos(time * 0.00085 + this.phase * 1.7) * 9;
    const pulseWave = Math.sin(pulse - this.index * 0.075) * 22 * clamp(pulse / TAU, 0, 1);
    const speedInfluence = clamp(pointer.speed / 48, 0, 1);

    // Before interaction, the ring lives in the hero. After interaction, the last
    // cursor position becomes the ring's home so idle never drifts to screen center.
    const ringCenterX = pointer.hasInteracted ? pointer.x : centerX;
    const ringCenterY = pointer.hasInteracted ? pointer.y : centerY;
    const interactionRadius = pointer.hasInteracted ? lerp(72, 170, speedInfluence) : 0;
    const ringRadius = baseRadius + interactionRadius;

    // Reuse the same living ring distortion for both load and cursor states.
    const cursorAngle = this.angle + Math.sin(time * 0.001 + this.phase) * 0.12;
    const scatter = Math.sin(time * 0.0014 + this.phase * 2.1 + this.index * 0.13) * lerp(18, 58, speedInfluence);
    const targetRadius = ringRadius + bandSpread + waveA * 0.42 + waveB * 0.52 + pulseWave * 0.35 + scatter;
    const targetX = ringCenterX + Math.cos(cursorAngle) * targetRadius;
    const targetY = ringCenterY + Math.sin(cursorAngle) * targetRadius * 0.86;

    // Physics: lerp plus velocity gives a polished elastic response without expensive constraints.
    const pull = pointer.hasInteracted ? 0.24 : 0.12;
    const settle = pointer.hasInteracted ? 0.18 : 0.045;
    this.vx = lerp(this.vx, (targetX - this.x) * pull, 0.22);
    this.vy = lerp(this.vy, (targetY - this.y) * pull, 0.22);
    this.x += this.vx;
    this.y += this.vy;
    this.x = lerp(this.x, targetX, settle);
    this.y = lerp(this.y, targetY, settle);
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    const flicker = 0.82 + Math.sin(time * 0.003 + this.phase) * 0.18;
    const alpha = this.alpha * flicker;
    const radius = this.size * this.depth;
    const color = this.hueShift > 0.42 ? "255, 86, 64" : "255, 155, 115";

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${color})`;
    ctx.shadowColor = `rgba(${color}, 0.45)`;
    ctx.shadowBlur = 8 + radius * 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

export function WorkforceParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorGlowRef = useRef<HTMLDivElement | null>(null);
  const [enabled] = useWorkforceParticlesPreference();
  const cursorGlowStyle: CSSProperties = {
    width: CURSOR_GLOW_SIZE,
    height: CURSOR_GLOW_SIZE,
    borderRadius: "9999px",
    background:
      "radial-gradient(circle, rgba(255, 86, 64, 0.48) 0%, rgba(255, 86, 64, 0.32) 34%, rgba(255, 86, 64, 0.16) 68%, transparent 100%)",
    filter: "blur(14px)",
    opacity: 1,
    transform: "translate3d(50vw, 50vh, 0) translate(-50%, -50%)",
    willChange: "transform",
  };

  useEffect(() => {
    const glow = cursorGlowRef.current;
    if (!glow) return;

    let rafId = 0;
    let nextX = window.innerWidth / 2;
    let nextY = window.innerHeight / 2;

    const updateGlow = () => {
      glow.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) translate(-50%, -50%)`;
      rafId = 0;
    };

    const handlePointerMove = (event: PointerEvent) => {
      nextX = event.clientX;
      nextY = event.clientY;

      if (!rafId) {
        rafId = window.requestAnimationFrame(updateGlow);
      }
    };

    updateGlow();
    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  useEffect(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let dpr = 1;
    let width = 0;
    let height = 0;

    const drawGrid = () => {
      const isDarkMode = document.documentElement.classList.contains("dark");

      ctx.clearRect(0, 0, width, height);

      const minorColor = isDarkMode ? "rgba(255, 255, 255, 0.16)" : "rgba(24, 43, 54, 0.38)";
      const majorColor = isDarkMode ? "rgba(255, 155, 115, 0.42)" : "rgba(255, 86, 64, 0.62)";
      const startX = -(DOT_GRID_SPACING * 0.5);
      const startY = -(DOT_GRID_SPACING * 0.5);

      for (let x = startX, column = 0; x <= width + DOT_GRID_SPACING; x += DOT_GRID_SPACING, column += 1) {
        const isMajorLine = column % 5 === 0;
        ctx.fillStyle = isMajorLine ? majorColor : minorColor;

        for (let y = -DOT_GRID_DOT_STEP; y <= height + DOT_GRID_DOT_STEP; y += DOT_GRID_DOT_STEP) {
          ctx.beginPath();
          ctx.arc(x, y, isMajorLine ? 0.95 : 0.72, 0, TAU);
          ctx.fill();
        }
      }

      for (let y = startY, row = 0; y <= height + DOT_GRID_SPACING; y += DOT_GRID_SPACING, row += 1) {
        const isMajorLine = row % 5 === 0;
        ctx.fillStyle = isMajorLine ? majorColor : minorColor;

        for (let x = -DOT_GRID_DOT_STEP; x <= width + DOT_GRID_DOT_STEP; x += DOT_GRID_DOT_STEP) {
          ctx.beginPath();
          ctx.arc(x, y, isMajorLine ? 0.95 : 0.72, 0, TAU);
          ctx.fill();
        }
      }

      for (let y = startY, row = 0; y <= height + DOT_GRID_SPACING; y += DOT_GRID_SPACING, row += 1) {
        for (let x = startX, column = 0; x <= width + DOT_GRID_SPACING; x += DOT_GRID_SPACING, column += 1) {
          const isAccent = column % 5 === 0 && row % 5 === 0;
          if (!isAccent) continue;

          ctx.beginPath();
          ctx.fillStyle = majorColor;
          ctx.arc(x, y, 1.55, 0, TAU);
          ctx.fill();
        }
      }
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawGrid();
    };

    resize();
    window.addEventListener("resize", resize);

    const observer = new MutationObserver(drawGrid);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;
    let idlePulse = 0;
    const particles: Particle[] = [];
    const pointer: PointerState = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      previousX: window.innerWidth / 2,
      previousY: window.innerHeight / 2,
      speed: 0,
      hasInteracted: false,
      lastMoveAt: performance.now(),
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (particles.length === 0) {
        for (let index = 0; index < PARTICLE_COUNT; index += 1) {
          particles.push(new Particle(index, PARTICLE_COUNT, width, height));
        }
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointer.previousX = pointer.x;
      pointer.previousY = pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.speed = Math.hypot(pointer.x - pointer.previousX, pointer.y - pointer.previousY);
      pointer.hasInteracted = true;
      pointer.lastMoveAt = performance.now();
    };

    const render = (time: number) => {
      const idleFor = time - pointer.lastMoveAt;
      if (idleFor > 3000) {
        idlePulse = (idlePulse + 0.045) % TAU;
      } else {
        idlePulse = lerp(idlePulse, 0, 0.08);
      }

      pointer.speed = lerp(pointer.speed, 0, 0.08);
      ctx.clearRect(0, 0, width, height);

      for (const particle of particles) {
        particle.update(width, height, pointer, time, idlePulse);
        particle.draw(ctx, time);
      }

      rafId = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    rafId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      particles.length = 0;
    };
  }, [enabled]);

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0 h-screen w-screen overflow-hidden"
        aria-hidden="true"
      >
        <div ref={cursorGlowRef} className="absolute left-0 top-0" style={cursorGlowStyle} />
        <canvas ref={gridCanvasRef} className="absolute inset-0 h-full w-full" />
      </div>
      {enabled ? (
        <canvas
          ref={canvasRef}
          className="pointer-events-none fixed inset-0 z-0 h-screen w-screen"
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}
