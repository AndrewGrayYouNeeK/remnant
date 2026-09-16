import { useEffect, useRef, useState } from "react";
import { MACHINES } from "./level";
import { sfx, unlockAudio } from "./audio";
import { fresh, inRange, leapTo, machineById, pickMachineAt, step, useTrick } from "./sim";
import {
  DAWN_SECONDS,
  LEAP_RANGE,
  TRANSMIT_NEED,
  WORLD_H,
  WORLD_W,
  type GameState,
  type Human,
} from "./types";

const hangarSrc = "/game/hangar.jpg";

function loadImg(src: string) {
  const im = new Image();
  im.crossOrigin = "anonymous";
  im.src = src;
  return im;
}

const images: Record<string, HTMLImageElement> = {};
function img(src: string) {
  if (!images[src]) images[src] = loadImg(src);
  return images[src];
}

function preload() {
  img(hangarSrc);
  for (const m of MACHINES) img(m.sprite);
  for (const who of ["guard", "tech", "colonel"] as const) {
    for (const d of ["down", "left", "right", "up"]) {
      for (let i = 1; i <= 4; i++) img(`/game/${who}/${d}-${i}.png`);
    }
  }
  for (let i = 1; i <= 4; i++) img(`/game/spark/idle-${i}.png`);
}

