import type { SiteCtx } from '../types';
import { esc, attr, join, shortTime } from './html';
import { icons } from './icons';
import { defaultFeatured, gameUrl, studioHandle } from './games';

// Timeline layout (DECISIONS 83): left rail, center column, right sidebar on wide screens;
// icon rail on tablets; top bar, bottom nav and a floating Play button on phones.

export interface PageMeta {
  title: string; // "Privacy" → "<title>Privacy · Too Soon Games</title>"
  description: string;
  path: string; // "/privacy/"
  home?: boolean;
  extraHead?: string;
  bodyClass?: string;
  /** Extra row under the column title (the home tabs). */
  subhead?: string;
}

type NavKey = 'home' | 'games' | 'board' | 'about';

export function layout(ctx: SiteCtx, meta: PageMeta, body: string): string {
  const { studio } = ctx;
  const fullTitle = meta.home ? `${studio.name} · ${studio.tagline.split('.')[0]}` : `${meta.title} · ${studio.name}`;
  const url = ctx.base + meta.path;
  const beacon = studio.cfWebAnalyticsToken
    ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${attr(studio.cfWebAnalyticsToken)}"}'></script>`
    : '';
  const current: NavKey | '' = meta.home ? 'home' : meta.path === '/about/' ? 'about' : '';
  const data = JSON.stringify({ apiBase: studio.apiBase || '', slugs: ctx.games.map((g) => g.slug) });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${attr(meta.description)}">
<link rel="canonical" href="${attr(url)}">
<meta name="theme-color" content="#100e1a">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${attr(studio.name)}">
<meta property="og:title" content="${attr(fullTitle)}">
<meta property="og:description" content="${attr(meta.description)}">
<meta property="og:url" content="${attr(url)}">
<meta property="og:image" content="${attr(ctx.base)}/assets/og.svg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/icon-192.svg">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@500;700;800;900&display=swap">
<link rel="stylesheet" href="${attr(ctx.cssHref)}">
${meta.extraHead ?? ''}
${beacon}
</head>
<body class="${attr(meta.bodyClass ?? '')}">
<a class="skip" href="#main">Skip to content</a>
<div class="shell">
${rail(ctx, current)}
<main id="main" class="timeline">
${columnHead(ctx, meta)}
${body}
${columnFoot(ctx)}
</main>
${sidebar(ctx)}
</div>
${phoneNav(ctx, current)}
<script type="application/json" id="site-data">${data.replace(/</g, '\\u003c')}</script>
<script>${CLIENT_JS}</script>
</body>
</html>
`;
}

const logoImg = (alt: string) => `<img src="/assets/logo.png" alt="${attr(alt)}" width="360" height="352">`;

function navLinks(ctx: SiteCtx, current: NavKey | '', withLabels: boolean): string {
  const lead = defaultFeatured(ctx.games);
  const items: [NavKey, string, string, string][] = [
    ['home', '/', 'Home', icons.home],
    ['games', '/#games', 'Games', icons.pad],
    ...(lead ? ([['board', `${gameUrl(lead)}#board`, 'Scoreboard', icons.trophy]] as [NavKey, string, string, string][]) : []),
    ['about', '/about/', 'About', icons.info],
  ];
  return items
    .map(([key, href, label, icon]) => `<a href="${attr(href)}"${key === current ? ' aria-current="page"' : ''}${withLabels ? '' : ` aria-label="${label}"`}${key === 'games' ? ' data-tab="games"' : ''}>${icon}${withLabels ? `<span>${label}</span>` : ''}</a>`)
    .join('');
}

export function rail(ctx: SiteCtx, current: NavKey | ''): string {
  const lead = defaultFeatured(ctx.games);
  return `<aside class="rail" aria-label="Site">
  <div class="rail-in">
    <a class="brand" href="/" aria-label="${attr(ctx.studio.name)} home">${logoImg('')}<span>${esc(ctx.studio.name)}</span></a>
    <nav class="nav" aria-label="Main">${navLinks(ctx, current, true)}</nav>
    ${lead ? `<a class="cta" href="${attr(gameUrl(lead))}" aria-label="Play the new game">${icons.play}<span class="lbl">Play the new game</span></a>` : ''}
    <p class="rail-foot">${esc(ctx.studio.tagline)}</p>
  </div>
</aside>`;
}

