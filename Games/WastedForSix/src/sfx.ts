// The game's sound set (Nadav, 2026-11-17: only sounds made for this game; bump + near approved the same day).
// Everything else is silent here: the template's own kit (button tick/ok, stingers, win, whoosh...) is replaced by
// no-ops in this game only, so template screens play nothing and other games keep their sounds.
// Continuous driving sounds are in carsound.ts; music below.
import { sfx, tone, after, sfxOut, noiseBuffer, type MusicDef } from '@tsg/index';

// ---- building blocks: everything goes to the template's sfx output (sfxOut), so it shares the master volume ----
// Pitch / timing jitter uses Math.random, not the seeded rand(): sounds must not shift the gameplay stream.
const jit = (v: number, p = 0.04): number => v * (1 + (Math.random() * 2 - 1) * p);
interface Voice { type?: OscillatorType; f: number; to?: number; d: number; g: number; lp?: number; at?: number; delay?: number }
/** One oscillator through a low-pass, with a fast attack and an exponential tail. `to` slides the pitch. */
function voice(v: Voice): void {
  const out = sfxOut(), c = out.context, t0 = c.currentTime + (v.delay ?? 0);
  const os = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
  os.type = v.type ?? 'sine'; os.frequency.setValueAtTime(v.f, t0);
  if (v.to) os.frequency.exponentialRampToValueAtTime(Math.max(20, v.to), t0 + v.d);
  fl.type = 'lowpass'; fl.frequency.value = v.lp ?? 12000;
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v.g, t0 + (v.at ?? 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + v.d);
  os.connect(fl); fl.connect(g); g.connect(out); os.start(t0); os.stop(t0 + v.d + 0.05);
}
interface Burst { d: number; g: number; f: number; q?: number; kind?: BiquadFilterType; delay?: number; at?: number; sweep?: number }
/** Filtered white noise (band/high/low-pass), for clicks, sprays, crunches and glass. `sweep` glides the filter. */
function burst(b: Burst): void {
  const out = sfxOut(), c = out.context, t0 = c.currentTime + (b.delay ?? 0);
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuffer(); fl.type = b.kind ?? 'bandpass'; fl.frequency.setValueAtTime(b.f, t0); fl.Q.value = b.q ?? 1;
  if (b.sweep) fl.frequency.exponentialRampToValueAtTime(b.sweep, t0 + b.d);
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(b.g, t0 + (b.at ?? 0.003)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + b.d);
  s.connect(fl); fl.connect(g); g.connect(out); s.start(t0, Math.random() * 1.5); s.stop(t0 + b.d + 0.05);
}
/** Electric-piano note (sine + soft octave + a little bell on top), the tracks' Rhodes colour. */
function keys(f: number, d: number, g: number, delay = 0): void {
  voice({ f, d, g, delay, at: 0.006 });
  voice({ f: f * 2, d: d * 0.6, g: g * 0.3, delay, type: 'triangle', lp: 3000 });
  voice({ f: f * 4, d: 0.12, g: g * 0.12, delay });
}
// F minor, the key of the drive / chase / scheme loops: F3 Ab3 C4 Eb4 G4 F4 Ab4 C5 Eb5 F5
const N = { F3: 174.6, Ab3: 207.7, C4: 261.6, Eb4: 311.1, F4: 349.2, G4: 392, Ab4: 415.3, C5: 523.3, Eb5: 622.3, F5: 698.5, C6: 1046.5 };

