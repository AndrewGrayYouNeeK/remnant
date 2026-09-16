export const WORLD_W = 1792;
export const WORLD_H = 1008;
export const LEAP_RANGE = 380;
export const DAWN_SECONDS = 165;
export const TRANSMIT_NEED = 5.2;
export const WITNESS_LIMIT = 3;

export type Trick = "none" | "distract" | "beam" | "transmit" | "hide" | "cut";
export type Role = "guard" | "tech" | "colonel";
export type Phase = "title" | "play" | "win" | "lose";
export type LoseKind = "boxed" | "unplug" | "dawn";

export type Machine = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sprite: string;
  trick: Trick;
  trickLabel: string;
  win?: boolean;
};

export type Human = {
  id: string;
  role: Role;
  x: number;
  y: number;
  facing: number;
  path: { x: number; y: number }[];
  pi: number;
  stare: number;
  stunned: number;
  investigating: string | null;
  witnessed: boolean;
  speed: number;
  range: number;
  cone: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
};

export type GameState = {
  phase: Phase;
  possessed: string;
  time: number;
  winFill: number;
  witnesses: number;
  lose: LoseKind | null;
  beamOn: boolean;
  cutT: number;
  shake: number;
  humans: Human[];
  unplugged: Record<string, boolean>;
  particles: Particle[];
  log: string;
};
