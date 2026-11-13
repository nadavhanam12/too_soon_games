// The play scene: Icy Tower in reverse. World y grows downward; the floor (Nov 12 boardroom) rises.
import { R, S, W, SAFE_H as H, ctx, state, input, keyLeft, keyRight, setPointerIntercept, onKeyDown, fullBleed, txt, font, rnd, clamp, lerp, pick, fmtTime, sfx, type Scene } from '@tsg/index';
import { ink, inkCirc, inkRect, jit, marker, markerCirc, hatch, paper, sticker, INK, NV, tickInk } from './kit';
import { ceo, chart, chip, trumpFace, woman, type Pose } from './art';

const G = 1100, PX = 240, START_GAP = 1400;
const CHIPS = ['H100', 'B200', 'GB300', 'Blackwell', 'Rubin', 'H200', 'A100', 'Vera'];
type Kind = 'chip' | 'trump' | 'buy' | 'sorry' | 'rack' | 'gold' | 'keynote' | 'sign' | 'news';
interface PlatDef { w: [number, number]; bounce: number; label: () => string; breaks?: boolean; once?: boolean; stairs?: boolean }
const PT: Record<Kind, PlatDef> = {
  chip: { w: [70, 104], bounce: -450, label: () => pick(CHIPS) },
  trump: { w: [96, 116], bounce: -820, label: () => '"honorable guy"' },
  buy: { w: [84, 104], bounce: -660, label: () => 'STRONG BUY' },
  sorry: { w: [86, 106], bounce: -520, label: () => 'Apology letter' },
  rack: { w: [60, 60], bounce: -450, label: () => 'DGX', stairs: true },
  gold: { w: [150, 150], bounce: -980, once: true, label: () => 'BOARD: FULL CONFIDENCE' },
  keynote: { w: [96, 116], bounce: -620, label: () => 'KEYNOTE' },
  sign: { w: [64, 84], bounce: -450, label: () => pick(['GTC', 'AI FACTORY', 'DGX CLOUD', 'CUDA']) },
  news: { w: [94, 126], bounce: 0, breaks: true, label: () => pick(['NYT', 'WSJ', 'Bloomberg', 'The Information']) },
};
interface Plat { x: number; y: number; w: number; k: Kind; label: string; hit: number; gone: number; wob: number }
interface Part { x: number; y: number; vx: number; vy: number; life: number; col: string; r: number }
interface Npc { k: 'agent' | 'vp'; x: number; y: number; vx: number; t: number; on: boolean; timer: number; side: number; buzz?: number }
interface Env { x: number; y: number; vy: number; r: number }
interface World {
  x: number; y: number; vx: number; vy: number; cam: number; floor: number; fs: number; plats: Plat[]; parts: Part[]; env: Env[];
  top: number; bot: number; pose: Pose; land: number; cap: number; combo: number; sorryN: number; canJump: boolean; jumpFx: number;
  npcs: Npc[]; agentT: number; vpT: number; inv: number; evt: number; nextGeneric: number; lastQuip: number; quipI: number; planeX: number | null;
  envT: number; fsBonus: number;
}

let P: World;
let PLAYT = 0;
let lastSide = 1;
let jumpReq = false;
let headline: { s: string; life: number; t: number } | null = null;
const JB = { x: W / 2, y: H - 46, r: 30 };

