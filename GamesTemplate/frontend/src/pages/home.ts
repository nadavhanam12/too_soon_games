import type { SiteCtx } from '../types';
import { layout } from '../components/layout';
import { esc } from '../components/html';
import { leadStory, feedList, feedItems, defaultFeatured } from '../components/games';

export function homePage(ctx: SiteCtx): string {
  const lead = defaultFeatured(ctx.games);
  const data = JSON.stringify({ apiBase: ctx.studio.apiBase || '' });
  const body = `
${leadStory(lead)}
${feedList(feedItems(ctx.games, ctx.events, lead))}
<script type="application/json" id="site-data">${data.replace(/</g, '\\u003c')}</script>
<script>${CLIENT_JS}</script>`;
  return layout(ctx, { title: 'Home', description: ctx.studio.tagline, path: '/', home: true, bodyClass: 'page-home' }, body);
}

// Runs on the home page. Everything fails silently (the page is complete without it):
// today's date and relative times, player counts, and the 3-row leaderboard of the lead story.
const CLIENT_JS = `
(function(){
  var el=document.getElementById('site-data');if(!el)return;
  var D;try{D=JSON.parse(el.textContent||'{}');}catch(e){return;}
  var api=(D.apiBase||'').replace(/\\/$/,'');
  var fmt=function(n){return Number(n||0).toLocaleString('en-US');};
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};

  // fresh date + relative times (the HTML was rendered at build time)
  try{
    var now=new Date(),today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
    var t=document.querySelector('[data-today]');
    if(t)t.textContent=now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    Array.prototype.forEach.call(document.querySelectorAll('time[data-rel]'),function(n){
      var d=Date.parse(n.getAttribute('datetime')||'');if(isNaN(d))return;
      var days=Math.floor((today-d)/86400000);
      n.textContent=days<=0?'today':days===1?'yesterday':days<14?days+' days ago':days<60?Math.floor(days/7)+' weeks ago':Math.floor(days/30)+' months ago';
    });
  }catch(e){}

  // live demo: a silent gameplay loop over the cover. Loaded after the page, skipped for reduced motion / data saver / 2g.
  try{
    var fig=document.querySelector('.lead-fig[data-clip]');
    var conn=navigator.connection||{};
    var calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(fig&&!calm&&!conn.saveData&&!/2g/.test(conn.effectiveType||'')){
      var start=function(){
        var v=document.createElement('video');
        v.muted=true;v.loop=true;v.playsInline=true;v.autoplay=true;v.preload='auto';v.setAttribute('aria-hidden','true');v.tabIndex=-1;
        v.addEventListener('playing',function(){fig.classList.add('is-live');},{once:true});
        v.src=fig.getAttribute('data-clip');
        fig.querySelector('a').appendChild(v);
        var p=v.play();if(p&&p.catch)p.catch(function(){});
      };
      if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
    }
  }catch(e){}

  if(!api)return;

  // player counts (one request per distinct slug)
  var counts={};
  Array.prototype.forEach.call(document.querySelectorAll('[data-count]'),function(n){
    var slug=n.getAttribute('data-count');if(!slug)return;
    counts[slug]=counts[slug]||fetch(api+'/v1/games/'+encodeURIComponent(slug)+'/count').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
    counts[slug].then(function(d){
      if(!d)return;var plays=typeof d.playsPublic==='number'?d.playsPublic:(typeof d.plays==='number'?d.plays:0);
      if(plays<Number(n.getAttribute('data-min')||0))return;
      var b=n.querySelector('b');if(b)b.textContent=fmt(plays);n.hidden=false;
    });
  });

  // leaderboard of the lead story (top 3)
  var boardEl=document.getElementById('board');
  if(boardEl){
    var slug=boardEl.getAttribute('data-slug');
    if(slug)fetch(api+'/v1/games/'+encodeURIComponent(slug)+'/board?limit=3').then(function(r){return r.ok?r.json():null;}).then(function(d){
      if(!d||!d.top||!d.top.length)return;
      var ol=boardEl.querySelector('.board-list');if(!ol)return;
      ol.innerHTML=d.top.slice(0,3).map(function(r){return '<li><span class="rank">'+r.rank+'</span><span class="nick">'+esc(r.nick||'Anonymous')+'</span><span class="score">'+fmt(r.score)+'</span></li>';}).join('');
      boardEl.hidden=false;
    }).catch(function(){});
  }
})();`;
