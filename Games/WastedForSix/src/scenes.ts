// The four "freeze-frame" stages: the world behind turns gray, the portrait stays in full color.
//   boss  — agree (WASTED, then the option is gone) / fake sick / quit
//   clerk — loan / steal / trade-in (console and couch get refused; the ring works)
//   fiancee — on the couch between you and the PC: sneaking and fake listening fail, asking honestly works
//   pc    — type the password WASTED on a modern desktop's login screen; wrong tries get jokes and an escalating hint
import { R, W, view, ctx, state, input, keyName, pick, rr, txt, wrap, inBtn, sfx, easeO, easeOB, springOut, pop, haptic } from '@tsg/index';
import { G, registerStage, stageDone, finishGame, addScore, timeline } from './play';
import { D, renderWorld } from './drive';
import { BOSS, CLERK, FIANCEE, PC, UI as LABELS, type TradeItem, type FianceeQuiz } from './content';
import { C, guy } from './art';
import { grayOut, ptxt } from './pixel';
import { drawPortrait, type PortraitId, type Who } from './portraits';
import { montageMoment, MONTAGE_OUT_S, MONTAGE_TAP_S } from './montage';
import { itemMoment, ITEM_OUT_S, ITEM_TAP_S } from './item';

interface Opt { id: string; label: string }
const UI = {
  phase: 'pick' as 'pick' | 'react' | 'wasted' | 'trade',
  portrait: 'boss-idle' as PortraitId,
  name: '',
  line: '',
  sub: '',
  opts: [] as Opt[],
  t: 0,
  pickI: -1,     // index of the option just chosen (-1 = none): its exit animation is playing
  pickT: 0,
  fast: false,   // not the first screen of this scene: the options come in at once (RULES 13יב, input waits ≤ 0.4 s)
  nopeT: -9,     // state.t of a tap that hit no button: the buttons twitch (RULES 13ד, a miss is answered too)
  onOpt: (_id: string): void => {},
};
const BTN_Y = [482, 534, 586], BTN_W = 320, BTN_H = 46;

let firstUI = true;   // set by each scene's enter(): its first screen keeps the staged reveal, later ones are fast
function setUI(p: Partial<typeof UI>): void { Object.assign(UI, p); UI.t = 0; UI.pickI = -1; UI.pickT = 0; UI.fast = !firstUI; firstUI = false; G.ui++; }

/** Choose option i: play the exit (others fly right, 0.3 s; a lone Continue just blinks, 0.18 s), then apply it. */
const pickDur = (): number => (UI.opts.length === 1 ? 0.3 : 0.5);
function choose(i: number): void { if (UI.pickI >= 0) return; UI.pickI = i; UI.pickT = 0; sfx.choose?.(); haptic(10); }
function stepPick(dt: number): void {
  if (UI.pickI < 0) return;
  UI.pickT += dt;
  if (UI.pickT >= pickDur()) { const id = UI.opts[UI.pickI]!.id; UI.pickI = -1; UI.onOpt(id); }
}

function grayWorld(dim = 0.35): void { renderWorld([], true); grayOut(view.x0, -view.top, view.fullW, view.H, dim); }

// The picture and the line come first; the options are revealed one by one after a beat (a lone Continue sooner).
// That staged reveal is only for a scene's first screen, and a tap finishes it at once. Every later screen (a reaction,
// a refused trade-in, the boss again) has its options ready within 0.4 s.
// doubled 2026-11-17 (Nadav: the reveal was too fast); later screens stay ready in ~0.5 s
const OPT_GAP = 0.6, FAST_AT = 0.16, FAST_GAP = 0.1, READY_PAD = 0.3, FAST_PAD = 0.1, OPT_IN_S = 0.44, PANEL_IN_S = 0.44;
const optAt = (i: number): number => (UI.fast ? FAST_AT + i * FAST_GAP : (UI.opts.length === 1 ? 0.6 : 1.0) + i * OPT_GAP);
const readyAt = (): number => optAt(UI.opts.length - 1) + (UI.fast ? FAST_PAD : READY_PAD);
const optsReady = (): boolean => UI.t > readyAt();