const LVL = (): number => clamp(PLAYT / 150, 0, 1);
function ptype(): Kind {
  const l = LVL(), r = Math.random();
  const w: Record<Kind, number> = { chip: lerp(0.38, 0.28, l), trump: lerp(0.07, 0.03, l), buy: lerp(0.09, 0.05, l), sorry: lerp(0.12, 0.1, l), rack: lerp(0.08, 0.05, l), keynote: lerp(0.08, 0.05, l), sign: 0.08, news: lerp(0.1, 0.36, l), gold: 0 };
  let acc = 0; for (const k of Object.keys(w) as Kind[]) { acc += w[k]; if (r < acc) return k; } return 'news';
}
function mk(k: Kind, y: number, x?: number): Plat {
  const d = PT[k], w = rnd(d.w[0], d.w[1]) * (k === 'gold' ? 1 : lerp(1, 0.72, LVL()));
  if (x == null) { lastSide = Math.random() < 0.8 ? -lastSide : lastSide; x = lastSide < 0 ? rnd(12, W / 2 - w * 0.6) : rnd(W / 2 - w * 0.4, W - 12 - w); }
  return { x, y, w, k, label: d.label(), hit: 0, gone: 0, wob: 0 };
}
function addRow(y: number): void {
  const k = ptype();
  if (k === 'rack') { const x = Math.random() < 0.5 ? rnd(12, 120) : rnd(180, W - 72); const dir = x < W / 2 ? 1 : -1; for (let i = 0; i < 3; i++) P.plats.push(mk('rack', y - i * 52, x + dir * i * 44)); return; }
  P.plats.push(mk(k, y));
}
function initPlay(): void {
  P = { x: W / 2, y: 0, vx: 0, vy: 0, cam: -H * 0.42, floor: START_GAP, fs: 8, plats: [], parts: [], env: [], top: 60, bot: 60, pose: 'fall', land: 0, cap: 5, combo: 0, sorryN: 0, canJump: false, jumpFx: 0, npcs: [], agentT: 4, vpT: 6, inv: 0, evt: 0, nextGeneric: 200, lastQuip: 0, quipI: 0, planeX: null, envT: 0, fsBonus: 0 };
  PLAYT = 0; headline = null; jumpReq = false;
  P.plats.push(mk('chip', 110, W / 2 - 45)); P.bot = 110; P.top = 110; genPlats();
}
const gap = (): number => { const l = LVL(); return rnd(78 + 16 * l, 112 + 30 * l); };
function genPlats(): void {
  while (P.bot < P.cam + H + 260 && P.bot < P.floor - 60) { P.bot += gap(); addRow(P.bot); }
  while (P.top > P.cam - 320) { P.top -= gap(); addRow(P.top); }
}
function burst(x: number, y: number, n: number, col: string, sp = 160): void {
  for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), s = rnd(sp * 0.3, sp); P.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rnd(0.4, 0.8), col, r: rnd(2, 5) }); }
}
const QUIPS = ['Still an honorable guy.', 'The GPUs are fine.', 'Earnings call still on the 17th.', 'Beijing denies everything.', 'Investigation finds nothing. Stock falls anyway.', 'The jacket stays.', '"Deeply sorry." Again.', 'No evidence of anything. Yet.'];
function news(s: string, life = 3.2): void { headline = { s, life, t: 0 }; sfx.news?.(); }

function landOn(p: Plat): void {
  const d = PT[p.k]; p.hit++; p.wob = 1;
  if (d.breaks) { p.gone = 0.01; sfx.crack?.(); burst(P.x, p.y, 14, '#c9403a', 200); R.say(`"${p.label}" breaks the story. And the platform.`, 1.4); P.combo = 0; return; }
  P.vy = d.bounce; P.pose = 'land'; P.land = 0.14; P.combo++; P.canJump = true;
  if (p.k === 'trump') { sfx.boing?.(1.6); burst(P.x, p.y, 10, '#f5d76e'); R.say('"He\'s an honorable guy." Up you go!', 1.2); }
  else if (p.k === 'buy') { sfx.boing?.(1.4); burst(P.x, p.y, 10, '#3d9d55'); R.say('Analyst: STRONG BUY. Big bounce.', 1.1); }
  else if (p.k === 'sorry') {
    sfx.boing?.(0.9); R.flash(0.5); sfx.flash?.(); burst(P.x, p.y - 20, 12, '#fff', 240);
    const att = P.npcs.filter((n) => n.on);
    if (att.length) { att.forEach((n) => { n.on = false; n.vx = n.side * 160; n.y = P.y; }); R.say('"I am deeply sorry." She leaves. For now.', 1.6); }
    P.sorryN++;
    if (P.sorryN >= 3) { P.sorryN = 0; P.plats.push(mk('gold', P.y - 150, clamp(P.x - 75, 10, W - 160))); sfx.news?.(); R.say('Three apologies. The board has FULL CONFIDENCE. Go!', 1.8); }
    else R.say(`"I am deeply sorry." Apology ${P.sorryN}/3.`, 1.3);
  }
  else if (p.k === 'gold') { sfx.boing?.(1.9); burst(P.x, p.y, 18, '#ffd84a', 260); p.gone = 0.01; R.say('Full confidence lasts one bounce.', 1.3); }
  else if (p.k === 'keynote') { sfx.boing?.(1.3); burst(P.x, p.y, 8, '#76b900'); R.say('Keynote applause. Up!', 1); }
  else { sfx.boing?.(1); if (PLAYT - P.lastQuip > 7) { P.lastQuip = PLAYT; R.say(QUIPS[P.quipI++ % QUIPS.length]!, 1.6); } }
}

