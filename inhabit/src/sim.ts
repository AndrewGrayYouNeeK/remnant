import { MACHINES, makeHumans } from "./level";
import {
  DAWN_SECONDS,
  LEAP_RANGE,
  TRANSMIT_NEED,
  WITNESS_LIMIT,
  WORLD_H,
  WORLD_W,
  type GameState,
  type Human,
  type Machine,
  type Particle,
} from "./types";

export function machineById(id: string): Machine {
  const m = MACHINES.find((x) => x.id === id);
  if (!m) return MACHINES[0];
  return m;
}

export function fresh(): GameState {
  return {
    phase: "title",
    possessed: "crate",
    time: 0,
    winFill: 0,
    witnesses: 0,
    lose: null,
    beamOn: false,
    cutT: 0,
    shake: 0,
    humans: makeHumans(),
    unplugged: {},
    particles: [],
    log: "Wright Field. Night. You are in the crate.",
  };
}

function angDelta(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

export function inRange(fromId: string, toId: string) {
  const a = machineById(fromId);
  const b = machineById(toId);
  return dist(a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2) <= LEAP_RANGE + 8;
}

function center(m: Machine) {
  return { x: m.x + m.w / 2, y: m.y + m.h / 2 };
}

function sees(h: Human, m: Machine, cut: number, beamStun: boolean): boolean {
  const c = center(m);
  const dx = c.x - h.x;
  const dy = c.y - h.y;
  const d = Math.hypot(dx, dy);
  let range = h.range;
  if (cut > 0) range *= 0.42;
  if (beamStun && h.role === "guard") range *= 0.2;
  if (d > range) return false;
  const ang = Math.atan2(dy, dx);
  return Math.abs(angDelta(ang, h.facing)) < h.cone / 2;
}

function burst(s: GameState, x: number, y: number, n: number, cyan = true) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 120;
    s.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.35 + Math.random() * 0.35,
      max: 0.7,
    });
    void cyan;
  }
  if (s.particles.length > 80) s.particles.splice(0, s.particles.length - 80);
}

export function leapTo(s: GameState, id: string): boolean {
  if (s.phase !== "play") return false;
  if (id === s.possessed) return false;
  if (s.unplugged[id]) return false;
  if (!inRange(s.possessed, id)) return false;
  const a = center(machineById(s.possessed));
  const b = center(machineById(id));
  burst(s, a.x, a.y, 10);
  burst(s, b.x, b.y, 14);
  s.possessed = id;
  s.beamOn = false;
  s.shake = 0.18;
  s.log = `You wear the ${machineById(id).name.toLowerCase()}.`;
  return true;
}

export function useTrick(s: GameState): boolean {
  if (s.phase !== "play") return false;
  const m = machineById(s.possessed);
  if (m.trick === "none") return false;
  s.shake = 0.12;
  if (m.trick === "beam") {
    s.beamOn = !s.beamOn;
    s.log = s.beamOn ? "The hangar has one sun, and it is yours." : "Beam dies.";
    return true;
  }
  if (m.trick === "cut") {
    s.cutT = 9;
    s.log = "Lights fail. Men become slower animals.";
    return true;
  }
  if (m.trick === "hide") {
    s.log = "You make the object look like furniture.";
    return true;
  }
  if (m.trick === "distract") {
    const tech = s.humans.find((h) => h.role === "tech");
    if (tech) tech.investigating = s.possessed;
    s.log = `A noise from the ${m.name.toLowerCase()}. The tech turns.`;
    return true;
  }
  if (m.trick === "transmit") {
    s.log = "The century leans toward the antenna.";
    return true;
  }
  return false;
}

