import type { SiteCtx } from '../types';
import { rail, sidebar } from './layout';

// The site's columns on a game page (desktop browsers only): /game-chrome.js, written by the site build.
// Game pages are self-contained files from common-game-code, so this script brings the columns in: the left rail
// (logo, menu, Play the new game) and the right sidebar (this game's scoreboard, Follow us, Too soon to touch).
// The game decides where they go (common-game-code src/core/canvas.ts, fit): both columns when the space beside the
// game holds them (portrait games), else the narrow icon rail only (landscape games), none on phones and tablets.
// The script only draws them and says how wide they are (window.TSG_CHROME).

/** Column widths in CSS px. They match site.css: .rail 260 (88 icon-only), .side-in 350, .timeline 600. */
export const CHROME = { rail: 260, narrow: 88, side: 350, col: 600 } as const;

/** The site.css sections the columns use, scoped under .tsgc so nothing reaches the game's own page. */
function scopedCss(siteCss: string): string {
  const section = (name: string): string => {
    const m = siteCss.match(new RegExp(`/\\* -+ ${name} -+ \\*/([\\s\\S]*?)(?=/\\* -+|$)`));
    if (!m) throw new Error(`site.css: section "${name}" not found (game-chrome.ts scopes it for the game pages)`);
    return m[1]!;
  };
  const vars = siteCss.match(/:root\{([\s\S]*?)\}/);
  if (!vars) throw new Error('site.css: :root block not found');
  const siteBg = vars[1]!.match(/--bg:([^;]+);/)?.[1];
  if (!siteBg) throw new Error('site.css: --bg not found in :root');
  // the sections are flat one-rule-per-line CSS: prefix every selector of every rule
  const prefix = (css: string) =>
    css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/([^{}]+)\{([^{}]*)\}/g, (_, sel: string, body: string) =>
      `${sel.split(',').map((s) => `.tsgc ${s.trim()}`).join(',')}{${body}}`);
  const { rail: r, narrow: n, side: s } = CHROME;
  return [
    `.tsgc{${vars[1]}}`,
    prefix(section('left rail')),
    prefix(section('right sidebar')),
    // base rules site.css sets on the whole page, here only inside the columns
    `.tsgc{position:fixed;inset:0;z-index:1;pointer-events:none;direction:ltr;text-align:left;color:var(--ink);font:15px/1.45 var(--font)}`,
    `.tsgc *,.tsgc *::before,.tsgc *::after{box-sizing:border-box}.tsgc [hidden]{display:none!important}`,
    `.tsgc a{color:inherit;text-decoration:none}.tsgc img,.tsgc svg{display:block;max-width:100%;flex:none}.tsgc h2,.tsgc p{margin:0}`,
    `.tsgc a:focus-visible{outline:2px solid var(--cyan);outline-offset:2px;border-radius:8px}`,
    // the game sets html[data-tsgc] (full | rail | none) and the two offsets
    `html:not([data-tsgc=full]):not([data-tsgc=rail]) .tsgc{display:none}`,
    `.tsgc .rail,.tsgc .side{display:block;position:absolute;top:0;bottom:0;pointer-events:auto;background:var(--bg)}`,
    `.tsgc .rail{left:var(--tsgc-l,0);width:${r}px}.tsgc .side{left:var(--tsgc-r,0);width:${s}px;overflow-y:auto;scrollbar-width:none}`,
    // the rail fills the height (its foot sits at the bottom); the sidebar is as tall as its boxes and scrolls
    `.tsgc .rail-in{position:static;height:100%}.tsgc .side-in{position:static}.tsgc .box{flex:none}`,
    // around the columns the page is the site's; the game's own colour stays behind the game
    `html[data-tsgc=full],html[data-tsgc=full] body,html[data-tsgc=rail],html[data-tsgc=rail] body{background:${siteBg}}`,
    `html[data-tsgc=full] #wrap,html[data-tsgc=rail] #wrap{background:var(--bg)}`,
    `html[data-tsgc=rail] .tsgc .side{display:none}`,
    `html[data-tsgc=rail] .tsgc .rail{width:${n}px;border-right:1px solid var(--line)}`,
    `html[data-tsgc=rail] .tsgc .brand span,html[data-tsgc=rail] .tsgc .nav a span,html[data-tsgc=rail] .tsgc .cta .lbl,html[data-tsgc=rail] .tsgc .rail-foot{display:none}`,
    `html[data-tsgc=rail] .tsgc .nav a{justify-content:center;padding:12px}`,
    `html[data-tsgc=rail] .tsgc .cta{width:56px;height:56px;margin-inline:auto}`,
  ].join('\n');
}

/** The whole /game-chrome.js. */
export function gameChromeJs(ctx: SiteCtx, siteCss: string): string {
  const html = `${rail(ctx, '')}${sidebar(ctx)}`;
  const data = { css: scopedCss(siteCss), html, api: (ctx.studio.apiBase || '').replace(/\/$/, ''), size: CHROME };
  return `// Too Soon Games: the site's columns on a game page. Built by GamesTemplate/frontend (src/components/game-chrome.ts).
(function(){
  var D=${JSON.stringify(data).replace(/</g, '\\u003c')};
  if(document.querySelector('.tsgc'))return;
  var st=document.createElement('style');st.textContent=D.css;document.head.appendChild(st);
  var f=document.createElement('link');f.rel='stylesheet';f.href='https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@500;700;800;900&display=swap';document.head.appendChild(f);
  var box=document.createElement('div');box.className='tsgc';box.innerHTML=D.html;document.body.appendChild(box);
  var all=function(sel){return Array.prototype.slice.call(box.querySelectorAll(sel));};
  // links back to the site keep the visit's UTM tags, as the site's own links do (layout.ts, carry), and say which game
  // and which part of the page sent the visit (the site's page_view from = "<game>:columns")
  var slug=location.pathname.split('/')[1]||'';
  var utm=['from='+encodeURIComponent(slug),'via=columns'];new URLSearchParams(location.search).forEach(function(v,k){if(k.indexOf('utm_')===0)utm.push(encodeURIComponent(k)+'='+encodeURIComponent(v));});
  all('a[href^="/"]').forEach(function(a){var h=a.getAttribute('href'),i=h.indexOf('#'),p=i<0?h:h.slice(0,i),x=i<0?'':h.slice(i);a.setAttribute('href',p+(p.indexOf('?')<0?'?':'&')+utm.join('&')+x);});
  // the scoreboard is this game's: the top 3, without the "Full board" link (the board is in the game)
  var side=box.querySelector('#side-board');
  if(side){side.removeAttribute('id');var more=side.querySelector('.more');if(more)more.remove();}
  if(side&&slug&&D.api){
    var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
    fetch(D.api+'/v1/games/'+encodeURIComponent(slug)+'/board?limit=3').then(function(r){return r.ok?r.json():null;}).then(function(d){
      if(!d||!d.top||!d.top.length)return;
      side.querySelector('.side-rows').innerHTML=d.top.slice(0,3).map(function(r){return '<div class="row"><span class="ic rank">'+r.rank+'</span><span class="t"><b>'+esc(r.nick||'Anonymous')+'</b><small>'+Number(r.score||0).toLocaleString('en-US')+' points</small></span></div>';}).join('');
      side.hidden=false;
    }).catch(function(){/* offline or API down: the scoreboard box stays hidden */});
  }
  window.TSG_CHROME=D.size;
  window.dispatchEvent(new Event('resize')); // the game places itself again, now with the columns (canvas.ts fit)
})();
`;
}