const EVENTS: Array<[number, string, () => void]> = [
  [20, 'MEMO LEAKED: CEO admits affair in letter to staff', () => { P.planeX = -40; R.flash(0.4); sfx.flash?.(); }],
  [45, 'BOARD OPENS INDEPENDENT INVESTIGATION', () => {}],
  [75, 'SECOND AFFAIR REPORTED. BOARD "PREPARING TO OUST"', () => { P.floor -= 160; R.shake(0.5); sfx.thud?.(); }],
  [110, 'SENATORS DEMAND RECORDS BE PRESERVED', () => { P.envT = 14; }],
  [150, 'ANALYST DOWNGRADE: "THE WRITING IS ON THE WALL"', () => { P.fsBonus += 10; }],
];
const GENERIC = ['BEIJING: "HE IS NOT A SPY"', 'EARNINGS CALL STILL SCHEDULED', 'STOCK REBOUNDS. BRIEFLY.', 'BOARD HIRES OUTSIDE SEARCH FIRM', '"NO COMPANY SECRETS COMPROMISED"'];

function stepPlay(dt: number): void {
  PLAYT += dt;
  if (jumpReq) { jumpReq = false; if (P.canJump) { P.canJump = false; P.vy = Math.min(P.vy, 0) - 520; P.jumpFx = 0.25; sfx.boing?.(1.25); burst(P.x, P.y, 6, '#f3f3f3', 120); } }
  if (P.jumpFx > 0) P.jumpFx -= dt;
  if (P.inv > 0) P.inv -= dt;
  const has = (k: Npc['k']) => P.npcs.some((n) => n.k === k);
  if (PLAYT >= 20 && !has('agent')) { P.agentT -= dt; if (P.agentT <= 0) { P.agentT = rnd(9, 14); const dir = Math.random() < 0.5 ? 1 : -1; P.npcs.push({ k: 'agent', x: dir > 0 ? -40 : W + 40, y: P.y + rnd(-220, 120), vx: dir * rnd(90, 130), t: 0, on: false, timer: 0, side: dir }); } }
  if (PLAYT >= 75 && !has('vp')) { P.vpT -= dt; if (P.vpT <= 0) { P.vpT = rnd(11, 16); const dir = Math.random() < 0.5 ? 1 : -1; P.npcs.push({ k: 'vp', x: dir > 0 ? -40 : W + 40, y: P.y + rnd(-260, 80), vx: dir * rnd(55, 85), t: 0, on: false, timer: 0, side: dir }); } }
  for (const n of P.npcs) {
    n.t += dt;
    if (n.on) {
      n.x = lerp(n.x, clamp(P.x + n.side * 30, 14, W - 14), 1 - Math.pow(0.001, dt)); n.y = lerp(n.y, P.y, 1 - Math.pow(0.0005, dt)); n.timer -= dt;
      n.buzz = (n.buzz || 0) - dt; if (n.buzz <= 0) { n.buzz = 3; R.shake(0.18); try { navigator.vibrate?.(120); } catch { /* ignore */ } }
      if (Math.random() < dt * 2) P.parts.push({ x: n.x, y: n.y - 60, vx: rnd(-15, 15), vy: -40, life: 0.8, col: '#ff6fae', r: 3 });
      if (n.timer <= 0) { n.timer = 10; P.floor -= 90; R.shake(0.35); sfx.thud?.(); news(n.k === 'agent' ? 'SEEN TOGETHER AGAIN. "ALLEGED AGENT"' : 'SEEN TOGETHER AGAIN. "VP, HEALTH CARE"', 2.6); R.say('Headline. The floor rises.', 1.2); }
      continue;
    }
    n.x += n.vx * dt; if (n.k === 'vp') n.y += Math.sin(n.t * 2) * 18 * dt;
    if (n.k === 'agent' && Math.random() < dt * 3) P.parts.push({ x: n.x - 10, y: n.y - 30, vx: -n.vx * 0.3 + rnd(-20, 20), vy: rnd(20, 60), life: rnd(0.6, 1.1), col: '#fffdf5', r: 3 });
    if (P.inv <= 0 && Math.abs(n.x - P.x) < 22 && Math.abs(n.y - 24 - (P.y - 26)) < 30) {
      P.inv = 1.2; n.on = true; n.timer = 10; n.side = n.x < P.x ? -1 : 1; n.vx = 0;
      P.vy = -950; P.canJump = true; burst(P.x, P.y - 30, 14, '#ff6fae', 220); sfx.boing?.(1.8);
      R.say(n.k === 'agent' ? 'A date in Singapore! Huge jump. She stays with you now.' : 'Dinner with the VP! Huge jump. She stays with you now.', 2);
    }
  }
  P.npcs = P.npcs.filter((n) => n.on || (n.x > -80 && n.x < W + 80 && n.y < P.floor));
  const ev = EVENTS[P.evt];
  if (ev && PLAYT >= ev[0]) { P.evt++; news(ev[1]); ev[2](); }
  else if (!ev && PLAYT >= P.nextGeneric) { P.nextGeneric = PLAYT + 40; news(pick(GENERIC)); }
  const L = keyLeft() || (input.down && input.px < W / 2), Rr = keyRight() || (input.down && input.px >= W / 2);
  const tx = L && !Rr ? -PX : Rr && !L ? PX : 0; P.vx = lerp(P.vx, tx, 1 - Math.pow(0.0008, dt));
  P.vy += G * dt; const py = P.y; P.y += P.vy * dt; P.x = clamp(P.x + P.vx * dt, 14, W - 14);
  if (P.land > 0) { P.land -= dt; if (P.land <= 0) P.pose = 'fall'; }
  if (P.vy > 0) for (const p of P.plats) { if (p.gone) continue; if (py <= p.y + 1 && P.y >= p.y - 1 && P.x > p.x - 6 && P.x < p.x + p.w + 6) { P.y = p.y; landOn(p); break; } }
  P.fs = Math.min(110, 16 + PLAYT * 0.5 + P.fsBonus); P.floor -= P.fs * dt;
  const maxGap = START_GAP * lerp(0.85, 0.4, LVL()); if (P.floor > P.y + maxGap) P.floor = lerp(P.floor, P.y + maxGap, 1 - Math.pow(0.05, dt));
  P.cam = lerp(P.cam, P.y - H * 0.45, 1 - Math.pow(0.002, dt));
  P.plats = P.plats.filter((p) => p.y > P.cam - 420 && p.y < P.floor + 40 && p.y < P.cam + H + 700 && p.gone < 1.01);
  for (const p of P.plats) { if (p.gone) p.gone += dt * 2; if (p.wob > 0) p.wob -= dt * 3; }
  if (P.plats.length) { const ys = P.plats.map((p) => p.y); P.top = Math.min(...ys); P.bot = Math.max(...ys); } else { P.top = P.bot = P.y; }
  genPlats();
  for (const q of P.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 500 * dt; q.life -= dt; } P.parts = P.parts.filter((q) => q.life > 0);
  if (P.planeX !== null) { P.planeX += 220 * dt; if (P.planeX > W + 60) P.planeX = null; }
  if (P.envT > 0) { P.envT -= dt; if (Math.random() < dt * 1.6) P.env.push({ x: rnd(20, W - 20), y: P.cam - 40, vy: rnd(160, 240), r: 0 }); }
  for (const e of P.env) { e.y += e.vy * dt; e.r += dt * 3; if (Math.abs(e.x - P.x) < 18 && Math.abs(e.y - (P.y - 28)) < 22) { e.y = 1e9; P.vy = Math.max(P.vy, 0) + 260; sfx.hurt?.(); R.say('Subpoena! Pushed down.', 0.9); } }
  P.env = P.env.filter((e) => e.y < P.floor && e.y < P.cam + H + 60);
  P.cap = 5 * clamp((P.floor - P.y) / START_GAP, 0, 1.1);
  if (P.y >= P.floor - 2) { P.y = P.floor; sfx.thud?.(); R.shake(0.5); R.fail({ score: Math.floor(PLAYT), durationS: PLAYT, reason: 'floor' }); }
}
const moodOf = (c: number): number => (c > 3.5 ? 0 : c > 2 ? 1 : c > 1 ? 2 : 3);