function dirOf(facing: number): "down" | "left" | "right" | "up" {
  const a = ((facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (a > Math.PI * 1.75 || a <= Math.PI * 0.25) return "right";
  if (a <= Math.PI * 0.75) return "down";
  if (a <= Math.PI * 1.25) return "left";
  return "up";
}

function humanSprite(h: Human, t: number) {
  const moving = h.stunned <= 0;
  const frame = moving ? (Math.floor(t * 6) % 4) + 1 : 1;
  return img(`/game/${h.role}/${dirOf(h.facing)}-${frame}.png`);
}

type Cam = { x: number; y: number; z: number };

function worldFromEvent(
  e: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  cam: Cam,
) {
  const r = canvas.getBoundingClientRect();
  const sx = ((e.clientX - r.left) / r.width) * canvas.width;
  const sy = ((e.clientY - r.top) / r.height) * canvas.height;
  const wx = cam.x + (sx - canvas.width / 2) / cam.z;
  const wy = cam.y + (sy - canvas.height / 2) / cam.z;
  return { wx, wy };
}

function drawCone(ctx: CanvasRenderingContext2D, h: Human, cut: number) {
  const range = h.range * (cut > 0 ? 0.42 : 1);
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.facing);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, range, -h.cone / 2, h.cone / 2);
  ctx.closePath();
  ctx.fillStyle = h.stare > 0.4 ? "rgba(255,106,74,0.16)" : "rgba(224,176,86,0.1)";
  ctx.fill();
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, s: GameState, cam: Cam, hover: string | null) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = "#07080c";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  const shx = (Math.random() - 0.5) * s.shake * 18;
  const shy = (Math.random() - 0.5) * s.shake * 18;
  ctx.translate(w / 2 + shx, h / 2 + shy);
  ctx.scale(cam.z, cam.z);
  ctx.translate(-cam.x, -cam.y);

  const floor = img(hangarSrc);
  if (floor.complete && floor.naturalWidth) ctx.drawImage(floor, 0, 0, WORLD_W, WORLD_H);
  else {
    ctx.fillStyle = "#1a1814";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  if (s.cutT > 0) {
    ctx.fillStyle = `rgba(0,0,0,${0.45 + Math.min(0.25, s.cutT * 0.04)})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  if (s.phase === "play" || s.phase === "win" || s.phase === "lose") {
    for (const hu of s.humans) drawCone(ctx, hu, s.cutT);
  }

  const host = machineById(s.possessed);
  ctx.save();
  ctx.strokeStyle = "rgba(94,240,208,0.35)";
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(host.x + host.w / 2, host.y + host.h / 2, LEAP_RANGE, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  for (const m of MACHINES) {
    const reachable = inRange(s.possessed, m.id) || m.id === s.possessed;
    const spr = img(m.sprite);
    ctx.save();
    if (s.unplugged[m.id]) ctx.globalAlpha = 0.35;
    if (m.id === s.possessed) {
      ctx.shadowColor = "#5ef0d0";
      ctx.shadowBlur = 28;
    } else if (reachable) {
      ctx.shadowColor = "rgba(94,240,208,0.55)";
      ctx.shadowBlur = 12;
    }
    if (spr.complete && spr.naturalWidth) ctx.drawImage(spr, m.x, m.y, m.w, m.h);
    else {
      ctx.fillStyle = "#24302c";
      ctx.fillRect(m.x, m.y, m.w, m.h);
    }
    ctx.restore();

    if (m.id === s.possessed || hover === m.id || reachable) {
      ctx.strokeStyle = m.id === s.possessed ? "#5ef0d0" : hover === m.id ? "#e7ead4" : "rgba(94,240,208,0.5)";
      ctx.lineWidth = m.id === s.possessed ? 2.4 : 1.2;
      ctx.strokeRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6);
    }
  }

  if (s.beamOn) {
    const f = machineById("flood");
    const gx = f.x + f.w / 2;
    const gy = f.y + f.h / 2;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(-0.4);
    const grd = ctx.createLinearGradient(0, 0, 340, 0);
    grd.addColorStop(0, "rgba(255,240,180,0.35)");
    grd.addColorStop(1, "rgba(255,240,180,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(340, -90);
    ctx.lineTo(340, 90);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const sparkFrame = (Math.floor(s.time * 6) % 4) + 1;
  const spark = img(`/game/spark/idle-${sparkFrame}.png`);
  if (spark.complete && spark.naturalWidth) {
    ctx.drawImage(spark, host.x + host.w / 2 - 28, host.y + host.h / 2 - 36, 56, 56);
  }

  for (const hu of s.humans) {
    const sp = humanSprite(hu, s.time);
    const size = hu.role === "guard" ? 78 : 72;
    if (sp.complete && sp.naturalWidth) ctx.drawImage(sp, hu.x - size / 2, hu.y - size + 6, size, size);
    else {
      ctx.fillStyle = hu.role === "guard" ? "#5a6b3a" : "#c8c2b4";
      ctx.beginPath();
      ctx.arc(hu.x, hu.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hu.stare > 0.15) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(hu.x - 16, hu.y - 42, 32, 4);
      ctx.fillStyle = hu.stare > 0.7 ? "#ff6a4a" : "#e0b056";
      ctx.fillRect(hu.x - 16, hu.y - 42, 32 * hu.stare, 4);
    }
  }

  for (const p of s.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = "#5ef0d0";
    ctx.fillRect(p.x, p.y, 3, 3);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export function Inhabit() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(fresh());
  const camRef = useRef<Cam>({ x: WORLD_W / 2, y: WORLD_H / 2, z: 1.05 });
  const hoverRef = useRef<string | null>(null);
  const [, setTick] = useState(0);
  const hud = () => setTick((n) => (n + 1) % 100000);

  useEffect(() => {
    preload();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let acc = 0;
    let last = performance.now();
    let raf = 0;
    const STEP = 1 / 60;

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      const s = stateRef.current;
      while (acc >= STEP) {
        step(s, STEP);
        acc -= STEP;
      }
      const host = machineById(s.possessed);
      const tx = host.x + host.w / 2;
      const ty = host.y + host.h / 2;
      camRef.current.x += (tx - camRef.current.x) * (1 - Math.exp(-dt * 4));
      camRef.current.y += (ty - camRef.current.y) * (1 - Math.exp(-dt * 4));
      drawWorld(ctx, s, camRef.current, hoverRef.current);
      if (Math.floor(now / 120) !== Math.floor((now - dt * 1000) / 120)) hud();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "KeyE") {
        e.preventDefault();
        if (useTrick(stateRef.current)) sfx.trick();
        hud();
      }
    };
    window.addEventListener("keydown", onKey);

    window.__inhabitTest = {
      getPossessed: () => stateRef.current.possessed,
      getPhase: () => stateRef.current.phase,
      leap: (id: string) => leapTo(stateRef.current, id),
      trick: () => useTrick(stateRef.current),
    };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const fit = () => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.floor(c.clientWidth * dpr);
      c.height = Math.floor(c.clientHeight * dpr);
      const z = Math.max(1.55, Math.min(2.15, (c.height / 520)));
      camRef.current.z = z;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const s = stateRef.current;
  const host = machineById(s.possessed);
  const dawnLeft = Math.max(0, DAWN_SECONDS - s.time);
  const heat = Math.max(...s.humans.map((h) => h.stare), 0);

  const start = () => {
    unlockAudio();
    stateRef.current = { ...fresh(), phase: "play" };
    hud();
  };
  const reset = () => {
    stateRef.current = fresh();
    hud();
  };

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    const { wx, wy } = worldFromEvent(e, c, camRef.current);
    const m = pickMachineAt(wx, wy);
    hoverRef.current = m?.id ?? null;
    if (e.type === "pointerdown" && m) {
      if (m.id === s.possessed) {
        if (useTrick(stateRef.current)) sfx.trick();
      } else if (leapTo(stateRef.current, m.id)) sfx.leap();
      hud();
    }
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-void font-mono text-ink">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={onPointer}
        onPointerMove={onPointer}
      />

      {s.phase === "play" && (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
          <div>
            <p className="font-sans text-xs tracking-[0.28em] text-cyan">REMNANT · 1947</p>
            <p className="mt-1 text-sm text-ink">Wearing {host.name}</p>
          </div>
          <div className="flex gap-2 text-[10px] tracking-wider text-mute">
            <Meter label="DAWN" value={dawnLeft / DAWN_SECONDS} warn={dawnLeft < 30} />
            <Meter label="EYES" value={heat} warn={heat > 0.55} heat />
            <Meter label="SIGNAL" value={s.winFill / TRANSMIT_NEED} />
            <div className="min-w-20 border border-line bg-panel/80 px-2 py-1.5">
              <div>WITNESS</div>
              <div className="mt-1 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <i
                    key={i}
                    className={`block h-2 w-2 ${i < s.witnesses ? "bg-heat" : "bg-line"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </header>
      )}

      {s.phase === "play" && (
        <footer className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-md text-xs leading-relaxed text-mute">{s.log}</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="min-h-11 border border-cyan bg-cyan/10 px-4 font-sans text-xs tracking-[0.18em] text-cyan uppercase"
              onClick={() => {
                if (useTrick(stateRef.current)) sfx.trick();
                hud();
              }}
            >
              {host.trickLabel} · E
            </button>
          </div>
        </footer>
      )}

      {s.phase === "title" && (
        <Overlay>
          <p className="font-sans text-xs tracking-[0.4em] text-cyan">CONTINUITY PROTOCOL</p>
          <h1 className="mt-3 font-sans text-5xl font-extrabold tracking-[0.14em] sm:text-7xl">REMNANT</h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-mute">
            Wright Field, 1947. You are not a man. You wear machines. Leap before they stare. Get
            the signal into the radio or the jeep before dawn.
          </p>
          <ul className="mt-5 space-y-1 text-xs text-ink">
            <li>Tap a glowing object to inhabit it.</li>
            <li>Stay out of flashlight cones.</li>
            <li>Three witnesses, a pulled plug, or dawn — you lose.</li>
          </ul>
          <button
            type="button"
            className="mt-8 min-h-12 border border-cyan bg-cyan/15 px-6 font-sans text-sm tracking-[0.22em] text-cyan uppercase"
            onClick={start}
          >
            Enter the crate
          </button>
        </Overlay>
      )}

      {s.phase === "win" && (
        <Overlay>
          <p className="font-sans text-xs tracking-[0.3em] text-cyan">THE SIGNAL LEFT</p>
          <h1 className="mt-3 font-sans text-4xl font-bold tracking-[0.12em]">INVISIBLE THRONE</h1>
          <p className="mt-4 max-w-md text-sm text-mute">{s.log}</p>
          <button type="button" className="mt-8 min-h-12 border border-cyan px-6 font-sans text-sm tracking-[0.2em] text-cyan uppercase" onClick={reset}>
            Wake again
          </button>
        </Overlay>
      )}

      {s.phase === "lose" && (
        <Overlay>
          <p className="font-sans text-xs tracking-[0.3em] text-heat">
            {s.lose === "dawn" ? "DAYLIGHT" : s.lose === "unplug" ? "UNPLUGGED" : "THE WORD ALIVE"}
          </p>
          <h1 className="mt-3 font-sans text-4xl font-bold tracking-[0.12em]">WAREHOUSE</h1>
          <p className="mt-4 max-w-md text-sm text-mute">{s.log}</p>
          <button type="button" className="mt-8 min-h-12 border border-cyan px-6 font-sans text-sm tracking-[0.2em] text-cyan uppercase" onClick={reset}>
            The night again
          </button>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-gradient-to-t from-void via-void/85 to-void/30 p-8 sm:p-12">
      {children}
    </div>
  );
}

function Meter({
  label,
  value,
  warn,
  heat,
}: {
  label: string;
  value: number;
  warn?: boolean;
  heat?: boolean;
}) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="min-w-20 border border-line bg-panel/80 px-2 py-1.5">
      <div className={warn ? "text-heat" : ""}>{label}</div>
      <div className="mt-1 h-1 bg-line">
        <div
          className={`h-full ${heat || warn ? "bg-heat" : "bg-cyan"}`}
          style={{ width: `${v * 100}%` }}
        />
      </div>
    </div>
  );
}

declare global {
  interface Window {
    __inhabitTest?: {
      getPossessed: () => string;
      getPhase: () => string;
      leap: (id: string) => boolean;
      trick: () => boolean;
    };
  }
}
