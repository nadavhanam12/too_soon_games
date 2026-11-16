// HalfMarathon: the story arc (RULES 2א) and the bot the bug check plays it with (RULES 21ב, DECISIONS 69).
// Not part of the build. The bot only presses keys and reads __world / __peek; forceLose is used only to test the
// lose screen's "retry from the stage".

export const arc = {
  start: 'A founder at the start line in Cyprus, 4:30 alarm, 21.1 km ahead',
  stages: [
    { id: 'start', beat: 'Weave through the start crowd (stag party, pint guy); a dad with a stroller overtakes you' },
    { id: 'water', beat: 'Water station: grab water and local food, a street cat steals the snack, ouzo is a mistake' },
    { id: 'sun', beat: '29°C in November: sprint and overheat, let go for the street cats' },
    { id: 'wall', beat: 'The mental wall at km 15: the inner voice, a wall of excuses falling brick by brick' },
    { id: 'finish', beat: 'Find the wife and baby in the crowd, high five, the baby crosses the line first' },
  ],
  end: 'Through the arch at 21.1 km with a finish time; with the high five the baby wins the race',
  endsBy: 'win',
};

const W = 360, PY = 490, LANES = [W / 2 - 84, W / 2, W / 2 + 84];
let last = -9, prevT = Infinity; // Infinity: the first call of a run starts clean, so two runs of one seed match
/** Runs `fn` at most every `gap` seconds of the stage; the stage clock restarting resets it. */
function every(t, gap, fn) { if (t < prevT) last = -9; prevT = t; if (t - last >= gap) { last = t; return fn(); } }

/** Move toward the nearest lane no obstacle will occupy in the next ~0.9 s. */
async function dodge(peek, io, blocked) {
  const bad = blocked(peek);
  if (!bad.has(peek.lane)) return;
  const free = [0, 1, 2].filter((l) => !bad.has(l)).sort((a, b) => Math.abs(a - peek.lane) - Math.abs(b - peek.lane));
  if (free.length) await io.press(free[0] < peek.lane ? 'ArrowLeft' : 'ArrowRight');
}

export const bot = {
  async start({ peek, t }, io) {
    await every(t, 0.12, () => dodge(peek, io, (p) => {
      const bad = new Set();
      for (const o of p.obs) if (!o.hit && o.y > PY - 190 && o.y < PY + 30) { bad.add(o.lane); if (o.kind === 'couple' || o.kind === 'stag') bad.add(o.lane + 1); }
      return bad;
    }));
  },
  async water({ peek, t }, io) {
    const RING = 134;
    const inRing = peek.things.filter((q) => !q.taken && Math.abs(q.x - RING) < 22).sort((a, b) => Math.abs(a.x - RING) - Math.abs(b.x - RING))[0];
    if (inRing && inRing.kind !== 'ouzo') await every(t, 0.15, () => io.press(' '));
  },
  async sun({ peek }, io) {
    const catNear = peek.cats.some((c) => !c.done && c.x - 110 < 110);
    await io.hold(' ', peek.over <= 0 && peek.heat < 0.85 && !catNear);
  },
  async wall({ peek, t }, io) {
    await every(t, 0.2, () => io.press(peek.want === 2 ? 'ArrowRight' : 'ArrowLeft'));
  },
  async finish({ world, peek, t }, io) {
    if (!world.highFive && peek.famX > 50 && peek.famX < W - 50) { await io.press('ArrowUp'); return; }
    await every(t, 0.12, () => io.press(' '));
  },
};

/** Push the race clock past the cutoff: the sweeper bus (the lose screen). */
export function forceLose() { window.__setRace(10799); }
