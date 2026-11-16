// Playthrough section of the bug check (DECISIONS 69, RULES 2א and 21ב).
// Plays the game from its first stage to the end screen with the game's own bot (Games/<GameId>/playthrough.mjs),
// on a manual clock and a fixed seed, so a run is exact and repeatable:
//   1. story arc: every stage the game has (__stages) has a beat in the arc, and every beat has a stage
//   2. full run: each stage is reached and finished by real key presses; a screenshot of each stage; the end screen
//      is reached (won, unless the arc says the game ends by failing); a frozen game or a stage that never ends is red
//   3. same seed twice: the second run must end with the same score and time (else Math.random or real time is
//      still in the gameplay)
//   4. lose → retry: for each stage, force a loss (the arc's forceLose) and check "retry from the stage" lands there
// The bot only presses keys and reads state (__world, __peek); it never writes game state. forceLose is the one
// exception, and only for check 4, which tests the lose screen, not the stage.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const TICK = 1 / 30;          // game seconds between two bot decisions
const SEED = 7;
const STILL_S = 5;            // world and stage state unchanged this long while play runs = frozen
const SHOT_AT = 2.5;          // seconds into a stage (after its banner) for the stage screenshot
const PW_KEY = { ' ': 'Space' };

/** Runs the section; returns what the handover card needs. */
export async function playthrough({ browser, base, GAME, OUT, add }) {
  const S = 'playthrough';
  const card = { arc: null, stages: [], end: null, repeat: null, retry: null, notAssessed: [] };
  const file = join(GAME, 'playthrough.mjs');
  if (!existsSync(file)) {
    add(S, 'playthrough.mjs (story arc + bot)', 'yellow', 'missing: the story arc, finishing the game and retry are not assessed');
    card.notAssessed.push('story arc, finishing the game, lose → retry (no playthrough.mjs)');
    return card;
  }
  const mod = await import(pathToFileURL(file).href);
  const arc = mod.arc;
  card.arc = arc;
  const dir = join(OUT, 'playthrough');
  mkdirSync(dir, { recursive: true });

  const context = await browser.newContext({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 1, locale: 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_CONNECTION_REFUSED|favicon/.test(m.text())) errors.push('console: ' + m.text()); });

  const held = new Set();
  const key = (k) => PW_KEY[k] || k;
  const io = {
    press: (k) => page.keyboard.press(key(k)),
    down: async (k) => { if (!held.has(k)) { held.add(k); await page.keyboard.down(key(k)); } },
    up: async (k) => { if (held.has(k)) { held.delete(k); await page.keyboard.up(key(k)); } },
    hold: (k, on) => (on ? io.down(k) : io.up(k)),
    releaseAll: async () => { for (const k of [...held]) await io.up(k); },
  };
  // one round trip per tick: advance the clock, then read everything the bot and the checks need
  const step = (d) => page.evaluate((d) => {
    const w = window;
    if (d) w.__advance(d);
    const st = w.__state();
    return { scene: st.scene, banner: st.banner, run: st.run, world: w.__world ? w.__world() : null, peek: w.__peek ? w.__peek() : null };
  }, d);
  const open = async () => {
    await page.goto(`${base}?seed=${SEED}`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForFunction(() => typeof window.__scenes === 'function' && typeof window.__manual === 'function', null, { timeout: 8000 });
    await page.evaluate((seed) => { window.__manual(true); window.__seed(seed); window.__go('play'); }, SEED);
  };

  try {
    await open();
    const gameStages = await page.evaluate(() => (window.__stages ? window.__stages() : ['play']));
    // ---- 1. story arc vs the game's stages ----
    const arcIds = (arc?.stages || []).map((s) => s.id);
    const noStage = arcIds.filter((id) => !gameStages.includes(id));
    const noBeat = gameStages.filter((id) => !arcIds.includes(id));
    add(S, `story arc: ${arcIds.length} beats, the game has ${gameStages.length} stages (${gameStages.join(' → ')})`, noStage.length || noBeat.length ? 'red' : 'green',
      [noStage.length && `beats with no stage: ${noStage.join(', ')}`, noBeat.length && `stages with no beat: ${noBeat.join(', ')}`].filter(Boolean).join('; '));
    if (!noStage.length && !noBeat.length && arcIds.join() !== gameStages.join()) add(S, 'story arc order matches the game', 'yellow', `arc ${arcIds.join(' → ')}`);

    // ---- 2 + 3. full run, twice ----
    const runOnce = async (shots) => {
      const r = { reached: [], end: null, problem: null, idle: [] };
      let stage = null, tStage = 0, shot = false, sig = '', still = 0, total = 0;
      const maxTotal = arc?.maxSeconds ?? 900;
      let snap = await step(0);
      while (total < maxTotal) {
        if (snap.scene !== 'play') {
          if (snap.scene === 'result' || snap.scene === 'lose') { r.end = { scene: snap.scene, run: snap.run, stage, at: total }; break; }
          snap = await step(TICK); total += TICK; continue;
        }
        const id = snap.world?.stage ?? 'play';
        if (id !== stage) {
          await io.releaseAll();
          stage = id; tStage = 0; shot = false; sig = ''; still = 0;
          r.reached.push({ id, at: +total.toFixed(1) });
        }
        const cur = r.reached[r.reached.length - 1];
        if (snap.banner) { await io.releaseAll(); await io.press('Enter'); }
        else {
          if (shots && !shot && tStage >= SHOT_AT) { shot = true; cur.shot = `playthrough/${r.reached.length}-${id}.png`; await page.screenshot({ path: join(OUT, cur.shot) }); }
          const bot = mod.bot?.[id];
          if (bot) await bot({ world: snap.world, peek: snap.peek, t: tStage }, io);
          else if (!r.idle.includes(id)) r.idle.push(id);
          const now = JSON.stringify([snap.world, snap.peek]);
          still = now === sig ? still + TICK : 0; sig = now;
          if (still >= STILL_S) { r.problem = `frozen in stage "${id}": nothing changed for ${STILL_S} s while keys went in`; break; }
          tStage += TICK;
          const lim = arc?.stages?.find((s) => s.id === id)?.maxSeconds ?? 180;
          if (tStage > lim) { r.problem = `stage "${id}" did not end within ${lim} s of play`; break; }
        }
        snap = await step(TICK); total += TICK;
      }
      if (!r.end && !r.problem) r.problem = `the game did not end within ${maxTotal} s`;
      if (r.end && shots) { await step(1.5); await page.screenshot({ path: join(OUT, 'playthrough/end.png') }); }
      await io.releaseAll();
      return r;
    };

    const a = await runOnce(true);
    const expect = arc?.endsBy ?? 'win';
    card.stages = gameStages.map((id) => ({ id, beat: arc?.stages?.find((s) => s.id === id)?.beat ?? '', ...(a.reached.find((x) => x.id === id) || {}) }));
    for (const s of card.stages) ok(S, `stage "${s.id}" reached and played`, s.at !== undefined, a.problem || 'not reached');
    if (a.idle.length) add(S, `bot plays every stage`, 'yellow', `no bot for: ${a.idle.join(', ')} (it waited there without input)`);
    if (a.problem) add(S, 'played to the end', 'red', a.problem);
    else {
      const won = !!a.end.run?.won;
      const good = expect === 'win' ? won && a.end.scene === 'result' : a.end.scene === 'result' || a.end.scene === 'lose';
      add(S, `played to the end: ${a.end.scene}${won ? ', won' : ', not won'}, score ${a.end.run?.score}, ${Math.round(a.end.run?.durationS ?? 0)} s of play`,
        good ? 'green' : 'red', good ? '' : expect === 'win' ? `the bot lost in stage "${a.end.stage}" (the bot is too weak, or the stage cannot be won)` : '');
    }
    card.end = a.problem ? { problem: a.problem } : { scene: a.end.scene, won: !!a.end.run?.won, score: a.end.run?.score, durationS: a.end.run?.durationS, expect };

    if (!a.problem) {
      await open();
      const b = await runOnce(false);
      const same = !b.problem && b.end.run?.score === a.end.run?.score && Math.abs((b.end.run?.durationS ?? 0) - (a.end.run?.durationS ?? 0)) < 0.01;
      card.repeat = same;
      add(S, `same seed (${SEED}) twice gives the same run`, same ? 'green' : 'yellow',
        same ? '' : `first: ${a.end.run?.score} in ${a.end.run?.durationS?.toFixed(2)} s, second: ${b.problem || `${b.end.run?.score} in ${b.end.run?.durationS?.toFixed(2)} s`}. Gameplay still reads Math.random or real time`);
    } else card.notAssessed.push('same seed twice (the first run did not finish)');

    // ---- 4. lose → retry from the stage ----
    const hasStageHook = await page.evaluate(() => typeof window.__stage === 'function');
    if (!mod.forceLose || !hasStageHook) {
      card.notAssessed.push(`lose → retry (${!hasStageHook ? 'the game has no stages' : 'no forceLose in playthrough.mjs'})`);
    } else {
      const ok4 = [];
      for (const id of gameStages) {
        await open();
        await page.evaluate((id) => window.__stage(id), id);
        let snap = await step(0.1);
        for (let i = 0; i < 60 && snap.banner; i++) { await io.press('Enter'); snap = await step(0.2); }
        await page.evaluate(mod.forceLose);
        for (let i = 0; i < 40 && snap.scene !== 'lose'; i++) snap = await step(0.25);
        if (snap.scene !== 'lose') { ok4.push(`${id}: forceLose did not reach the lose screen (${snap.scene})`); continue; }
        if (id === gameStages[0]) await page.screenshot({ path: join(OUT, 'playthrough/lose.png') });
        snap = await step(0.8); await io.press('Enter'); snap = await step(0.3);
        if (snap.scene !== 'play' || (snap.world?.stage ?? id) !== id) ok4.push(`${id}: retry went to ${snap.scene}/${snap.world?.stage}`);
      }
      card.retry = { total: gameStages.length, failed: ok4 };
      add(S, `lose → "retry from the stage" lands in the same stage (${gameStages.length - ok4.length}/${gameStages.length})`, ok4.length ? 'red' : 'green', ok4.join('; '));
    }
  } catch (e) {
    add(S, 'playthrough run', 'red', String(e.message).split('\n')[0]);
  }
  add(S, 'no JS errors during the playthrough', errors.length ? 'red' : 'green', errors.slice(0, 3).join(' | '));
  await context.close();
  return card;

  function ok(sec, name, cond, note) { add(sec, name, cond ? 'green' : 'red', cond ? '' : note); }
}