// Wide canvas (tablet on its side, desktop): the portrait grows and moves left, the line and the options sit to its
// right, so the conversation uses the screen instead of a phone column. Offsets are from the column layout.
const WIDE_MIN = 760;
const lay = (): { px: number; py: number; ps: number; tx: number; ty: number } =>
  (view.fullW >= WIDE_MIN ? { px: -200, py: 125, ps: 1.6, tx: 190, ty: -120 } : { px: 0, py: 0, ps: 1, tx: 0, ty: 0 });

function drawDecision(): void {
  grayWorld();
  const L = lay();
  // entry: the portrait drops in when the scene opens (G.t), and pops a little on every new line (UI.t);
  // the speech panel slides in from the left and the buttons rise one after another
  const drop = easeOB(Math.min(1, G.t / 0.6)), grow = easeOB(Math.min(1, UI.t * 2.5));
  ctx.save(); ctx.translate(L.px, L.py); ctx.translate(W / 2, 220); ctx.scale(L.ps, L.ps); ctx.translate(-W / 2, -220);   // portrait + name tag
  ctx.save(); ctx.translate(0, (drop - 1) * 420);
  ctx.translate(W / 2, 192); ctx.scale(0.94 + 0.06 * grow, 0.94 + 0.06 * grow); ctx.translate(-W / 2, -192);
  drawPortrait(UI.portrait, 73, 78, 214);   // under the timeline strip
  ctx.restore();
  const tag = easeOB(Math.min(1, Math.max(0, G.t - 0.45) / 0.4));
  if (tag > 0) { ctx.save(); ctx.translate(93, 364); ctx.scale(tag, tag); ctx.translate(-93, -364); rr(40, 352, 106, 24, 4, '#0e0e10', C.pink, 2); ptxt(UI.name, 93, 364, 1, C.pink); ctx.restore(); }
  ctx.restore();
  ctx.save(); ctx.translate(L.tx, L.ty);   // speech panel + options
  // speech panel
  const sp = Math.min(1, UI.t / PANEL_IN_S);
  ctx.save(); ctx.globalAlpha = sp; ctx.translate((easeOB(sp) - 1) * 60, 0);
  rr(16, 384, W - 32, 74, 12, 'rgba(14,14,16,.92)', 'rgba(255,255,255,.18)', 1.5);
  const lines = wrap(UI.line, 14, W - 56, 900).slice(0, 3);
  const y0 = 421 - ((lines.length - 1) * 19) / 2 - (UI.sub ? 8 : 0);
  lines.forEach((l, i) => txt(l, W / 2, y0 + i * 19, 14, '#fff', 'center', 900));
  if (UI.sub) txt(UI.sub, W / 2, y0 + lines.length * 19 + 2, 12, C.money, 'center', 900);
  ctx.restore();
  // options (or Continue)
  const ready = optsReady(), nope = state.t - UI.nopeT, twitch = nope >= 0 && nope < 0.4 ? springOut(nope, 5, 40, 10) : 0;
  UI.opts.forEach((o, i) => {
    const bk = Math.min(1, Math.max(0, UI.t - optAt(i)) / OPT_IN_S);
    if (bk <= 0) return;
    ctx.globalAlpha = (ready ? 1 : 0.4) * bk;
    const y = BTN_Y[UI.opts.length === 1 ? 1 : i]! + (1 - easeOB(bk)) * 30;
    // exit: the chosen option turns solid yellow and pops; the others fly off to the right, top one first
    const picked = UI.pickI === i, leaving = UI.pickI >= 0 && !picked;
    const fly = leaving ? Math.min(1, Math.max(0, UI.pickT - 0.05 * i) / 0.4) : 0;
    const solid = o.id === 'continue' || picked;
    ctx.save(); ctx.translate(twitch, 0);
    if (leaving) { ctx.globalAlpha *= 1 - fly; ctx.translate(fly * fly * (W + 60), 0); ctx.translate(W / 2, y); ctx.rotate(fly * 0.12); ctx.translate(-W / 2, -y); }
    if (picked) { const pk = 1 + 0.06 * Math.sin(Math.min(1, UI.pickT / 0.35) * Math.PI); ctx.translate(W / 2, y); ctx.scale(pk, pk); ctx.translate(-W / 2, -y); }
    rr(W / 2 - BTN_W / 2, y - BTN_H / 2, BTN_W, BTN_H, 10, solid ? C.pink : '#18181b', solid ? undefined : C.pink, 2);
    const fs = o.label.length > 32 ? 13 : 15;
    txt(o.label, W / 2, y + 1, fs, solid ? '#0e0e10' : '#fff', 'center', 900);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
  ctx.restore();
  topTimeline();
}

/** The story timeline on a dark strip along the top edge (gray scenes and the PC). */
function topTimeline(): void { ctx.fillStyle = 'rgba(14,14,16,.92)'; ctx.fillRect(view.x0, -view.top, view.fullW, view.top + TOP_H); ctx.fillStyle = C.pink; ctx.fillRect(view.x0, TOP_H, view.fullW, 2); timeline(TOP_H - 24); }
const TOP_H = 68;   // bottom of that strip (the timeline's line is 24 above it)

function decisionTaps(): void {
  if (UI.pickI >= 0) { input.taps.length = 0; return; }
  // a tap during the staged reveal finishes it (all the options are there and live at once); it does not pick one
  if (!optsReady()) { if (input.taps.length && UI.opts.length) { UI.t = readyAt(); sfx.tick?.(); } input.taps.length = 0; return; }
  for (const p of input.taps.splice(0)) {
    if (p.key) { if (UI.opts.length === 1) choose(0); return; }
    for (let i = 0; i < UI.opts.length; i++) {
      const y = BTN_Y[UI.opts.length === 1 ? 1 : i]!;
      if (inBtn(p, W / 2 + lay().tx, y + lay().ty, BTN_W, BTN_H, 3)) { choose(i); return; }
    }
    if (UI.opts.length) UI.nopeT = state.t;   // tapped beside the buttons: they twitch
  }
}
function decisionKey(e: KeyboardEvent): boolean {
  const n = Number(e.key);
  if (!optsReady() && n >= 1 && n <= UI.opts.length) { UI.t = readyAt(); sfx.tick?.(); return true; }   // like a tap: a key during the reveal finishes it
  if (optsReady() && n >= 1 && n <= UI.opts.length) { choose(n - 1); return true; }
  return false;
}
const CONTINUE: Opt = { id: 'continue', label: LABELS.continue };

// ---------- the montage moment: a conversation is over, its character fades into the montage (montage.ts) ----------
const MT = { t: -1, out: -1, who: 'boss' as Who, then: (): void => {} };   // t / out: seconds since it started / since the tap (-1 = not running)
function meet(who: Who, then: () => void): void {
  if (!G.met.includes(who)) G.met.push(who);
  MT.t = 0; MT.out = -1; MT.who = who; MT.then = then; sfx.letter?.(); haptic(15);
}
/** One step of the montage moment. True while it is up (the scene under it does nothing). */
function stepMontage(dt: number): boolean {
  if (MT.t < 0) return false;
  MT.t += dt;
  const tapped = input.taps.length > 0; input.taps.length = 0;
  if (MT.out >= 0) { MT.out += dt; if (MT.out >= MONTAGE_OUT_S) { MT.t = -1; MT.then(); } }
  else if (tapped && MT.t > MONTAGE_TAP_S) { MT.out = 0; sfx.tick?.(); }
  return true;
}
function drawMontageMoment(): void { if (MT.t >= 0) montageMoment(MT.t, MT.out, MT.who, G.met); }

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
      if (id === 'quit') { UI.sub = `Last paycheck: -$${G.money}`; G.money = 0; } else { UI.sub = ''; }
      const sub = UI.sub;
      setUI({ phase: 'react', portrait: id === 'sick' ? 'boss-sick' : 'boss-quit', line: BOSS.react[id], sub, opts: [CONTINUE] });
      UI.onOpt = () => meet('boss', stageDone);
    }
  };
}
registerStage('boss', {
  enter() { D.goal = null; firstUI = true; MT.t = -1; bossPick(); },
  step(dt) {
    if (stepMontage(dt)) return;
    UI.t += dt; stepPick(dt);
    if (UI.phase === 'react' && UI.portrait === 'boss-agree' && UI.t > 1.8) { UI.phase = 'wasted'; UI.t = 0; sfx.wasted?.(); }
    if (UI.phase === 'wasted') { if (UI.t > 0.9 && input.taps.length) { input.taps.length = 0; G.agreed = true; bossPick(); } else input.taps.length = 0; return; }
    decisionTaps();
  },
  render() {
    drawDecision();
    if (UI.phase === 'wasted') wastedOverlay(BOSS.wasted, BOSS.wastedSub, UI.t);
    drawMontageMoment();
  },
  key: (e) => (MT.t >= 0 ? false : decisionKey(e)),
});

