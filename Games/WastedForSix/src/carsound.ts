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

interface Nodes {
  engA: OscillatorNode; engB: OscillatorNode; engF: BiquadFilterNode; engV: GainNode; skidV: GainNode; scrV: GainNode;
  sirLfo: OscillatorNode; sirF: BiquadFilterNode; sirV: GainNode;
  heliLfo: OscillatorNode; heliF: BiquadFilterNode; heliV: GainNode;
}
// police siren (copSiren): a US-style wail that turns into a fast yelp when the cop is right behind you
const SIREN_G = 0.05;        // at the bumper; fades out over SIREN_FAR
const SIREN_FAR = 220;       // u: beyond this the siren is silent (the cop spawns ~95 u behind: must be heard)
const SIREN_YELP = 35;       // u: closer than this the wail speeds up into a yelp
const WAIL_HZ = 0.42, YELP_HZ = 3.4;   // sweeps per second
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
  // siren: two slightly detuned horns sweeping 650 ↔ 1500 Hz (a triangle LFO on their pitch), a horn-like band-pass,
  // then a low-pass that muffles it with distance
  const sirLfo = c.createOscillator(); sirLfo.type = 'triangle'; sirLfo.frequency.value = WAIL_HZ;
  const sirDepth = c.createGain(); sirDepth.gain.value = 425; sirLfo.connect(sirDepth);
  const sirBand = c.createBiquadFilter(); sirBand.type = 'bandpass'; sirBand.frequency.value = 1100; sirBand.Q.value = 1.4;
  const sirF = c.createBiquadFilter(); sirF.type = 'lowpass'; sirF.frequency.value = 1500;
  const sirV = c.createGain(); sirV.gain.value = 0;
  for (const [type, cents] of [['sawtooth', 0], ['square', 14]] as const) {
    const o = c.createOscillator(); o.type = type; o.frequency.value = 1075; o.detune.value = cents;
    sirDepth.connect(o.frequency); o.connect(sirBand); o.start();
  }
  sirBand.connect(sirF); sirF.connect(sirV); sirV.connect(out); sirLfo.start();
  // watchdog: the driving legs stopped calling us → fade out (no stage has to stop the engine explicitly)
  window.setInterval(() => {
    if (!N || performance.now() - lastCall < 200) return;
    const t = c.currentTime;
    for (const g of [N.engV, N.skidV, N.scrV, N.sirV, N.heliV]) g.gain.setTargetAtTime(0, t, 0.08);
  }, 150);
  // helicopter rotor: soft low noise pulsed at the blade rate ("whup-whup") plus a quiet low hum, under one gain
  const heliV = c.createGain(); heliV.gain.value = 0;
  const heliF = c.createBiquadFilter(); heliF.type = 'lowpass'; heliF.frequency.value = 500; heliF.Q.value = 0.7;
  const heliMod = c.createGain(); heliMod.gain.value = 0.55;           // pulse depth rides on this base level
  const heliN = c.createBufferSource(); heliN.buffer = noiseBuffer(); heliN.loop = true;
  heliN.connect(heliF); heliF.connect(heliMod); heliMod.connect(heliV);
  const heliLfo = c.createOscillator(); heliLfo.type = 'sine'; heliLfo.frequency.value = HELI_BLADE_HZ;
  const heliDepth = c.createGain(); heliDepth.gain.value = 0.45; heliLfo.connect(heliDepth); heliDepth.connect(heliMod.gain);
  const heliHum = c.createOscillator(); heliHum.type = 'sine'; heliHum.frequency.value = 58;
  const heliHumV = c.createGain(); heliHumV.gain.value = 0.35; heliHum.connect(heliHumV); heliHumV.connect(heliV);
  heliV.connect(out); heliN.start(); heliLfo.start(); heliHum.start();
  return { engA, engB, engF, engV, skidV, scrV, sirLfo, sirF, sirV, heliLfo, heliF, heliV };
}

// police helicopter (heliSound): gentle on purpose, it is background atmosphere, not an alarm
const HELI_G = 0.03;         // right overhead: about the engine's level at full gas (ENGINE_G), so it never covers the car
const HELI_HEAR = 110;       // u: silent beyond this (drive.ts HELI_FAR, where it appears and leaves)
const HELI_BLADE_HZ = 11;    // blade pulses per second

/** One world step of the helicopter. `heli` = its distance from you, or null when none is over the city. */
export function heliSound(heli: number | null): void {
  if (!N) N = build();
  const t = sfxOut().context.currentTime;
  const near = heli === null ? 0 : Math.min(1, Math.max(0, 1 - heli / HELI_HEAR));
  N.heliV.gain.setTargetAtTime(HELI_G * near * near, t, 0.3);           // squared: fades in slowly from far away
  N.heliF.frequency.setTargetAtTime(260 + near * 520, t, 0.3);          // duller far away
  N.heliLfo.frequency.setTargetAtTime(HELI_BLADE_HZ * (0.94 + 0.08 * near), t, 0.5);
}

/** One world step of the police siren. `cop` = distance to the nearest chasing cop, or null / Infinity for none. */
export function copSiren(cop: number | null): void {
  if (!N) N = build();
  const t = sfxOut().context.currentTime;
  const near = cop !== null && Number.isFinite(cop) ? Math.min(1, Math.max(0, 1 - (cop - 10) / SIREN_FAR)) : 0;
  N.sirV.gain.setTargetAtTime(SIREN_G * Math.pow(near, 1.2), t, 0.15);
  N.sirF.frequency.setTargetAtTime(900 + near * 3600, t, 0.15);
  N.sirLfo.frequency.setTargetAtTime(cop !== null && cop < SIREN_YELP ? YELP_HZ : WAIL_HZ, t, 0.3);
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
  skid: +N.skidV.gain.value.toFixed(3), scrape: +N.scrV.gain.value.toFixed(3),
  siren: +N.sirV.gain.value.toFixed(3), sirenSweepsPerS: +N.sirLfo.frequency.value.toFixed(2), heli: +N.heliV.gain.value.toFixed(3), ctx: N.engV.context.state,
} : null);

/** drive.ts: the car is sliding along a wall at `speed` u/s (called every step while it touches). */
export function wallGraze(speed: number): void { scrape = Math.max(scrape, Math.min(1, Math.abs(speed) / 30)); }
