// Synth-only audio (no files): one-shot sfx + a step-sequencer music loop. Ported from FallingCEO.
// Everything waits for the first pointerdown (AudioContext resume). `M` toggles music.
import { rnd } from '../draw/prims';

let AC: AudioContext | null = null;
let MASTER: GainNode | null = null;
let NOISE: AudioBuffer | null = null;

export function ac(): AudioContext {
  if (AC) return AC;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  AC = new Ctor();
  MASTER = AC.createGain(); MASTER.gain.value = 0.8; MASTER.connect(AC.destination);
  const b = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  NOISE = b;
  return AC;
}
export function unlockAudio(): void {
  window.addEventListener('pointerdown', () => { try { ac().resume(); } catch { /* ignore */ } }, { once: true });
}
const vary = (v: number, p = 0.05): number => v * (1 + rnd(-p, p));

export function tone(f: number, d: number, type: OscillatorType = 'square', g = 0.06, o: { slide?: number } = {}): void {
  try {
    const c = ac(), t0 = c.currentTime, os = c.createOscillator(), v = c.createGain();
    os.type = type; os.frequency.setValueAtTime(vary(f), t0);
    if (o.slide) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + d);
    v.gain.setValueAtTime(0.0001, t0); v.gain.linearRampToValueAtTime(g, t0 + 0.005); v.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    os.connect(v); v.connect(MASTER!); os.start(t0); os.stop(t0 + d + 0.03);
  } catch { /* no audio */ }
}
export function noise(d: number, g = 0.1, lp = 2000): void {
  try {
    const c = ac(), t0 = c.currentTime, s = c.createBufferSource(), v = c.createGain(), f = c.createBiquadFilter();
    s.buffer = NOISE; s.loop = true; f.type = 'lowpass'; f.frequency.value = lp;
    v.gain.setValueAtTime(0.0001, t0); v.gain.linearRampToValueAtTime(g, t0 + 0.005); v.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(v); v.connect(MASTER!); s.start(t0); s.stop(t0 + d + 0.03);
  } catch { /* no audio */ }
}
export const after = (ms: number, fn: () => void): number => window.setTimeout(fn, ms);