/** Sticky head of the center column: the logo bar on phones, the page title on wider screens, then the optional subhead (tabs). */
function columnHead(ctx: SiteCtx, meta: PageMeta): string {
  const back = meta.home ? '' : `<a class="back" href="/" aria-label="Back to the games">${icons.back}</a>`;
  return `<div class="thead">
  <div class="mtop"><a href="/" aria-label="${attr(ctx.studio.name)} home">${logoImg(ctx.studio.name)}</a><span class="live"><i aria-hidden="true"></i>Live</span></div>
  <div class="dtitle">${back}<span>${esc(meta.home ? 'Home' : meta.title)}</span></div>
  ${meta.subhead ?? ''}
</div>`;
}

/** The studio's four main networks: always shown (decision 80). Dimmed and not clickable until studio.json has the link. */
const MAIN_NETWORKS = [
  ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'],
  ['x', 'X'],
  ['facebook', 'Facebook'],
] as const;
/** Extra networks: shown only once they have a link. */
const EXTRA_NETWORKS = [['youtube', 'YouTube']] as const;

function networks(ctx: SiteCtx): { key: keyof typeof icons; label: string; href: string }[] {
  const s = ctx.studio as unknown as Record<string, string>;
  const link = (key: string) => (s[key] || '').trim();
  return [
    ...MAIN_NETWORKS.map(([key, label]) => ({ key, label, href: link(key) })),
    ...EXTRA_NETWORKS.filter(([key]) => link(key)).map(([key, label]) => ({ key, label, href: link(key) })),
  ];
}

/**
 * The account's own name on a network, from its address: the handle differs between networks ("@TooSoonGamesHQ" on X,
 * "@toosoongames" on TikTok), and an address without a handle (facebook.com/profile.php?id=...) shows the studio's name.
 */
function networkHandle(href: string, studioName: string): string {
  // a handle is an address with exactly one path part (x.com/Name, tiktok.com/@name); anything longer or with a file
  // name in it (youtube.com/channel/UC..., facebook.com/profile.php) is an id, not a name people know
  const parts = new URL(href).pathname.split('/').filter(Boolean);
  return parts.length !== 1 || parts[0]!.includes('.') ? studioName : '@' + parts[0]!.replace(/^@/, '');
}

/** Compact network buttons (the follow prompt on top of the home timeline). */
export function netButtons(ctx: SiteCtx): string {
  return networks(ctx)
    .map(({ key, label, href }) =>
      href
        ? `<a class="net" href="${attr(href)}" target="_blank" rel="noopener" aria-label="${label}" data-network="${key}">${icons[key]}<span>Follow</span></a>`
        : `<span class="net net-soon" role="img" aria-label="${label} (coming soon)" data-network="${key}">${icons[key]}</span>`,
    )
    .join('');
}

const LEGAL = `<a href="/about/">About</a> · <a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · <a href="/contact/">Contact</a> · <a href="/accessibility/">Accessibility</a>`;
const copyright = (ctx: SiteCtx) => `© ${new Date().getUTCFullYear()} ${esc(ctx.studio.name)}. Parody. Not affiliated with the real people or organizations.`;

