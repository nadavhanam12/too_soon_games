// Every player-facing text of "Not On My Flight" (English adaptation of the Hebrew "חופשה בטוחה") (rule 10): screens, stage lines, passengers, ranks. Humor is edited here.
import { type Content, type RunResult, fmtInt, W, ctx, rr, circ, txt, clamp, lerp } from '@tsg/index';
import { bubble, suitcase, walker, person, plane, FAM, FC, DAD, MOM, BOY, GIRL } from './art';

// ---------- ranks (score roughly 1300..9000) ----------
const RANKS: Array<[number, string]> = [
  [8000, "Hero of Flight FZ1073"], [7400, "Row 1 Legend"], [6800, "Off-Duty Soldier, Aisle Seat"], [6200, "Charter-Flight Dad"],
  [5600, "The Dentist"], [5000, "Played Flight Simulator Once"], [4300, "Stood Up Before the Seatbelt Sign"], [3600, "Uncle Who Claps on Landing"],
  [2800, "Grandma With the Carry-On Kugel"], [-1, "Prayed Very Loudly"],
];
export const rankFor = (sc: number): string => RANKS.find((r) => sc > r[0])![1];

// ---------- in-stage lines ----------
export const LINES = {
  hit: ["Told you not to buy that suitcase at the market", "Who brings 3 suitcases on a 3-hour flight?", "Is that from duty free? Seriously?", "A carry-on! Why isn't it in the hold?!", "Bro, that's the whole family's shopping", "Exactly 50 pounds. Weighed it at home", "That's my aunt's bag. She'll kill me", "There was hummus in there. WAS hummus", "This bag cost more than the ticket", "Who packs an iron for Dubai?!", "Oops, that's the flight attendant's", "Samsonite! At least it's quality"],
  bump: ["Sorry, sorry!", "Where are you running?!", "Ouch, buddy"],
  pass: ["Oh my God!!", "Is there a doctor on board?", "I'm a dentist!", "What's happening?!", "Mom, I don't wanna die", "Use the seatbelt!", "Should've flown El Al", "Bring water!", "This was NOT in the brochure", "Is there a pilot here?", "I'm from Russia, I'm a pilot!", "Film it, film it!", "I'm live, move!", "My duty free!!", "Tell Michelle I loved her", "I have miles! Let's talk", "Who's flying? The steward?!", "I haven't even eaten yet", "A $12 sandwich and now THIS?", "My mom was right about this flight", "El Al would charge extra for this", "I'm just going to the bathroom!", "Where's the exit? Is there an exit?", "Relax, it's just turbulence. Right?", "My husband is asleep. HOW is he asleep?!", "Has anyone seen my shoe?"],
  punch: ["That's for the sandwich!", "That's for the $40 seat fee!", "Dad combo!", "Hold him!", "Another one!"],
  punchFx: ["BOOM!", "WHAM!", "POW!", "KA-BOOM!"],
  stew: [["Sir! Sit down! Tray table up!", "Sir, the PLANE dives. Not you!"], ["Sir, seat upright!", "I'm calling the captain!", "...the captain was just stabbed."], ["Sir, there's a line for the toilet!", "Fine, go. But no carry-on."]],
  trolley: ["Hold on, getting my falafel out of the bag", "Bro, there's a line. I want the cockpit too", "OK OK, moving. But this bag was $100", "Yalla, he's moving!"],
  door: ["The door is locked! Who knows the code?", "No, it's not 1234, we tried", "Attendant: turn it till it clicks!"],
  doorClick: ["Click!", "One more!", "Three!", "Almost!", "It's open!!"],
  doorMiss: ["No! That's not the code!", "Attendant: more precise!", "Breathe, then tap"],
  turb: ["Turbulence!!", "We're diving, hold on!", "Oh, my stomach"],
  captain: ["If this is about the coffee, I'm sorry", "Tell my wife I landed fine", "I gave him the window seat, and still...", "Remember: the shield is in the middle", "Why is everyone running? It's only stage 3"],
  blocked: ["Blocked! Now hit him!", "Dad hands!", "Just like that"],
  calmed: ["He's calm. Keep wrapping!", "Got him! Quick!", "That's it. Now the cable."],
  loop: ["Loop!", "Another loop!", "Like that!", "Since when do planes have wired headphones?"],
  flyShout: ["Ukrainian pilot, row 12: PULL UP!!", "Girl, 8: Mom, are we falling?", "Code 7500 sent. Saudi F-15s on the way.", "The Russian: davai, davai!"],
  bibi: ["This flight is a total victory. Partly mine.", "New rule: every Dubai flight gets headphones.", "Shimshon, a cabinet seat is free. No pressure."],
};