/** A base kit every game gets; games add their own with `Object.assign(sfx, {...})`. */
export const sfx: Record<string, (...a: any[]) => void> = {
  tick: () => tone(900, 0.04, 'square', 0.03),
  ok: () => { tone(660, 0.08, 'square', 0.05); after(70, () => tone(990, 0.12, 'square', 0.05)); },
  bad: () => { tone(220, 0.18, 'sawtooth', 0.07, { slide: 90 }); },
  boing: (k = 1) => { tone(180 * k, 0.18, 'triangle', 0.09, { slide: 520 * k }); noise(0.05, 0.05, 900); },
  crack: () => { noise(0.14, 0.16, 1400); tone(140, 0.12, 'sawtooth', 0.06, { slide: 50 }); },
  flash: () => { noise(0.06, 0.08, 6000); tone(1800, 0.05, 'sine', 0.03); },
  thud: () => { noise(0.3, 0.22, 300); tone(70, 0.35, 'sine', 0.18, { slide: 30 }); },
  stamp: () => { noise(0.12, 0.25, 500); tone(110, 0.2, 'square', 0.1, { slide: 60 }); after(90, () => noise(0.08, 0.1, 2500)); },
  sad: () => { [330, 290, 250, 200].forEach((f, i) => after(i * 170, () => tone(f, 0.22, 'triangle', 0.07))); },
  hurt: () => tone(260, 0.2, 'sawtooth', 0.07, { slide: 90 }),
  win: () => { [523, 659, 784, 1047].forEach((f, i) => after(i * 90, () => tone(f, 0.25, 'square', 0.05))); },
  whoosh: () => {
    try {
      const c = ac(), t0 = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), v = c.createGain();
      s.buffer = NOISE; s.loop = true; f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(4000, t0 + 0.22); f.frequency.exponentialRampToValueAtTime(500, t0 + 0.45);
      v.gain.setValueAtTime(0.0001, t0); v.gain.linearRampToValueAtTime(0.16, t0 + 0.12); v.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      s.connect(f); f.connect(v); v.connect(MASTER!); s.start(t0); s.stop(t0 + 0.55);
    } catch { /* no audio */ }
  },
  ping: () => { [880, 1320, 1760].forEach((f, i) => after(i * 60, () => tone(f, 0.9, 'sine', 0.05))); tone(220, 1.2, 'triangle', 0.05); },
  riser: (d = 1.2) => {
    try {
      const c = ac(), t0 = c.currentTime, os = c.createOscillator(), v = c.createGain(), f = c.createBiquadFilter();
      os.type = 'sawtooth'; os.frequency.setValueAtTime(80, t0); os.frequency.exponentialRampToValueAtTime(640, t0 + d);
      f.type = 'lowpass'; f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(5000, t0 + d);
      v.gain.setValueAtTime(0.0001, t0); v.gain.linearRampToValueAtTime(0.07, t0 + d * 0.9); v.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.1);
      os.connect(f); f.connect(v); v.connect(MASTER!); os.start(t0); os.stop(t0 + d + 0.15);
    } catch { /* no audio */ }
  },
  news: () => {
    try {
      const c = ac(), t0 = c.currentTime;
      const sw = c.createBufferSource(), sf = c.createBiquadFilter(), sv = c.createGain();
      sw.buffer = NOISE; sw.loop = true; sf.type = 'bandpass'; sf.Q.value = 1.5; sf.frequency.setValueAtTime(600, t0); sf.frequency.exponentialRampToValueAtTime(5000, t0 + 0.1);
      sv.gain.setValueAtTime(0.12, t0); sv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      sw.connect(sf); sf.connect(sv); sv.connect(MASTER!); sw.start(t0); sw.stop(t0 + 0.2);
      const stab = (t: number, fs: number[], d: number, g: number) => fs.forEach((f) => [-9, 9].forEach((dt) => {
        const o = c.createOscillator(), fl = c.createBiquadFilter(), v = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; fl.type = 'lowpass';
        fl.frequency.setValueAtTime(2600, t); fl.frequency.exponentialRampToValueAtTime(500, t + d);
        v.gain.setValueAtTime(0.0001, t); v.gain.linearRampToValueAtTime(g, t + 0.008); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(fl); fl.connect(v); v.connect(MASTER!); o.start(t); o.stop(t + d + 0.05);
      }));
      stab(t0 + 0.08, [220, 277, 330], 0.16, 0.035); stab(t0 + 0.26, [196, 247, 294], 0.3, 0.035);
      const sub = c.createOscillator(), subv = c.createGain();
      sub.type = 'sine'; sub.frequency.setValueAtTime(55, t0 + 0.26);
      subv.gain.setValueAtTime(0.0001, t0 + 0.26); subv.gain.linearRampToValueAtTime(0.2, t0 + 0.27); subv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      sub.connect(subv); subv.connect(MASTER!); sub.start(t0 + 0.26); sub.stop(t0 + 0.65);
    } catch { /* no audio */ }
  },
};
sfx.logo = () => { sfx.whoosh!(); after(140, () => sfx.ping!()); };

// ---------- music: step sequencer ----------
export type MusicMode = 'off' | 'calm' | 'play';
export interface MusicDef { bpm: number; prog: Array<[number, number[]]> } // [root midi, chord tones]

const DEFAULT_MUSIC: MusicDef = { bpm: 126, prog: [[57, [57, 60, 64, 67]], [53, [53, 57, 60, 65]], [48, [48, 52, 55, 60]], [55, [55, 59, 62, 67]]] };