/** The in-scene WASTED card (agreeing with the boss). Our own pixel font, a plain word. */
export function wastedOverlay(line: string, sub: string, t: number): void {
  const k = Math.min(1, t * 3);
  ctx.save();
  ctx.globalAlpha = k; grayOut(view.x0, -view.top, view.fullW, view.H, 0.75);
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(view.x0, -view.top, view.fullW, view.H);   // the scene's name tag and line sit right under the card's text: push them back
  const sc = 2.6 - 1.6 * easeOB(Math.min(1, t / 0.3));   // slams down from big, dips under its size and settles
  ctx.translate(W / 2, 250); ctx.scale(sc, sc);
  ptxt('WASTED', 0, 0, 8, '#e8e8e8', 'center', '#000');
  ctx.restore();
  ctx.globalAlpha = k;
  const lines = wrap(line, 16, W - 60, 900);
  for (const [i, l] of lines.entries()) txt(l, W / 2, 316 + i * 22, 16, '#fff', 'center', 900);
  txt(sub, W / 2, 316 + lines.length * 22 + 4, 13, '#cfcfcf', 'center', 700);
  if (t > 0.9 && Math.sin(t * 5) > -0.2) txt(R.strs.tapToContinue, W / 2, 600, 13, '#cfcfcf', 'center', 700);
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
      UI.onOpt = () => meet('clerk', gotItem);
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
      UI.onOpt = () => meet('clerk', gotItem);
    } else { G.traded.push(item); tradeMenu(CLERK.tradeReact[item]); }
  };
}
// The game is yours: first the clerk joins the montage, then the ITEM ACQUIRED moment (item.ts) plays over the scene, a tap sends the case to the HUD and
// the next stage starts.
const IT = { t: -1, out: -1 };   // seconds since the moment started / since the tap (-1 = not running)
function gotItem(): void { IT.t = 0; IT.out = -1; sfx.item?.(); R.flash(0.35); haptic([20, 40, 60]); }
registerStage('clerk', {
  enter() { D.goal = null; firstUI = true; MT.t = -1; IT.t = -1; IT.out = -1; clerkPick(); },
  step(dt) {
    if (stepMontage(dt)) return;
    if (IT.t >= 0) {
      IT.t += dt;
      const tapped = input.taps.length > 0; input.taps.length = 0;
      if (IT.out >= 0) { IT.out += dt; if (IT.out >= ITEM_OUT_S) { IT.t = -1; stageDone(); } }
      else if (tapped && IT.t > ITEM_TAP_S) { IT.out = 0; sfx.tick?.(); }
      return;
    }
    UI.t += dt; stepPick(dt); decisionTaps();
  },
  render() { drawDecision(); if (IT.t >= 0 && G.store) itemMoment(IT.t, IT.out, G.store); drawMontageMoment(); },
  key: (e) => (IT.t >= 0 || MT.t >= 0 ? false : decisionKey(e)),
});

