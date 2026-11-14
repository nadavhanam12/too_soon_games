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

  // the hero is always the newest game, rendered server-side (decision 53): no client-side swap
  if(!api)return;

  // 2. player counts (one request per distinct slug)
  var counts={};
  var nodes=document.querySelectorAll('[data-count]');
  Array.prototype.forEach.call(nodes,function(n){
    var slug=n.getAttribute('data-count');if(!slug)return;
    counts[slug]=counts[slug]||fetch(api+'/v1/games/'+encodeURIComponent(slug)+'/count').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
    counts[slug].then(function(d){
      if(!d)return;var plays=typeof d.playsPublic==='number'?d.playsPublic:(typeof d.plays==='number'?d.plays:0);
      var min=Number(n.getAttribute('data-min')||0);
      if(plays<min)return;
      var b=n.querySelector('b');if(b)b.textContent=fmt(plays);n.hidden=false;
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