export const music = {
  on: true, mode: 'off' as MusicMode, def: DEFAULT_MUSIC, step: 0, next: 0, timer: 0 as number, bus: null as GainNode | null,
  hz: (n: number) => 440 * Math.pow(2, (n - 69) / 12),
  configure(def: Partial<MusicDef>) { this.def = { ...DEFAULT_MUSIC, ...def }; },
  set(mode: MusicMode) { if (mode === this.mode) return; this.mode = mode; if (mode === 'off') this.stop(); else this.start(); },
  start() {
    if (this.timer) return;
    try {
      const c = ac();
      if (!this.bus) { this.bus = c.createGain(); this.bus.gain.value = this.on ? 0.5 : 0; this.bus.connect(MASTER!); }
      this.step = 0; this.next = c.currentTime + 0.05; this.timer = window.setInterval(() => this.tick(), 90);
    } catch { /* no audio */ }
  },
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = 0; } },
  toggle(): boolean { this.on = !this.on; if (this.bus) this.bus.gain.value = this.on ? 0.5 : 0; return this.on; },
  tick() {
    const c = AC; if (!c || c.state !== 'running' || !this.on) return;
    const sd = 60 / this.def.bpm / 4;
    while (this.next < c.currentTime + 0.25) { this.play(this.step, this.next, sd); this.step = (this.step + 1) % 64; this.next += sd; }
  },
  osc(type: OscillatorType, f: number, t0: number, d: number, g: number, o: { det?: number; slide?: number; lp?: number; a?: number } = {}) {
    const c = AC!, os = c.createOscillator(), v = c.createGain();
    os.type = type; os.frequency.setValueAtTime(f, t0); if (o.det) os.detune.value = o.det; if (o.slide) os.frequency.exponentialRampToValueAtTime(o.slide, t0 + d);
    if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; os.connect(fl); fl.connect(v); } else os.connect(v);
    v.gain.setValueAtTime(0.0001, t0); v.gain.linearRampToValueAtTime(g, t0 + (o.a || 0.01)); v.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    v.connect(this.bus!); os.start(t0); os.stop(t0 + d + 0.05);
  },
  nz(t0: number, d: number, g: number, hp: number) {
    const c = AC!, s = c.createBufferSource(), f = c.createBiquadFilter(), v = c.createGain();
    s.buffer = NOISE; s.loop = true; f.type = 'highpass'; f.frequency.value = hp;
    v.gain.setValueAtTime(g, t0); v.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f); f.connect(v); v.connect(this.bus!); s.start(t0); s.stop(t0 + d + 0.03);
  },
  play(i: number, t: number, sd: number) {
    const bar = Math.floor(i / 16) % this.def.prog.length, s16 = i % 16, entry = this.def.prog[bar]!;
    const [root, ch] = entry, full = this.mode === 'play', calm = this.mode === 'calm';
    if (s16 === 0) { const g = calm ? 0.045 : 0.035; ch.forEach((n) => { this.osc('sawtooth', this.hz(n), t, sd * 16, g, { det: -7, lp: 900, a: 0.4 }); this.osc('sawtooth', this.hz(n), t, sd * 16, g, { det: 7, lp: 900, a: 0.4 }); }); }
    const an = (ch[(s16 * 5) % ch.length] ?? root) + (s16 % 8 < 4 ? 12 : 24);
    this.osc('triangle', this.hz(an), t, sd * 1.6, calm ? 0.05 : 0.06, { lp: 4000 });
    if (!full) return;
    if (s16 % 2 === 0) this.osc('sawtooth', this.hz(root - 12), t, sd * 1.8, 0.16, { lp: 380 });
    if (s16 % 4 === 0) this.osc('sine', 150, t, 0.22, 0.5, { slide: 38 });
    if (s16 === 4 || s16 === 12) this.nz(t, 0.12, 0.18, 1500);
    if (s16 % 4 === 2) this.nz(t, 0.05, 0.08, 7000);
  },
};
