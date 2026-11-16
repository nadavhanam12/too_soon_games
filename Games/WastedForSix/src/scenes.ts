// The three "freeze-frame" stages: the world behind turns gray, the portrait stays in full color.
//   boss  — agree (WASTED, then the option is gone) / fake sick / quit
//   clerk — loan / steal / trade-in (console and couch get refused; the ring works)
//   pc    — type the password WASTED on a 90s beige PC; wrong tries get jokes and an escalating hint
import { W, view, ctx, input, pick, rr, txt, wrap, inBtn, sfx } from '@tsg/index';
import { G, registerStage, stageDone, finishGame, addScore } from './play';
import { D, renderWorld } from './drive';
import { BOSS, CLERK, PC, type TradeItem } from './content';
import { C } from './art';
import { grayOut, ptxt } from './pixel';
import { drawPortrait, type PortraitId } from './portraits';

interface Opt { id: string; label: string }
const UI = {
  phase: 'pick' as 'pick' | 'react' | 'wasted' | 'trade',
  portrait: 'boss-idle' as PortraitId,
  name: '',
  line: '',
  sub: '',
  opts: [] as Opt[],
  t: 0,
  onOpt: (_id: string): void => {},
};
const BTN_Y = [482, 534, 586], BTN_W = 320, BTN_H = 46;

function setUI(p: Partial<typeof UI>): void { Object.assign(UI, p); UI.t = 0; }

function grayWorld(dim = 0.35): void { renderWorld([], true); grayOut(0, -view.top, W, view.H, dim); }

function drawDecision(): void {
  grayWorld();
  const pop = Math.min(1, UI.t * 5);
  ctx.save(); ctx.translate(W / 2, 192); ctx.scale(0.94 + 0.06 * pop, 0.94 + 0.06 * pop); ctx.translate(-W / 2, -192);
  drawPortrait(UI.portrait, 48, 16, 264);
  ctx.restore();
  rr(40, 352, 106, 24, 4, '#120a24', C.pink, 2); ptxt(UI.name, 93, 364, 1, C.pink);
  // speech panel
  rr(16, 384, W - 32, 74, 12, 'rgba(12,8,20,.92)', 'rgba(255,255,255,.18)', 1.5);
  const lines = wrap(UI.line, 14, W - 56, 900).slice(0, 3);
  const y0 = 421 - ((lines.length - 1) * 19) / 2 - (UI.sub ? 8 : 0);
  lines.forEach((l, i) => txt(l, W / 2, y0 + i * 19, 14, '#fff', 'center', 900));
  if (UI.sub) txt(UI.sub, W / 2, y0 + lines.length * 19 + 2, 12, C.money, 'center', 900);
  // options (or Continue)
  const ready = UI.t > 0.35;
  ctx.globalAlpha = ready ? 1 : 0.4;
  UI.opts.forEach((o, i) => {
    const y = BTN_Y[UI.opts.length === 1 ? 1 : i]!;
    rr(W / 2 - BTN_W / 2, y - BTN_H / 2, BTN_W, BTN_H, 10, o.id === 'continue' ? C.pink : '#1b1430', o.id === 'continue' ? undefined : C.pink, 2);
    const fs = o.label.length > 32 ? 13 : 15;
    txt(o.label, W / 2, y + 1, fs, '#fff', 'center', 900);
  });
  ctx.globalAlpha = 1;
}

function decisionTaps(): void {
  if (UI.t <= 0.35) { input.taps.length = 0; return; }
  for (const p of input.taps.splice(0)) {
    if (p.key) { if (UI.opts.length === 1) { sfx.tick?.(); UI.onOpt(UI.opts[0]!.id); } return; }
    for (let i = 0; i < UI.opts.length; i++) {
      const y = BTN_Y[UI.opts.length === 1 ? 1 : i]!;
      if (inBtn(p, W / 2, y, BTN_W, BTN_H, 2)) { sfx.tick?.(); UI.onOpt(UI.opts[i]!.id); return; }
    }
  }
}
function decisionKey(e: KeyboardEvent): boolean {
  const n = Number(e.key);
  if (UI.t > 0.35 && n >= 1 && n <= UI.opts.length) { sfx.tick?.(); UI.onOpt(UI.opts[n - 1]!.id); return true; }
  return false;
}
const CONTINUE: Opt = { id: 'continue', label: 'Continue ›' };