// ---------- fiancée ----------
const HONESTY_BONUS = 300;        // asking honestly before trying anything else
let schemes: string[] = [];       // what you already tried on her in this visit (those options are gone)
function fianceePick(line: string, portrait: PortraitId): void {
  const opts = (['sneak', 'fake', 'honest'] as const).filter((i) => !schemes.includes(i)).map((i) => ({ id: i, label: FIANCEE.options[i] }));
  setUI({ phase: 'pick', portrait, name: FIANCEE.name, line, sub: '', opts });
  UI.onOpt = (id) => {
    if (id === 'sneak') { schemes.push(id); fianceePick(FIANCEE.react.sneak, 'fiancee-caught'); }
    else if (id === 'fake') {
      schemes.push(id);
      setUI({ phase: 'pick', portrait: 'fiancee-quiz', line: FIANCEE.react.fake, sub: '', opts: (['a', 'b', 'c'] as FianceeQuiz[]).map((q) => ({ id: q, label: FIANCEE.quiz[q] })) });
      UI.onOpt = (q) => fianceePick(FIANCEE.quizReact[q as FianceeQuiz], 'fiancee-caught');
    } else {
      const clean = schemes.length === 0;
      if (clean) addScore(HONESTY_BONUS);
      setUI({ phase: 'react', portrait: 'fiancee-ok', line: G.store === 'tradein' ? FIANCEE.react.honestRing : FIANCEE.react.honest, sub: clean ? FIANCEE.bonus(HONESTY_BONUS) : '', opts: [CONTINUE] });
      UI.onOpt = () => meet('fiancee', stageDone);
    }
  };
}
registerStage('fiancee', {
  enter() {
    D.goal = null; schemes = []; firstUI = true; MT.t = -1;
    if (G.store === 'tradein') fianceePick(FIANCEE.openRing, 'fiancee-ring'); else fianceePick(pick(FIANCEE.open), 'fiancee-idle');
  },
  step(dt) { if (stepMontage(dt)) return; UI.t += dt; stepPick(dt); decisionTaps(); },
  render() { drawDecision(); drawMontageMoment(); },
  key: (e) => (MT.t >= 0 ? false : decisionKey(e)),
});