function drawPlat(p: Plat, cam: number): void {
  const w = p.w, x = p.x, y = p.y - cam + (p.gone ? p.gone * 90 : 0) + Math.sin(p.wob * 9) * p.wob * 4, t = state.t;
  ctx.save(); if (p.gone) { ctx.globalAlpha = Math.max(0, 1 - p.gone); ctx.translate(x + w / 2, y); ctx.rotate(p.gone * 0.4); ctx.translate(-x - w / 2, -y); }
  if (p.k === 'chip') chip(x, y, w, '');
  else if (p.k === 'rack') { chip(x, y, w, p.label, '#2a2a2a', NV); for (let i = 0; i < 3; i++) markerCirc(x + 10 + i * 6, y + 12, 1.6, '#3ddc84'); }
  else if (p.k === 'news') { marker(x + 3, y + 4, w, 16, '#000', 0.5); marker(x, y, w, 16, '#fbf5e6', 1); inkRect(x, y, w, 16, 2.5, '#0b0b0b'); hatch(x, y, w, 16, 'rgba(150,20,20,.2)', 5); txt(p.label, x + w / 2, y + 8, 12, '#7a1010', 'center', 900); }
  else if (p.k === 'sorry') { marker(x + 3, y + 4, w, 16, '#000', 0.5); marker(x, y, w, 16, '#fff8e0', 1); inkRect(x, y, w, 16, 2.5, '#0b0b0b'); ink([[x + 8, y + 5], [x + w - 8, y + 5]], 1, '#999'); txt(p.label, x + w / 2, y + 9, 12, '#0b0b0b'); }
  else if (p.k === 'gold') { const g = Math.sin(t * 8) * 2; marker(x + 3, y + 4, w, 20, '#000', 0.5); marker(x, y - g, w, 20, '#ffd84a', 1); inkRect(x, y - g, w, 20, 3, '#0b0b0b'); txt(p.label, x + w / 2, y + 10 - g, 12, '#0b0b0b', 'center', 900); for (let i = 0; i < 4; i++) txt('✦', x + 10 + (i * (w - 20)) / 3, y - 10 - g + Math.sin(t * 6 + i) * 3, 10, '#ffd84a'); }
  else if (p.k === 'keynote') { marker(x + 3, y + 4, w, 16, '#000', 0.5); marker(x, y, w, 16, '#222', 1); inkRect(x, y, w, 16, 2.5, NV); ink([[x + 12, y], [x + 12, y - 18]], 2, INK); markerCirc(x + 12, y - 21, 4, '#888'); for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.5; ink([[x + w - 16 - i * 10, y - 4], [x + w - 10 - i * 10, y - 16]], 1.5, NV); ctx.globalAlpha = 1; } txt(p.label, x + w / 2 + 8, y + 8, 12, NV, 'center', 900); }
  else if (p.k === 'sign') { marker(x + 3, y + 4, w, 16, '#000', 0.5); marker(x, y, w, 16, '#0f0f0f', 1); inkRect(x, y, w, 16, 2.5, NV); txt(p.label, x + w / 2, y + 8, 12, NV, 'center', 900); }
  else if (p.k === 'buy') { marker(x + 3, y + 4, w, 16, '#000', 0.5); marker(x, y, w, 16, '#c8f06a', 1); inkRect(x, y, w, 16, 2.5, '#0b0b0b'); txt('📣 ' + p.label, x + w / 2, y + 8, 12, '#0b0b0b', 'center', 900); }
  else if (p.k === 'trump') { marker(x + 3, y + 4, w, 16, '#000', 0.5); marker(x, y, w, 16, '#c9403a', 1); inkRect(x, y, w, 16, 2.5, '#0b0b0b'); txt(p.label, x + w / 2 + 10, y + 8, 11, '#fff', 'center', 900); trumpFace(x + 14, y - 10, 0.9); }
  ctx.restore();
}
function drawFloor(cam: number): void {
  const y = P.floor - cam; if (y > H + 200) return;
  marker(0, y, W, H - y + 200, '#0a0a0a', 1); hatch(0, y, W, H - y + 200, 'rgba(255,255,255,.05)', 9);
  ink([[0, y], [W, y]], 5, NV);
  marker(40, y - 2, W - 80, 14, '#3a3a3a', 1); inkRect(40, y - 2, W - 80, 14, 2.5); for (let i = 0; i < 5; i++) { const cx = 64 + i * 58; marker(cx - 9, y + 14, 18, 20, '#222', 1); inkRect(cx - 9, y + 14, 18, 20, 2, '#888'); }
  for (let i = 0; i < 7; i++) { const mx = 22 + i * 52; ink([[mx, y], [mx + jit(i, 3), y - 26]], 2.5); markerCirc(mx + jit(i, 3), y - 30, 6, '#555'); inkCirc(mx + jit(i, 3), y - 30, 6, 2); }
  sticker('NOV 12 · BOARD MEETING', W / 2, y - 54, 13, '#f0a0a0', 0.04);
}
function hud(): void {
  sticker('Survived ' + fmtTime(PLAYT), 66, 24, 14, '#fff8e0', -0.04); sticker('Day ' + (1 + Math.floor(PLAYT / 45)), W - 28, 294, 11, PLAYT >= 180 ? '#f0a0a0' : '#fff8e0', -0.03);
  sticker('Market cap $' + P.cap.toFixed(1) + 'T', W - 82, 24, 14, P.cap < 1.5 ? '#f0a0a0' : '#9ad7a0', 0.04);
  const d = clamp((P.floor - P.y) / START_GAP, 0, 1); marker(W - 14, 60, 8, 200, '#fff8e0', 0.8); inkRect(W - 14, 60, 8, 200, 2); marker(W - 14, 60 + 200 * (1 - d), 8, 200 * d, d < 0.3 ? '#c9403a' : '#3d9d55', 1); txt('floor', W - 10, 272, 11, '#f3f3f3', 'center', 400);
  sticker('Apologies ' + P.sorryN + '/3', 62, H - 22, 12, P.sorryN === 2 ? '#ffd84a' : '#fff8e0', -0.03);
  const on = P.canJump, k = P.jumpFx > 0 ? 1.12 : 1; ctx.save(); ctx.translate(JB.x, JB.y); ctx.scale(k, k); markerCirc(3, 4, JB.r, '#000', 0.6); markerCirc(0, 0, JB.r, on ? NV : '#3a3a3a', 1); inkCirc(0, 0, JB.r, 3, '#0b0b0b'); txt('JUMP', 0, 1, 15, on ? '#0b0b0b' : '#777', 'center', 900); ctx.restore();
}
function drawHeadline(dt: number): void {
  if (!headline) return;
  headline.t += dt; const a = Math.min(1, (headline.life - headline.t) * 2, headline.t * 4);
  if (a <= 0) { headline = null; return; }
  ctx.globalAlpha = a; const y = 52;
  marker(8, y - 14, W - 16, 30, '#fbf5e6', 1); inkRect(8, y - 14, W - 16, 30, 2.5, '#0b0b0b'); hatch(8, y - 14, W - 16, 30, 'rgba(0,0,0,.06)', 6);
  txt('BREAKING', 34, y, 10, '#c9403a', 'center', 900); ink([[58, y - 10], [58, y + 10]], 1.5, '#0b0b0b');
  font(12); let s = headline.s; while (ctx.measureText(s).width > W - 96 && s.length > 4) s = s.slice(0, -1); if (s !== headline.s) s = s.slice(0, -1) + '…';
  txt(s, 66, y + 1, 12, '#0b0b0b', 'left', 900); ctx.globalAlpha = 1;
}