// ---------- boss ----------
function bossPick(): void {
  const opts: Opt[] = [];
  if (!G.agreed) opts.push({ id: 'agree', label: BOSS.options.agree });
  opts.push({ id: 'sick', label: BOSS.options.sick }, { id: 'quit', label: BOSS.options.quit });
  setUI({ phase: 'pick', portrait: 'boss-idle', name: BOSS.name, line: G.agreed ? BOSS.again : pick(BOSS.open), sub: '', opts });
  UI.onOpt = (id) => {
    if (id === 'agree') {
      setUI({ phase: 'react', portrait: 'boss-agree', line: BOSS.react.agree, opts: [] });
    } else if (id === 'sick' || id === 'quit') {
      G.branch = id;
      if (id === 'quit') { UI.sub = `Last paycheck: -$${G.money}`; G.money = 0; sfx.bad?.(); } else { sfx.cough?.(); UI.sub = ''; }
      const sub = UI.sub;
      setUI({ phase: 'react', portrait: id === 'sick' ? 'boss-sick' : 'boss-quit', line: BOSS.react[id], sub, opts: [CONTINUE] });
      UI.onOpt = () => stageDone();
    }
  };
}
registerStage('boss', {
  enter() { D.goal = null; bossPick(); },
  step(dt) {
    UI.t += dt;
    if (UI.phase === 'react' && UI.portrait === 'boss-agree' && UI.t > 1.8) { UI.phase = 'wasted'; UI.t = 0; sfx.wasted?.(); }
    if (UI.phase === 'wasted') { if (UI.t > 0.9 && input.taps.length) { input.taps.length = 0; G.agreed = true; bossPick(); } else input.taps.length = 0; return; }
    decisionTaps();
  },
  render() {
    drawDecision();
    if (UI.phase === 'wasted') wastedOverlay(BOSS.wasted, BOSS.wastedSub, UI.t);
  },
  key: decisionKey,
});

/** The in-scene WASTED card (agreeing with the boss). Our own pixel font, a plain word. */
export function wastedOverlay(line: string, sub: string, t: number): void {
  const k = Math.min(1, t * 3);
  ctx.save();
  ctx.globalAlpha = k; grayOut(0, -view.top, W, view.H, 0.75);
  const sc = 1 + Math.max(0, 0.4 - t) * 1.5;
  ctx.translate(W / 2, 250); ctx.scale(sc, sc);
  ptxt('WASTED', 0, 0, 8, '#e8e8e8', 'center', '#000');
  ctx.restore();
  ctx.globalAlpha = k;
  for (const [i, l] of wrap(line, 16, W - 60, 900).entries()) txt(l, W / 2, 316 + i * 22, 16, '#fff', 'center', 900);
  txt(sub, W / 2, 372, 13, '#cfcfcf', 'center', 700);
  if (t > 0.9 && Math.sin(t * 5) > -0.2) txt('Tap to continue', W / 2, 600, 13, '#cfcfcf', 'center', 700);
  ctx.globalAlpha = 1;
}

// ---------- clerk ----------
function clerkPick(): void {
  setUI({
    phase: 'pick', portrait: 'clerk-idle', name: CLERK.name, line: pick(CLERK.open), sub: CLERK.broke,
    opts: [{ id: 'loan', label: CLERK.options.loan }, { id: 'steal', label: CLERK.options.steal }, { id: 'tradein', label: CLERK.options.tradein }],
  });
  UI.onOpt = (id) => {
    if (id === 'loan' || id === 'steal') {
      G.store = id;
      setUI({ phase: 'react', portrait: id === 'loan' ? 'clerk-loan' : 'clerk-steal', line: CLERK.react[id], sub: '', opts: [CONTINUE] });
      UI.onOpt = () => stageDone();
    } else tradeMenu(CLERK.react.tradein);
  };
}
function tradeMenu(line: string): void {
  const items = (['console', 'couch', 'ring'] as TradeItem[]).filter((i) => !G.traded.includes(i));
  setUI({ phase: 'trade', portrait: 'clerk-tradein', line, sub: '', opts: items.map((i) => ({ id: i, label: CLERK.trade[i] })) });
  UI.onOpt = (id) => {
    const item = id as TradeItem;
    if (item === 'ring') {
      G.store = 'tradein';
      setUI({ phase: 'react', portrait: 'clerk-tradein', line: CLERK.tradeReact.ring, sub: '', opts: [CONTINUE] });
      UI.onOpt = () => stageDone();
    } else { G.traded.push(item); sfx.bad?.(); tradeMenu(CLERK.tradeReact[item]); }
  };
}
registerStage('clerk', {
  enter() { D.goal = null; clerkPick(); },
  step(dt) { UI.t += dt; decisionTaps(); },
  render() { drawDecision(); },
  key: decisionKey,
});