export function sidebar(ctx: SiteCtx): string {
  const lead = defaultFeatured(ctx.games);
  const handle = studioHandle(ctx.studio.name);
  const follow = networks(ctx)
    .map(({ key, label, href }) => `<div class="row"><span class="ic">${icons[key]}</span><span class="t"><b>${label}</b><small>${esc(href ? networkHandle(href, ctx.studio.name) : handle)}</small></span>${href ? `<a class="btn-sm" href="${attr(href)}" target="_blank" rel="noopener" aria-label="Follow us on ${label}" data-network="${key}">Follow</a>` : '<span class="btn-sm" aria-disabled="true">Soon</span>'}</div>`)
    .join('');
  const events = [...ctx.events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return `<aside class="side" aria-label="More">
  <div class="side-in">
    ${lead ? `<section class="box" id="side-board" data-slug="${attr(lead.slug)}" hidden>
      <h2>Live scoreboard</h2>
      <div class="side-rows"></div>
      <a class="row more" href="${attr(gameUrl(lead))}#board">Full board: <span dir="auto">${esc(lead.title)}</span></a>
    </section>` : ''}
    <section class="box">
      <h2>Follow us</h2>
      <p class="box-note">Be the first to play the next viral game.</p>
      ${follow}
    </section>
    ${events.length ? `<section class="box">
      <h2>Too soon to touch</h2>
      ${events.map((e) => `<div class="trend"><small><time datetime="${attr(e.date)}" data-rel>${esc(shortTime(e.date))}</time> · Too soon even for us</small><b>${esc(e.text)}</b></div>`).join('')}
    </section>` : ''}
    <p class="side-foot">${LEGAL}<br>${copyright(ctx)}</p>
  </div>
</aside>`;
}

/** Legal links at the bottom of the column: the sidebar that holds them is hidden below 1100px. */
function columnFoot(ctx: SiteCtx): string {
  return `<footer class="col-foot"><p>${LEGAL}</p><p>${copyright(ctx)}</p></footer>`;
}

function phoneNav(ctx: SiteCtx, current: NavKey | ''): string {
  const lead = defaultFeatured(ctx.games);
  return join(
    `<nav class="bnav" aria-label="Site">${navLinks(ctx, current, false)}</nav>`,
    lead && `<a class="fab" href="${attr(gameUrl(lead))}" aria-label="Play the new game">${icons.play}</a>`,
  );
}

// Runs on every page. Each part is optional: the page is complete without it.
// Relative times, the home tabs, share, the live demo clip, Play feedback, player counts and the scoreboards.
const CLIENT_JS = `
(function(){
  var D={};
  var slugs=[];
  // "/<slug>/..." → the game's slug when it is one of ours, else ''
  var gameOf=function(path){var p=String(path||'').split('#')[0].split('?')[0].split('/');return p.length>=2&&p.length<=3&&p[0]===''&&(p.length===2||p[2]==='')&&slugs.indexOf(p[1])>=0?p[1]:'';};
  try{D=JSON.parse((document.getElementById('site-data')||{}).textContent||'{}');}catch(e){/* malformed data block: run without the API */}
  var api=(D.apiBase||'').replace(/\\/$/,'');
  var fmt=function(n){return Number(n||0).toLocaleString('en-US');};
  var short=function(n){n=Number(n||0);return n>=10000?Math.round(n/1000)+'K':n>=1000?(n/1000).toFixed(1).replace(/\\.0$/,'')+'K':String(n);};
  slugs=D.slugs||[];
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
  var all=function(sel){return Array.prototype.slice.call(document.querySelectorAll(sel));};

  // timeline times: "today", "3d", then the date (the HTML was rendered at build time; same rule as shortTime in html.ts)
  var now=new Date(),today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
  all('time[data-rel]').forEach(function(t){
    var d=Date.parse(t.getAttribute('datetime')||'');if(isNaN(d))return;
    var days=Math.floor((today-d)/86400000),dt=new Date(d);
    t.textContent=days<=0?'today':days<7?days+'d':dt.toLocaleDateString('en-US',dt.getUTCFullYear()===now.getFullYear()?{month:'short',day:'numeric',timeZone:'UTC'}:{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
  });

  // home tabs: Latest / Games / Too soon. "#games" (the Games link in the nav) opens the Games tab.
  var tabs=all('.tabs [role=tab]'),posts=all('#feed .post'),empty=document.getElementById('feed-empty');
  var show=function(f,scroll){
    if(!tabs.length)return;
    tabs.forEach(function(b){b.setAttribute('aria-selected',String(b.getAttribute('data-f')===f));});
    var n=0;posts.forEach(function(p){var on=f==='all'||(f==='games'&&p.getAttribute('data-kind')==='game')||(f==='events'&&p.getAttribute('data-kind')==='event');p.hidden=!on;if(on)n++;});
    if(empty)empty.hidden=n>0;
    if(scroll)window.scrollTo({top:0});
  };
  tabs.forEach(function(b){b.addEventListener('click',function(){show(b.getAttribute('data-f'),true);history.replaceState(null,'',b.getAttribute('data-f')==='games'?'#games':location.pathname);});});
  if(tabs.length){
    if(location.hash==='#games')show('games',false);
    all('[data-tab=games]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();show('games',true);history.replaceState(null,'','#games');});});
  }

  // share: the phone's share sheet, else copy the link
  all('.act.share').forEach(function(b){
    b.addEventListener('click',function(){
      var url=location.origin+b.getAttribute('data-url'),label=b.querySelector('span');
      send('share_click',{channel:navigator.share?'system':'copy',where:'post',game:gameOf(b.getAttribute('data-url'))});
      if(navigator.share){navigator.share({title:b.getAttribute('data-title')||document.title,url:url}).catch(function(){/* the share sheet was closed: nothing to do */});return;}
      if(!navigator.clipboard)return;
      navigator.clipboard.writeText(url).then(function(){b.classList.add('copied');label.textContent='Link copied';setTimeout(function(){b.classList.remove('copied');label.textContent='Share';},1600);});
    });
  });

  // live demo on the pinned post: a silent gameplay loop over the cover. Skipped for reduced motion / data saver / 2g.
  var m=document.querySelector('.media[data-clip]');
  var conn=navigator.connection||{};
  var calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(m&&!calm&&!conn.saveData&&!/2g/.test(conn.effectiveType||'')){
    var start=function(){
      var v=document.createElement('video');
      v.muted=true;v.loop=true;v.playsInline=true;v.autoplay=true;v.preload='auto';v.setAttribute('aria-hidden','true');v.tabIndex=-1;
      // anticipation (UX-ANIMATION-RULES a5): the badge pulses while the clip loads, then the cover blurs away
      m.classList.add('is-arming');
      var unarm=function(){m.classList.remove('is-arming');};
      v.addEventListener('playing',function(){unarm();m.classList.add('is-live');},{once:true});
      v.addEventListener('error',unarm,{once:true});
      v.src=m.getAttribute('data-clip');
      m.querySelector('.frame').appendChild(v);
      var p=v.play();if(p&&p.catch)p.catch(unarm); // autoplay refused (low power mode, settings): keep the still cover
    };
    if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
  }

  // a1/a3: a tapped Play shows it is on its way until the game page replaces this one
  var going=function(a){if(!a||a.classList.contains('is-going'))return;a.classList.add('is-going');var l=a.querySelector('.lbl');if(l){l.setAttribute('data-l',l.textContent);l.textContent='Loading…';}};
  document.addEventListener('click',function(e){
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    var a=e.target&&e.target.closest?e.target.closest('a'):null;if(!a)return;
    if(a.matches('.act.play,.cta,.fab'))going(a);
    else if(a.matches('.stretch,.media')){var post=a.closest('.post');if(post)going(post.querySelector('.act.play'));}
  });
  // back from the game restores this page from the cache: undo the loading state
  window.addEventListener('pageshow',function(e){
    if(!e.persisted)return;
    all('.is-going').forEach(function(a){a.classList.remove('is-going');var l=a.querySelector('.lbl');if(l&&l.hasAttribute('data-l'))l.textContent=l.getAttribute('data-l');});
  });

  // ---- the visit: where it came from, carried on to the games, and counted under the game id "site" (docs/EVENTS.md) ----
  // The channel follows the games' own rule (common-game-code analytics/track.ts, channelOf): "medium:source" from
  // UTM tags, "ref:<host>" for another site, else "direct". The anonymous id and the studio-device switch
  // (?internal=1) are the games' too (tsg:uid, tsg:internal, same origin), so one person is one user everywhere.
  var qs=new URLSearchParams(location.search);
  var clean=function(s,max){return String(s||'').toLowerCase().replace(/[^a-z0-9._-]/g,'').slice(0,max||32);};
  var utm=[];qs.forEach(function(v,k){if(k.indexOf('utm_')===0)utm.push(encodeURIComponent(k)+'='+encodeURIComponent(v));});
  var refHost='';try{refHost=document.referrer?new URL(document.referrer).host:'';}catch(e){/* an unparsable referrer counts as none */}
  var src=clean(qs.get('utm_source')),med=clean(qs.get('utm_medium'));
  var here=(src||med)?(med||'none')+':'+(src||'none'):(refHost&&refHost!==location.host)?'ref:'+clean(refHost,48):'direct';
  // one visit per tab: the first page decides the channel, the pages after it (and coming back from a game) reuse it
  var visit=null,first=false;
  try{visit=JSON.parse(sessionStorage.getItem('tsg:visit')||'null');}catch(e){/* storage blocked: every page counts as a new visit */}
  if(!visit||!visit.ch||!visit.sid){first=true;visit={ch:here,sid:Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4)};try{sessionStorage.setItem('tsg:visit',JSON.stringify(visit));}catch(e){/* storage blocked, as above */}}
  // links inside the site: UTM tags travel as they are (the game works the same channel out of them). A visit from
  // another site without tags passes its channel as the share-chain origin (o=), the one thing a game reads for it.
  var carry=utm.length?utm.join('&'):(visit.ch.indexOf('ref:')===0?'o='+encodeURIComponent(visit.ch):'');
  if(carry)all('a[href^="/"]').forEach(function(a){
    var h=a.getAttribute('href'),i=h.indexOf('#'),path=i<0?h:h.slice(0,i),hash=i<0?'':h.slice(i);
    a.setAttribute('href',path+(path.indexOf('?')<0?'?':'&')+carry+hash);
  });
  var store=function(k,v){try{if(v===undefined)return localStorage.getItem('tsg:'+k);localStorage.setItem('tsg:'+k,v);}catch(e){/* storage blocked: nothing is remembered */}return null;};
  if(qs.get('internal')==='1')store('internal','1');
  if(qs.get('internal')==='0')store('internal','');
  var uid=store('uid')||(document.cookie.match(/(?:^|; )tsg_uid=([^;]*)/)||[])[1]||'';
  if(!/^[0-9a-f-]{36}$/i.test(uid)&&window.crypto&&crypto.randomUUID){uid=crypto.randomUUID();store('uid',uid);document.cookie='tsg_uid='+uid+'; max-age=34560000; path=/; samesite=lax'+(location.protocol==='https:'?'; secure':'');}
  var send=function(name,props){
    if(!api||!uid||store('internal')==='1')return;
    var url=api+'/v1/games/site/events';
    var body=JSON.stringify({userId:uid,version:'site',lang:'en',ch:visit.ch,origin:visit.ch,events:[{name:name,ts:Date.now(),sessionId:visit.sid,props:props||{}}]});
    // fetch, not sendBeacon: a beacon always carries credentials, and the API (another origin) answers without
    // Access-Control-Allow-Credentials, so the browser drops the beacon while sendBeacon still returns true
    fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:body,keepalive:true}).catch(function(){/* counting a visit never breaks the page */});
  };
  // a visit that came back from a game: ?from=<slug>&via=<button> on the game's own links (overlays.ts, game-chrome.ts),
  // else the game page it came from (same-origin referrer). "<game>:<button>" goes into page_view.from
  var refPath='';try{var ru=document.referrer?new URL(document.referrer):null;if(ru&&ru.host===location.host)refPath=ru.pathname;}catch(e){/* an unparsable referrer counts as none */}
  var fromGame=slugs.indexOf(qs.get('from')||'')>=0?qs.get('from'):gameOf(refPath);
  var from=fromGame?fromGame+':'+(clean(qs.get('via'))||'game'):'';
  if(first)send('session_start',{ref:refHost,utm_source:qs.get('utm_source')||'',utm_medium:qs.get('utm_medium')||'',utm_campaign:qs.get('utm_campaign')||'',utm_content:qs.get('utm_content')||'',lang:navigator.language,viewportW:innerWidth,viewportH:innerHeight,dpr:Math.round((window.devicePixelRatio||1)*10)/10,page:location.pathname});
  send('page_view',{page:location.pathname,from:from});
  all('a[data-network]').forEach(function(a){a.addEventListener('click',function(){send('follow_click',{network:a.getAttribute('data-network')});});});
  // which games the site sends players to, and from where on the page
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;
    var game=gameOf(a.getAttribute('href'));if(!game)return;
    var where=a.closest('.nav,.bnav')?'nav':a.closest('.cta')?'rail':a.closest('.fab')?'fab':a.closest('.side')?'side':a.closest('.board')?'board':a.closest('.pinned')?'pinned':a.closest('.post')?'feed':'other';
    send('game_click',{game:game,where:where});
  });

  var board=document.getElementById('board'),side=document.getElementById('side-board');
  var noBoard=function(){if(board){board.hidden=true;board.removeAttribute('aria-busy');}};
  if(!api){noBoard();return;}

  // games played (one request per game)
  all('[data-count]').forEach(function(n){
    fetch(api+'/v1/games/'+encodeURIComponent(n.getAttribute('data-count'))+'/count').then(function(r){return r.ok?r.json():null;}).then(function(d){
      var plays=d&&typeof d.playsPublic==='number'?d.playsPublic:0;
      if(!plays||plays<Number(n.getAttribute('data-min')||1))return;
      n.querySelector('b').textContent=short(plays);n.title=fmt(plays)+' games played';n.hidden=false;
    }).catch(function(){/* offline or API down: the counter stays hidden */});
  });

  // top 3 of the lead game: in the pinned post and in the sidebar
  var slug=(board&&board.getAttribute('data-slug'))||(side&&side.getAttribute('data-slug'));
  if(!slug){noBoard();return;}
  fetch(api+'/v1/games/'+encodeURIComponent(slug)+'/board?limit=3').then(function(r){return r.ok?r.json():null;}).then(function(d){
    if(!d||!d.top||!d.top.length){noBoard();return;}
    var top=d.top.slice(0,3);
    if(board){
      board.querySelector('.board-list').innerHTML=top.map(function(r){return '<li class="in"><span class="rank">'+r.rank+'</span><span class="nick">'+esc(r.nick||'Anonymous')+'</span><span class="score">'+fmt(r.score)+'</span></li>';}).join('');
      board.classList.remove('is-loading');board.setAttribute('aria-busy','false');
    }
    if(side){
      side.querySelector('.side-rows').innerHTML=top.map(function(r){return '<div class="row"><span class="ic rank">'+r.rank+'</span><span class="t"><b>'+esc(r.nick||'Anonymous')+'</b><small>'+fmt(r.score)+' points</small></span></div>';}).join('');
      side.hidden=false;
    }
  }).catch(noBoard);
})();`;
