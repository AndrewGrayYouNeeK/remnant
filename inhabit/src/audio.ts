let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  return ctx;
}

export function unlockAudio() {
  const c = ac();
  if (!c) return;
  void c.resume();
}

function beep(freq: number, dur: number, type: OscillatorType, vol: number) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g);
  g.connect(c.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.stop(c.currentTime + dur);
}

export const sfx = {
  leap: () => beep(240 + Math.random() * 80, 0.09, "triangle", 0.05),
  trick: () => beep(420, 0.14, "sawtooth", 0.04),
  warn: () => beep(140, 0.2, "square", 0.05),
  lose: () => beep(90, 0.5, "sine", 0.06),
  win: () => {
    beep(520, 0.18, "triangle", 0.05);
    setTimeout(() => beep(780, 0.28, "triangle", 0.05), 140);
  },
};