function moveHuman(h: Human, dt: number, s: GameState) {
  if (h.stunned > 0) {
    h.stunned -= dt;
    return;
  }
  let tx: number;
  let ty: number;
  if (h.investigating) {
    const t = machineById(h.investigating);
    tx = t.x + t.w / 2;
    ty = t.y + t.h / 2;
  } else {
    const p = h.path[h.pi % h.path.length];
    tx = p.x;
    ty = p.y;
  }
  const dx = tx - h.x;
  const dy = ty - h.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d < 12) {
    if (h.investigating) {
      const target = h.investigating;
      if (target === s.possessed) {
        s.unplugged[target] = true;
        s.lose = "unplug";
        s.phase = "lose";
        s.log = "A hand finds the plug.";
      }
      h.investigating = null;
      h.stare *= 0.3;
    } else {
      h.pi = (h.pi + 1) % h.path.length;
    }
    return;
  }
  h.x += (dx / d) * h.speed * dt;
  h.y += (dy / d) * h.speed * dt;
  h.facing = Math.atan2(dy, dx);
  h.x = Math.max(80, Math.min(WORLD_W - 80, h.x));
  h.y = Math.max(80, Math.min(WORLD_H - 40, h.y));
}

export function step(s: GameState, dt: number) {
  if (s.phase !== "play") return;
  s.time += dt;
  s.cutT = Math.max(0, s.cutT - dt);
  s.shake = Math.max(0, s.shake - dt * 1.8);

  const host = machineById(s.possessed);
  const hiding = host.trick === "hide";
  let seen = false;
  let guardStunned = false;

  if (s.beamOn) {
    const flood = machineById("flood");
    const fc = center(flood);
    for (const h of s.humans) {
      const ang = Math.atan2(h.y - fc.y, h.x - fc.x);
      const d = dist(h.x, h.y, fc.x, fc.y);
      if (d < 340 && Math.abs(angDelta(ang, -0.4)) < 0.55) {
        h.stunned = Math.max(h.stunned, 0.4);
        if (h.role === "guard") guardStunned = true;
      }
    }
  }

  for (const h of s.humans) {
    const looking = sees(h, host, s.cutT, guardStunned);
    if (looking) {
      seen = true;
      const rate = hiding ? 0.18 : 0.42;
      h.stare = Math.min(1, h.stare + rate * dt);
      if (h.stare > 0.55 && !h.investigating) h.investigating = s.possessed;
      if (h.stare >= 1 && !h.witnessed) {
        h.witnessed = true;
        s.witnesses += 1;
        s.log = `${h.role === "guard" ? "The MP" : h.role === "tech" ? "The technician" : "The colonel"} has seen the object breathe.`;
        s.shake = 0.3;
      }
    } else {
      h.stare = Math.max(0, h.stare - 0.12 * dt);
    }
    moveHuman(h, dt, s);
  }

  if (s.witnesses >= WITNESS_LIMIT) {
    s.phase = "lose";
    s.lose = "boxed";
    s.log = "Three witnesses. They will crate you in daylight.";
  }

  if (host.trick === "transmit") {
    const add = seen ? dt * 0.35 : dt;
    s.winFill += add;
    if (s.winFill >= TRANSMIT_NEED) {
      s.phase = "win";
      s.log = "The signal leaves the hangar. You are no longer only a crate.";
    }
  } else {
    s.winFill = Math.max(0, s.winFill - dt * 0.15);
  }

  if (s.time >= DAWN_SECONDS && s.phase === "play") {
    s.phase = "lose";
    s.lose = "dawn";
    s.log = "Dawn. They open what they kept.";
  }

  for (const p of s.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
  }
  s.particles = s.particles.filter((p) => p.life > 0);
}

export function pickMachineAt(wx: number, wy: number): Machine | null {
  let best: Machine | null = null;
  let bestD = 48;
  for (const m of MACHINES) {
    const c = center(m);
    const d = dist(wx, wy, c.x, c.y);
    const hit =
      wx >= m.x - 8 && wx <= m.x + m.w + 8 && wy >= m.y - 8 && wy <= m.y + m.h + 8;
    if (hit || d < bestD) {
      if (d < (hit ? 999 : bestD)) {
        best = m;
        bestD = d;
      }
    }
  }
  return best;
}