/** Stage banners: title + three lines, shown by the template (pauses until a tap). */
export const BANNERS = {
  run: ["Stage 1: To the cockpit!", ["32 rows to the door.", "Swipe left / right to dodge", "falling suitcases and panicking people."]],
  door: ["Stage 2: Locked door", ["First: a guy with a bag blocks the door.", "Tap him 3 times to push him away.", "Then: tap when the needle is green."]],
  cockpit: ["Stage 3: The cockpit", ["Tap the hands = punches.", "Knife up and the screen turns red?", "tap the shield. That's it."]],
  tie: ["Stage 4: Tie him up", ["Tap \"Wrap!\" in rhythm, not too fast:", "every tap wraps one loop of cable.", "When he thrashes: press and hold \"Hold!\"."]],
  fly: ["Stage 5: Level the plane", ["The plane is diving. The circle is the horizon.", "Drag up = nose up. Sideways = level wings.", "Line in the frame, hold for 8 seconds."]],
} as const satisfies Record<string, readonly [string, readonly string[]]>;

export const STAGE_NAMES: Record<string, string> = { run: "The aisle", door: "The door", cockpit: "The cockpit", tie: "The tie-up", tied: "The tie-up", fly: "The recovery" };

// ---------- cutscene drawings (y 0..450; the caption panel sits below) ----------
const DOOR = { x: 158, y: 262 };
function apron(st: number, boarding: boolean): void {
  const g = ctx.createLinearGradient(0, 0, 0, 450); g.addColorStop(0, '#ff9a3c'); g.addColorStop(0.72, '#ffd08a'); g.addColorStop(0.73, '#8a8f99'); g.addColorStop(1, '#6e737c'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 450);
  circ(80, 120, 34, '#ffe9a8');
  ctx.fillStyle = 'rgba(120,60,20,.35)';
  ([[20, 60, 300], [70, 30, 270], [110, 22, 240], [150, 50, 220], [210, 18, 200], [240, 40, 250], [290, 26, 280], [330, 50, 260]] as number[][]).forEach(([x, w, top]) => ctx.fillRect(x!, top!, w!, 360 - top!));
  rr(0, 350, W, 10, 0, '#4f545c');
  plane(330, 250, 1.6);
  ctx.fillStyle = '#8a939e'; ctx.beginPath(); ctx.moveTo(110, 352); ctx.lineTo(150, 262); ctx.lineTo(182, 262); ctx.lineTo(160, 352); ctx.fill();
  rr(146, 228, 22, 40, 4, '#1b2a44');
  const queue: Array<[number, number, Parameters<typeof walker>[2]]> = [[120, 338, { shirt: '#c8102e', hair: '#222' }], [135, 312, { shirt: '#ffffff', hair: '#c9a15a', longhair: true }], [150, 286, { shirt: '#3ddc84', hair: '#111' }]];
  queue.forEach(([x, y, o], i) => {
    let px = x, py = y, walk = false;
    if (boarding) { const k = clamp((st - i * 0.45) / 1.1, 0, 1); if (k >= 1) return; px = lerp(x, DOOR.x, k); py = lerp(y, DOOR.y, k); walk = true; }
    walker(px, py, { ...o, sc: 1.05, walk, back: true }, st);
  });
  const order = [{ dx: -88, dy: 8, o: { ...GIRL, sc: 0.75 } }, { dx: -66, dy: 8, o: { ...BOY, sc: 0.8 } }, { dx: -38, dy: 0, o: { ...MOM, sc: 1.2 } }, { dx: 0, dy: 0, o: { ...DAD, sc: 1.25 } }];
  const base = boarding ? 90 : Math.min(90, -40 + st * 42);
  const pos: Array<[number, number] | null> = [];
  order.forEach((m, i) => {
    let x = base + m.dx, y = 338 + m.dy, walk = base < 90;
    if (boarding) { const k = clamp((st - 1.2 - i * 0.9) / 1.6, 0, 1); if (k >= 1) { pos.push(null); return; } x = lerp(base + m.dx, DOOR.x, k); y = lerp(338 + m.dy, DOOR.y, k) + Math.sin(k * Math.PI) * -8; walk = true; }
    if (i === 3) suitcase(x - 22, y - 8, 20, 26, '#222');
    pos.push([x, y]); walker(x, y, { ...m.o, walk, back: boarding }, st);
  });
  if (!boarding) {
    const line: Array<[number, string, number]> = [[1, "Dad, one more day in Dubai?", 0.8], [2, "Did you take the passports?", 3.0], [3, "Yes, yes, I have everything.", 5.0]];
    for (const [who, s2, tt] of line) { const p = pos[who]; if (st > tt && st < tt + 2.2 && p) { const hy = p[1] - (who < 2 ? 26 : 34); bubble(s2, p[0], hy - 34, 12, '#fff', '#111', p[0], hy - 4); } }
  } else if (st < 2.4 && pos[3]) { const [fx, fy] = pos[3]!; bubble("Go on, I'm last with the bag. Yalla, home!", fx, fy - 72, 12, '#2f6fdd', '#fff', fx, fy - 40); }
}
function cabin(st: number, chaos: boolean, heavy: boolean): void { // the cabin shake uses Math.random: drawing jitter only, not gameplay
  ctx.save(); if (chaos && heavy) ctx.translate((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
  ctx.fillStyle = '#e9eef3'; ctx.fillRect(-10, -10, W + 20, 470);
  rr(-10, 60, W + 20, 90, 0, '#cfd8e2'); for (let i = 0; i < 4; i++) rr(i * 95 - 5, 70, 88, 70, 8, '#dfe6ee');
  for (let i = 0; i < 4; i++) { rr(i * 95 + 20, 180, 50, 66, 22, '#8fd3ff'); ctx.strokeStyle = '#b8c4d0'; ctx.lineWidth = 4; ctx.strokeRect(i * 95 + 20, 180, 50, 66); }
  for (let i = 0; i < 3; i++) { const x = 40 + i * 110; rr(x + 6, 250, 68, 70, 10, '#223055'); }
  person(75, 262, { sc: 0.9, shirt: '#c8102e', hair: '#222' }); person(190, 262, { sc: 0.9, shirt: '#ffffff', hair: '#c9a15a' }); person(300, 262, { sc: 0.9, shirt: '#ffb400', hair: false });
  for (let i = 0; i < 3; i++) { const x = 40 + i * 110; rr(x, 330, 80, 140, 12, '#2c3e68'); rr(x - 6, 400, 92, 60, 10, '#243357'); rr(x + 10, 460, 60, 30, 6, '#1a2540'); }
  person(70, 400, { ...BOY, sc: 1.1 }); person(100, 402, { ...GIRL, sc: 1.0 }); circ(108, 372, 4, '#ff5fa2');
  person(190, 395, { ...DAD, sc: 1.6 });
  walker(300, 395, { ...MOM, sc: 1.5 }, 0);
  rr(160, 455, 60, 8, 3, '#8a6d3b'); rr(172, 447, 36, 9, 4, '#f1d38b');
  ctx.restore();
  if (chaos) { ctx.fillStyle = `rgba(255,40,40,${(heavy ? 0.22 : 0.12) + Math.sin(st * 20) * 0.06})`; ctx.fillRect(0, 0, W, 470); }
}

export const content: Content = {
  title: {
    heading: "Not On My Flight",
    lines: [`You are ${FAM.dad},`, `a dad flying home from vacation with your wife ${FAM.mom} and the kids, ${FAM.boy} (8) and ${FAM.girl} (6).`, "You have no idea what's about to happen."],
    credit: "Based on true events · Too Soon Games",
  },
  cutscene: {
    button: "Not on my flight!",
    steps: [
      { dur: 7.5, speaker: "Dubai, 06:40. End of vacation.", text: "The family in line. The kids are already fighting over the window.", draw: (st) => apron(st, false) },
      { dur: 5.6, speaker: "Boarding", text: "You're last, with the suitcase. Yalla, home.", draw: (st) => apron(st, true), sfx: 'ok' },
      { dur: 0, speaker: "32C. Quiet. 08:35, over Jordan", text: `${FAM.boy}: Dad, why didn't we fly El Al?\nYou: Because here the sandwich is only $12.`,
        draw: (st) => { cabin(st, false, false); bubble("Finally seated. Home in two hours.", 190, 300, 13, '#2f6fdd', '#fff', 190, 360); } },
      { dur: 4.4, speaker: "Screams from the cockpit!!", text: "The plane is going down, help!", sfx: 'hit',
        draw: (st) => { cabin(st, true, st > 2.2); bubble(st < 2.2 ? "Screaming in the cockpit!!" : "The plane is going down, help!", st < 2.2 ? W - 100 : 100, 300, 14, '#ff3b3b', '#fff', st < 2.2 ? W - 8 : 8, 330); } },
      { dur: 0, speaker: "The kids are looking at you.", text: `${FAM.girl}: Dad... are we going to die?\n${FAM.boy}: Dad, do something!!`, sfx: 'bad',
        draw: (st) => { cabin(st, true, true); bubble(`${FAM.girl}: Dad... are we going to die?`, 110, 300, 13, '#fff', '#c8102e', 100, 368, FC.girl); } },
    ],
  },
  lose: { heading: "Altitude 0.", line: "You didn't make it. The plane hit the ground.", consolation: "(In real life they made it. So will you.)" },
  result: {
    heading: () => "Hero of the Flight",
    sentence: (r) => `174 people saved. One whole family. Rank: "${rankFor(r.score)}"`,
    rankFor,
    resultWords: (r: RunResult) => fmtInt(r.score),
  },
  board: { heading: "Flight Heroes", sub: "Who saved the 174 passengers with the highest score" },
  facts: {
    heading: "What really happened",
    sub: "Flydubai flight FZ1073, Sept 30, 2026",
    lines: [
      { text: "Mid-flight, the first officer stabbed the captain and, Israel says, tried to crash the plane." },
      { text: "The wounded captain opened the cockpit door. Passengers rushed in and tied the attacker up with corded headphones.", bold: true },
      { text: "A dentist among the passengers stopped the captain's bleeding." },
      { text: "The plane dropped about 17,000 ft in under two minutes, squawked hijack code 7500 and landed safely in Tabuk, Saudi Arabia.", bold: true },
      { text: "174 people were on board. A replacement plane flew them home to Tel Aviv that evening." },
      { text: "The investigation is ongoing. Names in the game are made up." },
    ],
    disclaimer: "No Buzaglo-Sternlichts were on board. 174 others were.",
  },
  community: { heading: "Not over yet!", sub: "Enjoyed it? Challenge a friend, and be first to play our next game." },
};
