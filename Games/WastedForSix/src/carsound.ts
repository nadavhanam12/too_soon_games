// Continuous car sounds for the driving legs, all synth (0 KB): engine (pitch follows speed through four arcade
// "gears", louder on throttle), tire squeal while drifting, a scrape while sliding along a wall, and the HR minivan's
// proximity beeper (sick branch before the doctor's note: it speeds up as the minivan gets close).
// drive.ts calls carSound() once per world step. When nobody calls it (gray scenes, lose screen) a watchdog fades
// everything out, so no stage has to remember to stop the engine.
import { tone, sfxOut, noiseBuffer } from '@tsg/index';

export interface CarState { v: number; vx: number; vy: number; a: number }
const MAX_V = 46;           // drive.ts top speed (u/s); only used to scale the sound
const SLIP_ON = 8;          // lateral speed where the squeal starts (same threshold as the drift smoke in drive.ts)
const IDLE_G = 0.01, ENGINE_G = 0.028;   // engine halved 2026-11-17 (was 0.022 / 0.06)
const SKID_G = 0.07, SCRAPE_G = 0.09;
const HR_NEAR = 75;         // HR beeper range beyond its red circle (u), same falloff as the HUD heat

interface Nodes { engA: OscillatorNode; engB: OscillatorNode; engF: BiquadFilterNode; engV: GainNode; skidV: GainNode; scrV: GainNode }
let N: Nodes | null = null;
let lastCall = 0, prevV = 0, thr = 0, scrape = 0, beepT = 0;

function build(): Nodes {
  const out = sfxOut(), c = out.context as AudioContext;
  const engF = c.createBiquadFilter(); engF.type = 'lowpass'; engF.frequency.value = 400; engF.Q.value = 3;
  const engV = c.createGain(); engV.gain.value = 0;
  const engA = c.createOscillator(); engA.type = 'sawtooth';
  const engB = c.createOscillator(); engB.type = 'square';
  engA.connect(engF); engB.connect(engF); engF.connect(engV); engV.connect(out);
  const noiseBand = (freq: number, q: number): GainNode => {
    const s = c.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const v = c.createGain(); v.gain.value = 0;
    s.connect(f); f.connect(v); v.connect(out); s.start();
    return v;
  };
  const skidV = noiseBand(2200, 4), scrV = noiseBand(700, 1.2);
  engA.start(); engB.start();
  // watchdog: the driving legs stopped calling us → fade out (no stage has to stop the engine explicitly)
  window.setInterval(() => {
    if (!N || performance.now() - lastCall < 200) return;
    const t = c.currentTime;
    for (const g of [N.engV, N.skidV, N.scrV]) g.gain.setTargetAtTime(0, t, 0.08);
  }, 150);
  return { engA, engB, engF, engV, skidV, scrV };
}

/** One world step. `hr` = the HR minivan's distance beyond its sight radius, or null when it cannot fire you. */
export function carSound(dt: number, p: CarState, hr: number | null, squeal = 0): void {
  if (!N) N = build();
  lastCall = performance.now();
  const c = sfxOut().context, t = c.currentTime;
  const s = Math.min(1, Math.abs(p.v) / MAX_V);
  // throttle estimate from acceleration (stepPlayer keeps the input to itself): rising speed = on the gas
  const acc = dt > 0 ? (Math.abs(p.v) - Math.abs(prevV)) / dt : 0;
  prevV = p.v;
  // at top speed there is no acceleration left, but holding speed there means the gas is down (coasting loses ~30 u/s²)
  const onGas = acc > 4 || (s > 0.95 && acc > -3);
  thr += ((onGas ? 1 : 0) - thr) * Math.min(1, dt * 6);
  // four arcade gears: pitch climbs inside a gear, drops a little at each shift
  const g4 = Math.min(3.999, s * 4), gear = Math.floor(g4), inGear = g4 - gear;
  const f = 42 + gear * 14 + inGear * 58;
  N.engA.frequency.setTargetAtTime(f, t, 0.05);
  N.engB.frequency.setTargetAtTime(f * 0.5, t, 0.05);
  N.engF.frequency.setTargetAtTime(280 + s * 900 + thr * 700, t, 0.08);
  N.engV.gain.setTargetAtTime(IDLE_G + (ENGINE_G - IDLE_G) * (0.35 * s + 0.65 * thr * (0.4 + 0.6 * s)), t, 0.08);
  // drift squeal from sideways speed
  const fx = Math.cos(p.a), fy = Math.sin(p.a);
  const slip = Math.abs(p.vx * fy - p.vy * fx);
  // `squeal` (0..1) is the tires without a slide: hard braking, wheelspin off the line (drive.ts decides)
  N.skidV.gain.setTargetAtTime(SKID_G * Math.max(squeal, Math.min(1, Math.max(0, (slip - SLIP_ON) / 10))), t, 0.05);
  // wall scrape: wallGraze() kicks it, it dies away in ~0.2 s
  scrape *= Math.exp(-dt * 10);
  N.scrV.gain.setTargetAtTime(SCRAPE_G * scrape, t, 0.03);
  // HR beeper: 1 beep/s at the edge of its range → 8/s at the red circle
  if (hr !== null && hr < HR_NEAR) {
    beepT -= dt;
    if (beepT <= 0) {
      const k = 1 - Math.max(0, hr) / HR_NEAR;
      beepT = 1 - 0.875 * k;
      tone(1320 + k * 440, 0.06, 'sine', 0.035 + 0.03 * k);
    }
  } else beepT = 0;
}

// debug (CLAUDE.md): live levels, read by the browser check
(window as unknown as Record<string, unknown>).__carSound = () => (N ? {
  engine: +N.engV.gain.value.toFixed(3), hz: Math.round(N.engA.frequency.value), cutoff: Math.round(N.engF.frequency.value),
  skid: +N.skidV.gain.value.toFixed(3), scrape: +N.scrV.gain.value.toFixed(3), ctx: N.engV.context.state,
} : null);

/** drive.ts: the car is sliding along a wall at `speed` u/s (called every step while it touches). */
export function wallGraze(speed: number): void { scrape = Math.max(scrape, Math.min(1, Math.abs(speed) / 30)); }