// ---------- pc: the password ----------
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const KW = 32, KH = 44, KG = 3, KY = [420, 470, 520], DEL_W = 52;
const PCS = { typed: '', reply: '', close: '', shake: 0, ok: -1 };
function keyRects(): Array<{ k: string; x: number; y: number; w: number }> {
  const out: Array<{ k: string; x: number; y: number; w: number }> = [];
  ROWS.forEach((row, r) => {
    const extra = r === 2 ? DEL_W + KG : 0, total = row.length * KW + (row.length - 1) * KG + extra;
    let x = (W - total) / 2;
    for (const ch of row) { out.push({ k: ch, x: x + KW / 2, y: KY[r]!, w: KW }); x += KW + KG; }
    if (r === 2) out.push({ k: 'DEL', x: x + DEL_W / 2, y: KY[r]!, w: DEL_W });
  });
  return out;
}
function typeKey(k: string): void {
  if (PCS.ok >= 0 || PCS.shake > 0) return;
  if (k === 'DEL') { PCS.typed = PCS.typed.slice(0, -1); sfx.tick?.(); return; }
  if (PCS.typed.length >= 6) return;
  PCS.typed += k; sfx.key?.();
  if (PCS.typed.length === 6) submit();
}
function submit(): void {
  if (PCS.typed === 'WASTED') {
    if (G.wrongPw === 0) addScore(500);
    PCS.ok = 0; PCS.reply = ''; PCS.close = ''; sfx.win?.();
    return;
  }
  G.wrongPw++;
  const n = [...PCS.typed].filter((c, i) => c === 'WASTED'[i]).length;
  PCS.reply = PC.wrong[Math.min(G.wrongPw - 1, PC.wrong.length - 1)]!;
  PCS.close = PC.close(n);
  PCS.shake = 0.6; sfx.bad?.();
}
registerStage('pc', {
  enter() { D.goal = null; PCS.typed = ''; PCS.reply = ''; PCS.close = ''; PCS.shake = 0; PCS.ok = -1; },
  step(dt) {
    if (PCS.shake > 0) { PCS.shake -= dt; if (PCS.shake <= 0) PCS.typed = ''; }
    if (PCS.ok >= 0) { PCS.ok += dt; input.taps.length = 0; if (PCS.ok > 0.7) finishGame(); return; }
    for (const p of input.taps.splice(0)) {
      if (p.key) continue;
      for (const r of keyRects()) if (Math.abs(p.x - r.x) <= r.w / 2 + 1 && Math.abs(p.y - r.y) <= KH / 2 + 2) { typeKey(r.k); break; }
    }
  },
  render() {
    grayWorld(0.55);
    // beige 90s PC
    rr(24, 36, 312, 262, 14, '#d9d2c5', '#8f877a', 3);
    rr(40, 52, 280, 200, 8, '#071407');
    const ok = PCS.ok >= 0;
    ptxt(ok ? PC.ok : PC.title, W / 2, 80, 2, ok ? C.money : '#5ce67a');
    const sx = PCS.shake > 0 ? Math.sin(PCS.shake * 60) * 5 : 0, reveal = Math.max(0, Math.min(5, G.wrongPw - 4));
    for (let i = 0; i < 6; i++) {
      const x = 58 + i * 42 + sx;
      rr(x, 108, 34, 46, 4, 'rgba(92,230,122,.08)', PCS.shake > 0 ? C.red : '#2f7a3a', 2);
      const ch = PCS.typed[i];
      if (ch) ptxt(ch, x + 17, 131, 4, PCS.shake > 0 ? C.red : '#9dffb0');
      else if (i < reveal) ptxt('WASTED'[i]!, x + 17, 131, 4, 'rgba(255,63,164,.35)');
      else if (i === PCS.typed.length && Math.sin(performance.now() / 160) > 0) rr(x + 9, 146, 16, 3, 0, '#5ce67a');
    }
    if (PCS.reply) { wrap(PCS.reply, 12, 250, 700).slice(0, 2).forEach((l, i) => txt(l, W / 2, 182 + i * 16, 12, '#9dffb0', 'center', 700)); txt(PCS.close, W / 2, 226, 11, '#5ce67a', 'center', 400); }
    else if (PCS.ok < 0) txt('6 letters. You know it.', W / 2, 190, 12, '#5ce67a', 'center', 700);
    rr(150, 298, 60, 14, 0, '#bdb5a6'); rr(110, 312, 140, 10, 3, '#bdb5a6');
    // sticky notes
    note(38, 20, 128, 34, -0.08, PC.note1);
    note(214, 322, 132, 40, 0.06, PC.note2);
    // on-screen keyboard
    for (const r of keyRects()) {
      rr(r.x - r.w / 2, r.y - KH / 2, r.w, KH, 6, r.k === 'DEL' ? '#3a2a5a' : '#ece6d8', '#8f877a', 1.5);
      if (r.k === 'DEL') txt('⌫', r.x, r.y + 1, 18, '#fff', 'center', 900); else ptxt(r.k, r.x, r.y, 2, '#2b2620');
    }
  },
  key(e) {
    if (e.key === 'Backspace') { typeKey('DEL'); return true; }
    if (/^[a-zA-Z]$/.test(e.key)) { typeKey(e.key.toUpperCase()); return true; }
    if (e.key === 'Enter' || e.key === ' ') return true;
    return false;
  },
});
function note(x: number, y: number, w: number, h: number, rot: number, s: string): void {
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
  ctx.fillStyle = '#ffe96b'; ctx.fillRect(-w / 2, -h / 2, w, h);
  const ls = wrap(s, 11, w - 12, 700);
  ls.forEach((l, i) => txt(l, 0, -((ls.length - 1) * 13) / 2 + i * 13, 11, '#3a2a00', 'center', 700));
  ctx.restore();
}
