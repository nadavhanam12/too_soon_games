import type { SiteCtx } from '../types';
import { layout, followBlock } from '../components/layout';
import { esc } from '../components/html';
import { hero, boardBlock, gamesGrid, defaultFeatured } from '../components/games';

export function homePage(ctx: SiteCtx): string {
  const featured = defaultFeatured(ctx.games);
  const data = JSON.stringify({ apiBase: ctx.studio.apiBase || '', games: ctx.games });
  const body = `
${hero(featured)}
${boardBlock(featured)}
<p class="studio-line">${esc(ctx.studio.tagline)}</p>
${gamesGrid(ctx.games)}
${followBlock(ctx)}
<script type="application/json" id="site-data">${data.replace(/</g, '\\u003c')}</script>
<script>${CLIENT_JS}</script>`;
  return layout(ctx, { title: 'Home', description: ctx.studio.tagline, path: '/', home: true }, body);
}

// Runs on the home page: picks the featured game by browser language, fills player counts and the
// featured leaderboard from the API. Everything fails silently (the page is complete without it).
const CLIENT_JS = `
(function(){
  var el=document.getElementById('site-data');if(!el)return;
  var D;try{D=JSON.parse(el.textContent||'{}');}catch(e){return;}
  var games=D.games||[],api=(D.apiBase||'').replace(/\\/$/,'');
  var fmt=function(n){return Number(n||0).toLocaleString('en-US');};
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};

  // 1. featured by browser language (unless games.json pins one)
  var live=games.filter(function(g){return g.status!=='archived';});
  var pinned=live.filter(function(g){return g.featured;})[0];
  var pref=(navigator.language||'en').toLowerCase().indexOf('he')===0?'he':'en';
  var newest=function(list){return list.slice().sort(function(a,b){return (b.publishedAt||'').localeCompare(a.publishedAt||'');})[0];};
  var want=pinned||newest(live.filter(function(g){return g.lang===pref;}))||newest(live)||newest(games);
  var heroEl=document.getElementById('hero'),boardEl=document.getElementById('board');
  if(want&&heroEl&&heroEl.getAttribute('data-slug')!==want.slug){
    // swap the server-rendered hero for the preferred game by moving the matching card's data in
    heroEl.setAttribute('data-slug',want.slug);
    var h1=heroEl.querySelector('h1'),lead=heroEl.querySelector('.lead'),links=heroEl.querySelectorAll('a[href]'),img=heroEl.querySelector('img.cover');
    if(h1)h1.textContent=want.title;if(lead)lead.textContent=want.tagline;
    var eye=heroEl.querySelector('.eyebrow');if(eye){var FL={il:'🇮🇱',us:'🇺🇸'},LN={he:'Hebrew',en:'English'};var d=want.event&&want.event.date?new Date(want.event.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';eye.textContent=(want.status==='archived'?'From the archive':'Latest game')+' · '+(FL[want.audience]||'')+' '+(LN[want.lang]||want.lang)+(d?' · '+d:'');}
    for(var i=0;i<links.length;i++)links[i].setAttribute('href','/'+want.slug+'/');
    if(img){if(want.cover)img.setAttribute('src','/'+want.slug+'/'+String(want.cover).replace(/^\\/+/,''));else img.remove();}
    var cnt=heroEl.querySelector('[data-count]');if(cnt){cnt.setAttribute('data-count',want.slug);cnt.setAttribute('data-min',String(want.showPlayerCountFrom==null?500:want.showPlayerCountFrom));}
    if(boardEl){boardEl.setAttribute('data-slug',want.slug);var bt=boardEl.querySelector('.board-title');if(bt)bt.textContent=want.title;var more=boardEl.querySelector('.board-more a');if(more)more.setAttribute('href','/'+want.slug+'/#board');}
  }
  if(!api)return;

  // 2. player counts (one request per distinct slug)
  var counts={};
  var nodes=document.querySelectorAll('[data-count]');
  Array.prototype.forEach.call(nodes,function(n){
    var slug=n.getAttribute('data-count');if(!slug)return;
    counts[slug]=counts[slug]||fetch(api+'/v1/games/'+encodeURIComponent(slug)+'/count').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
    counts[slug].then(function(d){
      if(!d||typeof d.players!=='number')return;
      var min=Number(n.getAttribute('data-min')||0);
      if(d.players<min||d.players<=0)return;
      var b=n.querySelector('b');if(b)b.textContent=fmt(d.players);n.hidden=false;
    });
  });

  // 3. leaderboard of the featured game
  if(boardEl){
    var slug=boardEl.getAttribute('data-slug');
    if(slug)fetch(api+'/v1/games/'+encodeURIComponent(slug)+'/board?limit=10').then(function(r){return r.ok?r.json():null;}).then(function(d){
      if(!d||!d.top||!d.top.length)return;
      var ol=boardEl.querySelector('.board-list');if(!ol)return;
      ol.innerHTML=d.top.map(function(r){return '<li><span class="rank">'+r.rank+'</span><span class="nick">'+esc(r.nick||'Anonymous')+'</span><span class="score">'+fmt(r.score)+'</span></li>';}).join('');
      boardEl.hidden=false;
    }).catch(function(){});
  }
})();`;