const OURS = {
  // dashboard low-fuel chime: two falling dings, played once when the tank drops under 30%
  fuelLow: () => { [0, 260].forEach((ms) => after(ms, () => { tone(1046, 0.16, 'triangle', 0.07); tone(784, 0.22, 'triangle', 0.05); })); },

  // ---- pickups ----
  /** Cash: a register "cha-ching": drawer clunk + two bright bell hits. */
  cash: () => {
    burst({ d: 0.07, g: 0.12, f: 900, q: 0.8 });
    voice({ f: 2093, d: 0.5, g: 0.05, delay: 0.06 }); voice({ f: 3136, d: 0.35, g: 0.025, delay: 0.06 });
    voice({ f: 2637, d: 0.6, g: 0.05, delay: 0.16 }); voice({ f: 3951, d: 0.4, g: 0.022, delay: 0.16 });
  },
  /** Can: a soda can grabbed: a hollow metal "tink" and a fizz. */
  can: () => {
    const f = jit(1480, 0.06);
    voice({ f, d: 0.18, g: 0.06 }); voice({ f: f * 2.76, d: 0.09, g: 0.025 });
    burst({ d: 0.22, g: 0.03, f: 6500, kind: 'highpass', delay: 0.03, at: 0.02 });
  },
  /** Graffiti letter: a spray-can "pssht" and a funky three-note Rhodes lick (F – Ab – C) in the tracks' key. */
  letter: () => {
    burst({ d: 0.28, g: 0.07, f: 4200, q: 1.5, at: 0.02, sweep: 5200 });
    keys(N.F4, 0.35, 0.06, 0.12); keys(N.Ab4, 0.35, 0.06, 0.2); keys(N.C5, 0.6, 0.07, 0.28);
  },

  // ---- driving ----
  /** Crash: a low body thump, a metal crunch and a few glass bits. */
  crash: () => {
    voice({ f: 110, to: 38, d: 0.35, g: 0.22 });
    burst({ d: 0.22, g: 0.2, f: 1100, kind: 'lowpass', sweep: 300 });
    burst({ d: 0.12, g: 0.07, f: 2400, q: 3, delay: 0.02 });
    for (let i = 0; i < 4; i++) voice({ f: jit(3800 + i * 900, 0.1), d: 0.09, g: 0.018, delay: 0.05 + i * 0.035 + Math.random() * 0.02 });
  },
  /** Bump (k 0..1): touching a wall or nudging traffic, not a crash: a short dull thud. */
  bump: (k = 1) => { voice({ f: jit(125, 0.06), to: 60, d: 0.13, g: 0.13 * k }); burst({ d: 0.08, g: 0.1 * k, f: 420, kind: 'lowpass' }); },
  /** Running someone over: a soft body thud on the bonnet and a cartoon yelp that flies off upward. */
  ped: () => { voice({ f: jit(150, 0.08), to: 70, d: 0.12, g: 0.16 }); burst({ d: 0.07, g: 0.09, f: 500, kind: 'lowpass' }); voice({ type: 'triangle', f: jit(620, 0.12), to: 1250, d: 0.16, g: 0.05, delay: 0.03, lp: 3000 }); },
  /** Drift boost (k 0..1): the engine kicks: a rising whoosh over a low punch. */
  boost: (k = 1) => { voice({ type: 'sawtooth', f: 90, to: 260, d: 0.3, g: 0.07 * (0.6 + 0.4 * k), lp: 1400 }); burst({ d: 0.3, g: 0.07, f: 700, q: 1.2, at: 0.05, sweep: 3600 }); },
  /** Radio: a blip of static between stations, then a click as it locks. */
  radio: () => { burst({ d: 0.12, g: 0.06, f: 2600, q: 0.8, sweep: 5200 }); voice({ f: 1400, d: 0.04, g: 0.04, delay: 0.11 }); },
  /** Near miss: a car whips past (noise swept up and back down). */
  near: () => { burst({ d: 0.13, g: 0.08, f: 600, q: 1.4, at: 0.07, sweep: 3200 }); burst({ d: 0.2, g: 0.06, f: 3000, q: 1.4, delay: 0.1, sweep: 450 }); },

  // ---- WASTED ----
  /** Fail: a heavy impact, then the F-minor chord sinking like a tape stopping. */
  wasted: () => {
    voice({ f: 70, to: 30, d: 0.9, g: 0.26 });
    burst({ d: 0.5, g: 0.14, f: 800, kind: 'lowpass', sweep: 120 });
    for (const f of [N.F3, N.Ab3, N.C4, N.F4]) {
      voice({ type: 'sawtooth', f, to: f * 0.5, d: 1.5, g: 0.035, lp: 1400, at: 0.03, delay: 0.12 });
      voice({ type: 'sawtooth', f: f * 1.006, to: f * 0.5, d: 1.5, g: 0.03, lp: 1400, at: 0.03, delay: 0.12 });
    }
  },

  /** ITEM ACQUIRED: a rising Rhodes fanfare (F – Ab – C – F), a held F-minor chord and a sparkle on top. */
  item: () => {
    [N.F4, N.Ab4, N.C5, N.F5].forEach((f, i) => keys(f, 0.3, 0.06, i * 0.09));
    for (const f of [N.F3, N.C4, N.F4, N.Ab4, N.C5]) keys(f, 1.4, 0.04, 0.4);
    [N.C6, N.F5 * 2, N.C6 * 2].forEach((f, i) => voice({ f, d: 0.35, g: 0.03, delay: 0.5 + i * 0.08 }));
  },

  // ---- buttons (the template's screens call tick / ok; the gray scenes call choose) ----
  /** Soft woody click for buttons. */
  tick: () => { voice({ f: jit(1250, 0.03), d: 0.05, g: 0.05 }); burst({ d: 0.02, g: 0.05, f: 3000, q: 2 }); },
  /** Confirm: a two-note Rhodes step up (C → F). */
  ok: () => { keys(N.C5, 0.25, 0.05); keys(N.F5, 0.4, 0.055, 0.08); },
  /** Picking an option in the boss / clerk scene: a click and a low Rhodes note. */
  choose: () => { voice({ f: 1100, d: 0.04, g: 0.04 }); keys(N.C4, 0.3, 0.06, 0.02); },

  // ---- password (the PC) ----
  /** Mechanical keyboard key: a clack and a low thock, slightly different every press. */
  type: () => { burst({ d: 0.035, g: 0.09, f: jit(3200, 0.1), q: 1.2 }); voice({ f: jit(170, 0.08), to: 120, d: 0.05, g: 0.07 }); },
  /** Backspace: a lighter clack with a small downward blip. */
  erase: () => { burst({ d: 0.03, g: 0.06, f: 2600, q: 1.2 }); voice({ f: 700, to: 420, d: 0.07, g: 0.03 }); },
  /** Wrong password: a short, low double "nuh-uh". */
  pwWrong: () => {
    voice({ type: 'square', f: 196, d: 0.13, g: 0.05, lp: 900 });
    voice({ type: 'square', f: 147, d: 0.22, g: 0.05, lp: 900, delay: 0.15 });
  },
  /** Right password: an unlock click, a fat F-minor-9 Rhodes stab and a rising sparkle. */
  pwRight: () => {
    burst({ d: 0.04, g: 0.08, f: 1800, q: 2 }); voice({ f: 900, to: 1800, d: 0.06, g: 0.04 });
    for (const f of [N.F3, N.Ab3, N.C4, N.Eb4, N.G4]) keys(f, 1.1, 0.045, 0.08);
    [N.C5, N.Eb5, N.F5, N.C6].forEach((f, i) => voice({ f, d: 0.3, g: 0.03, delay: 0.3 + i * 0.07 }));
  },
};
for (const k of Object.keys(sfx)) delete sfx[k];
Object.assign(sfx, OURS);
// debug (CLAUDE.md): __sfx() lists the sounds, __sfx(name) plays one
(window as unknown as Record<string, unknown>).__sfx = (name?: string) => (name ? (sfx[name]!(), name) : Object.keys(sfx));

/** Four looped G-funk tracks made with ACE-Step (DECISIONS 74), ~215 KB each, loaded after the first frame:
 *  theme = title / cutscene / PRESS START / result · drive = commute + launch legs · chase = the home leg ·
 *  scheme = boss, clerk and the password. Which candidate, prompt + seed: music/chosen.json (/make-music). */
export const MUSIC: Partial<MusicDef> = {
  files: {
    theme: 'assets/audio/theme.mp3', drive: 'assets/audio/drive.mp3', chase: 'assets/audio/chase.mp3', scheme: 'assets/audio/scheme.mp3',
    // radio-only stations (content.ts RADIO), 40 kbps to keep all audio under 1.5 MB (music/chosen.json)
    midnight: 'assets/audio/midnight.mp3', bounce: 'assets/audio/bounce.mp3', jazzy: 'assets/audio/jazzy.mp3', electro: 'assets/audio/electro.mp3',
  },
  volume: { theme: 0.34, drive: 0.36, chase: 0.38, scheme: 0.3, midnight: 0.38, bounce: 0.34, jazzy: 0.32, electro: 0.36 },
};
