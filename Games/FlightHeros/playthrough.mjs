// FlightHeros ("Not On My Flight"): the story arc (RULES 2א) and the bot the bug check plays it with (RULES 21ב,
// DECISIONS 69). Not part of the build. The bot only presses keys and reads __world / __peek; forceLose is used only
// to test the lose screen's "retry from the stage".

export const arc = {
  start: 'A family flight home; a passenger stabs the captain and the plane starts to lose altitude',
  stages: [
    { id: 'run', beat: 'Run down the aisle to the cockpit, dodging falling suitcases and panicking passengers' },
    { id: 'door', beat: 'Push the trolley aside and crack the cockpit door, ring by ring, through turbulence' },
    { id: 'cockpit', beat: 'Fight the attacker in the cockpit: punch, and block when he raises the knife' },
    { id: 'tie', beat: 'Tie him up with the multimedia headphone cable while he thrashes' },
    { id: 'tied', beat: 'He is tied; take the yoke' },
    { id: 'fly', beat: 'Stabilise the plane until it climbs again' },
  ],
  end: 'The plane is level and climbing; the family flies home',
  endsBy: 'win',
};

const W = 360, PY = 490, LANES = [W / 2 - 64, W / 2, W / 2 + 64];
let last = -9, prevT = Infinity; // Infinity: the first call of a run starts clean, so two runs of one seed match
/** Runs `fn` at most every `gap` seconds of the stage; the stage clock restarting resets it. */
function every(t, gap, fn) { if (t < prevT) last = -9; prevT = t; if (t - last >= gap) { last = t; return fn(); } }

export const bot = {
  async run({ peek, t }, io) {
    const bad = new Set();
    for (const o of peek.obs) {
      if (o.hit || o.y < PY - 210 || o.y > PY + 20) continue;
      const w = o.wide ? 128 : 64, x = o.side < 0 ? W / 2 - 100 : W / 2 + 100 - w;
      LANES.forEach((lx, l) => { if (lx > x - 24 && lx < x + w + 24) bad.add(l); });
    }
    for (const r of peek.runners) if (!r.hit && r.y > PY - 160 && r.y < PY + 26) bad.add(r.lane);
    if (!bad.has(peek.lane)) return;
    const free = [0, 1, 2].filter((l) => !bad.has(l)).sort((a, b) => Math.abs(a - peek.lane) - Math.abs(b - peek.lane));
    if (free.length) await every(t, 0.1, () => io.press(free[0] < peek.lane ? 'ArrowLeft' : 'ArrowRight'));
  },
  async door({ peek, t }, io) {
    if (peek.block > 0) { await every(t, 0.15, () => io.press(' ')); return; }
    const z = peek.zones[peek.ring];
    if (z === undefined) return;
    // the tap is read one frame later, after the needle has moved once more
    const a = peek.ang + (peek.speed * peek.dir * (peek.turb > 0 ? 1.6 : 1)) / 60;
    const d = Math.atan2(Math.sin(a - z), Math.cos(a - z));
    if (Math.abs(d) < 0.22) await every(t, 0.12, () => io.press(' '));
  },
  async cockpit({ peek, t }, io) {
    if (peek.mode === 'opening' || peek.mode === 'turn') return;
    if (peek.mode === 'windup') { if (peek.block <= 0) await io.press('ArrowDown'); return; }
    if (peek.hurt > 0) return;
    await every(t, 0.14, () => io.press(Math.floor(t * 7) % 2 ? 'ArrowRight' : 'ArrowLeft'));
  },
  async tie({ peek, t }, io) {
    if (peek.rage > 0) { await io.down(' '); return; }
    await io.up(' ');
    await every(t, 0.3, () => io.press(' '));
  },
  async tied({ t }, io) {
    await every(t, 0.5, () => io.press(' '));
  },
  async fly({ peek }, io) {
    await io.hold('ArrowUp', peek.pitch < -0.04);
    await io.hold('ArrowDown', peek.pitch > 0.1);
    await io.hold('ArrowLeft', peek.bank > 0.1);
    await io.hold('ArrowRight', peek.bank < -0.1);
  },
};

/** Drop the altitude to nothing: the plane is lost (the lose screen). */
export function forceLose() { window.__setAlt(0.5); }