const inJump = (p: { x: number; y: number }): boolean => Math.hypot(p.x - JB.x, p.y - JB.y) < JB.r + 14;
onKeyDown((e) => { if (state.scene === 'play' && [' ', 'ArrowUp', 'w', 'W'].includes(e.key)) { jumpReq = true; return true; } return false; });

export const playScene: Scene = {
  enter() {
    initPlay();
    setPointerIntercept((p) => { if (inJump(p)) { jumpReq = true; return true; } return false; });
    R.say('Hold a side to move. Tap JUMP (or Space) for an extra jump.', 2.8);
  },
  exit() { setPointerIntercept(null); },
  draw(dt) {
    tickInk();
    if (dt > 0) stepPlay(dt);
    paper(); fullBleed((h) => chart(P.cam, 0.45, h));
    for (const p of P.plats) drawPlat(p, P.cam);
    drawFloor(P.cam);
    for (const e of P.env) { ctx.save(); ctx.translate(e.x, e.y - P.cam); ctx.rotate(Math.sin(e.r) * 0.3); marker(-12, -8, 24, 16, '#fff8e0', 1); inkRect(-12, -8, 24, 16, 2, '#0b0b0b'); ink([[-12, -8], [0, 2], [12, -8]], 1.5, '#0b0b0b'); txt('SUBPOENA', 0, 10, 7, '#7a1010'); ctx.restore(); }
    for (const q of P.parts) { ctx.globalAlpha = Math.min(1, q.life * 2); markerCirc(q.x, q.y - P.cam, q.r, q.col); } ctx.globalAlpha = 1;
    if (P.planeX !== null) { const px = P.planeX, py = 140 + Math.sin(px * 0.03) * 12; ctx.save(); ctx.translate(px, py); ctx.rotate(0.2); marker(-16, -4, 32, 8, '#fffdf5', 1); ink([[-16, 0], [16, -4], [-6, 4]], 2, '#0b0b0b', true); ctx.restore(); txt('MEMO', px, py + 16, 10, '#7a1010'); }
    for (const n of P.npcs) {
      const sx = n.x, sy = n.y - P.cam;
      if (n.k === 'vp') { ctx.save(); ctx.translate(sx, sy + 6); marker(-24, -8, 48, 16, '#fff8e0', 1); inkRect(-24, -8, 48, 16, 2, '#0b0b0b'); ink([[-6, 8], [-2, 16], [2, 8]], 1.5, '#0b0b0b'); txt('call me', 0, 1, 9, '#0b0b0b'); ctx.restore(); }
      ctx.save(); if (n.vx < 0) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); } woman(sx, sy, n.k, state.t); ctx.restore();
      sticker(n.k === 'agent' ? 'The Agent' : 'The VP', sx, sy - 70, 10, n.k === 'agent' ? '#ffb3d6' : '#ffe08a', -0.04);
      if (n.on) txt('♥', sx, sy - 88 + Math.sin(state.t * 5) * 3, 16, '#ff6fae');
    }
    if (P.inv > 0 && Math.floor(P.inv * 12) % 2 === 0) ctx.globalAlpha = 0.4;
    ceo(P.x, P.y - P.cam, P.pose, state.t, 1, moodOf(P.cap)); ctx.globalAlpha = 1;
    if (P.vy > 500) { ctx.globalAlpha = 0.35; for (let i = 0; i < 3; i++) ink([[P.x - 10 + i * 10, P.y - P.cam - 60 - i * 6], [P.x - 10 + i * 10, P.y - P.cam - 80 - i * 10]], 2); ctx.globalAlpha = 1; }
    hud();
    drawHeadline(dt);
  },
};

// debug hooks specific to this game
const w = window as unknown as Record<string, unknown>;
w.__setT = (v: number) => { PLAYT = v; };
w.__spawn = (k: Kind, dy = 90, dx = -40) => { if (P) P.plats.push(mk(k, P.y + dy, P.x + dx)); };
w.__world = () => P && { x: P.x, y: P.y, floor: P.floor, cap: P.cap, plats: P.plats.length, playT: PLAYT };
void S;