// ---------- pc: the password ----------
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const KW = 32, KH = 44, KG = 3, KY = [420, 470, 520], DEL_W = 52;
const WRONG_S = 0.6;              // the wrong-password shake; typing during it starts the next try (nothing is dropped)
const PEAK_STOP_S = 0.35;         // the game's peak moment: the last letter of the password lands (RULES 13ז)
// the PC boots before the login screen (Nadav, 2026-11-17: the jump from the fiancée to the password was bare):
// monitor off → power LED → a boot logo with a spinner → the login screen fades in → the keyboard rises
const BOOT_LED_S = 0.7, BOOT_LOGO_S = 1.2, BOOT_S = 2.9, LOGIN_IN_S = 0.35;   // ×2 on 2026-11-17 (Nadav)
// pressK / pressT: the key that was just pressed (it sinks for 0.09 s) · typeT: when the last letter landed (it pops)
// okT: state.t when the password was right; the peak's zoom and letter lights run on the real clock through the hit-stop
const PCS = { typed: '', reply: '', close: '', shake: 0, ok: -1, pressK: '', pressT: -9, typeT: -9, okT: -9 };
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
/** The letters the game gives away: one more per wrong try (W, then A, S…; at most 5). They are already typed in
 *  their slots when a try starts and cannot be deleted (Nadav, 2026-11-17: he should not have to press them). */