/** The handover card (RULES 21ב): the mechanical lines filled from the checks, the human lines left for Claude. */
export function handoverCard({ cfg, results, card, quick }) {
  const reds = results.filter((r) => r.status === 'red').length, yellows = results.filter((r) => r.status === 'yellow').length;
  const L = ['## Handover card', '', '```text',
    `Game: ${cfg.title} (${cfg.id}) v${cfg.version}`,
    `Checks: ${results.length - reds - yellows} green · ${yellows} yellow · ${reds} red`];
  if (quick || !card) L.push('Story arc: not assessed (--quick)');
  else if (!card.arc) L.push('Story arc: not assessed (no playthrough.mjs)');
  else {
    L.push(`Story arc: ${card.arc.start}`);
    card.stages.forEach((s, i) => L.push(`  ${i + 1}. ${s.id}: ${s.beat || '(no beat)'} — ${s.at !== undefined ? `reached at ${s.at} s${s.shot ? ` (${s.shot})` : ''}` : 'NOT REACHED'}`));
    L.push(`  end: ${card.arc.end}`);
    const e = card.end;
    L.push(`Played to the end by the bot: ${!e ? 'not assessed' : e.problem ? `NO, ${e.problem}` : `${e.scene}, ${e.won ? 'won' : 'not won'}, score ${e.score}, ${Math.round(e.durationS ?? 0)} s of play`}`);
    L.push(`Same seed twice: ${card.repeat === null ? 'not assessed' : card.repeat ? 'identical run' : 'DIFFERENT run'}`);
    L.push(`Lose → retry from the stage: ${card.retry ? `${card.retry.total - card.retry.failed.length}/${card.retry.total}` : 'not assessed'}`);
  }
  const na = ['real touch (the bot uses the keyboard)', 'sound', 'whether it is funny or fun', 'a real phone (RULES 23)', ...(card?.notAssessed || [])];
  L.push(`Not assessed: ${na.join('; ')}`);
  L.push('Guessed: <Claude fills in: what the build decided that research.md or the user did not say>');
  L.push('Still broken: <Claude fills in, or "nothing known">');
  L.push('Not yet played by a person.');
  L.push('```', '', 'Screenshots of the playthrough: `out/playthrough/` (one per stage, `end.png`, `lose.png`).');
  return L;
}