const given = (): string => 'WASTED'.slice(0, Math.min(5, G.wrongPw));
function typeKey(k: string): void {
  if (PCS.ok >= 0) return;
  PCS.pressK = k; PCS.pressT = state.t;
  if (PCS.shake > 0) { PCS.shake = 0; PCS.typed = given(); }   // typing over the "wrong" shake: that is the next try
  if (k === 'DEL') { if (PCS.typed.length > given().length) { PCS.typed = PCS.typed.slice(0, -1); sfx.erase?.(); } return; }
  if (PCS.typed.length >= 6) return;
  PCS.typed += k; PCS.typeT = state.t; sfx.type?.(); haptic(6);
  if (PCS.typed.length === 6) submit();
}
function submit(): void {
  if (PCS.typed === 'WASTED') {
    if (G.wrongPw === 0) addScore(500);
    PCS.ok = 0; PCS.reply = ''; PCS.close = ''; sfx.pwRight?.();
    // the peak of the game: everything stops on the last letter, the biggest flash, then the letters light up
    PCS.okT = state.t; R.hitStop(PEAK_STOP_S); R.flash(0.7); haptic([30, 40, 30, 40, 140]);
    return;
  }
  haptic([40, 50, 40]);
  G.wrongPw++;
  const n = [...PCS.typed].filter((c, i) => c === 'WASTED'[i]).length;
  PCS.reply = PC.wrong[Math.min(G.wrongPw - 1, PC.wrong.length - 1)]!;
  PCS.close = PC.close(n);
  PCS.shake = WRONG_S; sfx.pwWrong?.();
}
/** The key under a tap: the nearest one in the row the finger is on, so the gaps between keys are not dead (13י). */
function keyAt(x: number, y: number): string | null {
  let best: string | null = null, bd = KW;   // at most one key-width away from a key's centre line
  for (const r of keyRects()) {
    if (Math.abs(y - r.y) > KH / 2 + 3) continue;
    const d = Math.max(0, Math.abs(x - r.x) - r.w / 2);
    if (d < bd) { bd = d; best = r.k; }
  }
  return best;
}
registerStage('pc', {
  enter() { D.goal = null; PCS.typed = given(); PCS.reply = ''; PCS.close = ''; PCS.shake = 0; PCS.ok = -1; PCS.pressT = PCS.typeT = PCS.okT = -9; },
  step(dt) {
    if (PCS.shake > 0) { PCS.shake -= dt; if (PCS.shake <= 0) PCS.typed = given(); }
    if (PCS.ok >= 0) { PCS.ok += dt; input.taps.length = 0; if (PCS.ok > 0.7) finishGame(); return; }
    if (G.t < BOOT_S) { input.taps.length = 0; return; }   // still booting
    for (const p of input.taps.splice(0)) {
      if (p.key) continue;
      const k = keyAt(p.x, p.y);
      if (k) typeKey(k);
    }
  },
  render() {
    grayWorld(0.55);
    // entry: the PC drops onto the desk, the keyboard slides up from below
    const pk = easeOB(Math.min(1, G.t / 0.4)), kk = easeOB(Math.min(1, Math.max(0, G.t - BOOT_S) / 0.35));
    const booted = G.t >= BOOT_S, login = booted ? Math.min(1, (G.t - BOOT_S) / LOGIN_IN_S) : 0;
    ctx.save(); ctx.translate(0, (pk - 1) * 380);
    // the peak: the screen pushes in a little while the letters light up one after another (real clock, state.t)
    const ok = PCS.ok >= 0, peak = ok ? state.t - PCS.okT : -1;
    if (ok) { const z = 1 + 0.08 * easeO(Math.min(1, peak / 0.5)); ctx.translate(W / 2, 186); ctx.scale(z, z); ctx.translate(-W / 2, -186); }
    // a modern desktop: thin-bezel monitor on a slim stand, a login screen over a blurred sunset wallpaper
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
    rr(18, 76, 324, 222, 12, '#121215', '#3c3c44', 2); ctx.restore();
    if (!booted) { bootScreen(G.t); rr(166, 298, 28, 18, 0, '#2a2a2f'); rr(118, 314, 124, 6, 3, '#3c3c44'); note(14, 326, 128, 34, -0.08, PC.note1); note(218, 330, 132, 40, 0.06, PC.note2); ctx.restore(); topTimeline(); return; }
    ctx.save(); ctx.globalAlpha = login;
    const wall = ctx.createLinearGradient(0, 82, 0, 292); wall.addColorStop(0, '#24103e'); wall.addColorStop(0.55, '#8a2456'); wall.addColorStop(1, '#e0702c');
    rr(24, 82, 312, 210, 7); ctx.fillStyle = wall; ctx.fill();
    rr(24, 82, 312, 210, 7, 'rgba(10,10,14,.5)');
    rr(166, 298, 28, 18, 0, '#2a2a2f'); rr(118, 314, 124, 6, 3, '#3c3c44');
    // the account: the fan's picture in a circle, then the prompt
    ctx.save(); ctx.beginPath(); ctx.arc(W / 2, 108, 17, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#3a4a8a'; ctx.fillRect(W / 2 - 17, 91, 34, 34); guy(W / 2, 108 + 54, 3);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, 108, 17, 0, Math.PI * 2); ctx.stroke();
    txt(ok ? PC.ok : PC.title, W / 2, 138, 12, ok ? C.money : '#ffffff', 'center', 800);
    // wrong: a shake that dies away instead of stopping dead
    const sx = PCS.shake > 0 ? springOut(WRONG_S - PCS.shake, 9, 42, 6) : 0, gave = PCS.shake > 0 ? 0 : given().length;   // the given letters sit in their slots in yellow (during the shake the row is still the wrong try)
    for (let i = 0; i < 6; i++) {
      const x = 58 + i * 42 + sx, lit = ok && peak > i * 0.055;
      rr(x, 152, 34, 42, 8, lit ? 'rgba(255,204,0,.25)' : 'rgba(255,255,255,.1)', PCS.shake > 0 ? C.red : lit ? C.yellow : 'rgba(255,255,255,.35)', 1.5);
      const ch = PCS.typed[i];
      if (ch) {
        // a letter pops as it lands; on the peak each one pops again as it lights
        const s = (i === PCS.typed.length - 1 ? pop(state.t - PCS.typeT, 0.12, 0.3) : 1) * (ok ? pop(peak - i * 0.055, 0.16, 0.35) : 1);
        ctx.save(); ctx.translate(x + 17, 174); ctx.scale(s, s);
        txt(ch, 0, 0, 24, PCS.shake > 0 ? C.red : lit ? '#fff6b0' : i < gave ? C.yellow : '#ffffff', 'center', 800);
        ctx.restore();
      }
      else if (i === PCS.typed.length && Math.sin(performance.now() / 160) > 0) rr(x + 9, 185, 16, 2.5, 1, '#ffffff');
    }
    if (PCS.reply) {
      // '\n' = a new line after a sentence (RULES 10א); up to three lines, the count line follows them
      const ls = PCS.reply.split('\n').flatMap((part) => wrap(part, 12, 260, 700)).slice(0, 3);
      ls.forEach((l, i) => txt(l, W / 2, 208 + i * 16, 12, '#ffffff', 'center', 700));
      txt(PCS.close, W / 2, 208 + ls.length * 16 + 4, 11, '#d6d6de', 'center', 400);
    }
    else if (PCS.ok < 0) txt(PC.hint0, W / 2, 218, 12, '#e8e8ee', 'center', 700);
    else txt(PC.okSub, W / 2, 222, 16, C.yellow, 'center', 900);
    // tip under the field: a new one every 3.5 s, fading in
    if (PCS.ok < 0 && G.wrongPw > 0) txt(PC.caughtHint, W / 2, 276, 11, C.yellow, 'center', 700);   // the real hint, from the first wrong try on
    else if (PCS.ok < 0) {
      const ti = Math.floor(G.t / 3.5), ta = Math.min(1, ((G.t / 3.5) % 1) * 6);
      ctx.globalAlpha = ta * 0.8; txt(PC.tips[ti % PC.tips.length]!, W / 2, 276, 10, '#ffffff', 'center', 400); ctx.globalAlpha = 1;
    }
    ctx.restore();   // login fade
    // sticky notes
    note(14, 326, 128, 34, -0.08, PC.note1);   // stuck to the desk, either side of the stand
    note(218, 330, 132, 40, 0.06, PC.note2);
    ctx.restore();
    // on-screen keyboard
    ctx.save(); ctx.translate(0, (1 - kk) * 300);
    for (const r of keyRects()) {
      // the key just pressed (finger or real keyboard) sinks and darkens for 0.09 s
      const down = r.k === PCS.pressK && state.t - PCS.pressT < 0.09, dy = down ? 3 : 0;
      // dark low-profile keys
      rr(r.x - r.w / 2, r.y - KH / 2 + dy, r.w, KH - dy, 7, down ? '#101013' : r.k === 'DEL' ? '#3c3c44' : '#26262b', '#4a4a54', 1.5);
      txt(r.k === 'DEL' ? '⌫' : r.k, r.x, r.y + 1 + dy, r.k === 'DEL' ? 18 : 16, '#fff', 'center', 800);
    }
    ctx.restore();
    topTimeline();
  },
  key(e) {
    if (G.t < BOOT_S) return true;   // still booting
    if (e.key === 'Backspace') { typeKey('DEL'); return true; }
    if (/^[a-z]$/.test(keyName(e))) { typeKey(keyName(e).toUpperCase()); return true; }
    if (e.key === 'Enter' || e.key === ' ') return true;
    return false;
  },
});
/** The monitor's boot: black glass with a power LED, then a small neon logo and a spinner (t = seconds in the stage). */
function bootScreen(t: number): void {
  rr(24, 82, 312, 210, 7, '#050507');
  // a CRT-style flash the moment it powers on, then the LED
  if (t < 0.12) rr(24, 82, 312, 210, 7, `rgba(255,255,255,${0.5 * (1 - t / 0.12)})`);
  const led = t > BOOT_LED_S;
  ctx.fillStyle = led ? (Math.sin(t * 9) > 0 ? C.money : '#1f6f3f') : '#2a2a2f';
  ctx.beginPath(); ctx.arc(326, 284, 2.5, 0, Math.PI * 2); ctx.fill();
  if (t < BOOT_LOGO_S) return;
  const k = Math.min(1, (t - BOOT_LOGO_S) / 0.3);
  ctx.save(); ctx.globalAlpha = k;
  ptxt('TSG', W / 2, 160, 3, C.pink, 'center');
  // spinner: eight dots, the lit one goes round
  const on = Math.floor(((t - BOOT_LOGO_S) * 10) % 8);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, d = (on - i + 8) % 8; ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.85 * (1 - d / 8)})`; ctx.beginPath(); ctx.arc(W / 2 + Math.cos(a) * 14, 214 + Math.sin(a) * 14, 2.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function note(x: number, y: number, w: number, h: number, rot: number, s: string): void {
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
  ctx.fillStyle = '#ffe96b'; ctx.fillRect(-w / 2, -h / 2, w, h);
  const ls = wrap(s, 11, w - 12, 700);
  ls.forEach((l, i) => txt(l, 0, -((ls.length - 1) * 13) / 2 + i * 13, 11, '#3a2a00', 'center', 700));
  ctx.restore();
}
