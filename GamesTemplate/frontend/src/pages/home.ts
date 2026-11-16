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
// today's date and relative times, the Play feedback and the phone's sticky Play bar, the live demo,
// player counts, and the 3-row leaderboard of the lead story.
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
        // anticipation (UX-ANIMATION-RULES a5): the badge pulses while the clip loads, then the cover blurs away
        fig.classList.add('is-arming');
        var unarm=function(){fig.classList.remove('is-arming');};
        v.addEventListener('playing',function(){unarm();fig.classList.add('is-live');},{once:true});
        v.addEventListener('error',unarm,{once:true});
        v.src=fig.getAttribute('data-clip');
        fig.querySelector('a').appendChild(v);
        var p=v.play();if(p&&p.catch)p.catch(unarm); // autoplay refused (low power mode, settings): keep the still cover
      };
      if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
    }
  }catch(e){}

  // a1/a3: the tapped Play shows it is on its way (spinner + "Loading…") until the game page replaces this one
  try{
    var going=function(a){if(!a||a.classList.contains('is-going'))return;a.classList.add('is-going');var l=a.querySelector('.lbl');if(l){l.setAttribute('data-l',l.textContent);l.textContent='Loading…';}};
    document.addEventListener('click',function(e){
      if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
      var a=e.target&&e.target.closest?e.target.closest('a'):null;if(!a)return;
      if(a.matches('.btn-play,.play-sm'))going(a);
      else{var it=a.closest('.item-game');if(it)going(it.querySelector('.play-sm'));}
    });
    // back button from the game restores this page from the cache: undo the loading state
    window.addEventListener('pageshow',function(e){
      if(!e.persisted)return;
      Array.prototype.forEach.call(document.querySelectorAll('.is-going'),function(a){a.classList.remove('is-going');var l=a.querySelector('.lbl');if(l&&l.hasAttribute('data-l'))l.textContent=l.getAttribute('data-l');});
    });
  }catch(e){}

  // a4: on phones a copy of the lead Play rides at the bottom while the real one is still below the fold
  try{
    var mainPlay=document.querySelector('.lead-story .btn-play');
    if(mainPlay&&'IntersectionObserver' in window){
      var bar=document.createElement('div');bar.className='sticky-play';bar.setAttribute('aria-hidden','true');
      var copy=mainPlay.cloneNode(true);copy.tabIndex=-1;bar.appendChild(copy);document.body.appendChild(bar);
      new IntersectionObserver(function(es){var r=es[0];bar.classList.toggle('is-on',!r.isIntersecting&&r.boundingClientRect.top>0);}).observe(mainPlay);
    }
  }catch(e){}

  // the board shows skeleton rows until the API answers; with no API or no scores it folds away
  var boardEl=document.getElementById('board');
  var noBoard=function(){if(boardEl){boardEl.hidden=true;boardEl.removeAttribute('aria-busy');}};
  if(!api){noBoard();return;}

  // player counts (one request per distinct slug)
  var counts={};
  Array.prototype.forEach.call(document.querySelectorAll('[data-count]'),function(n){
    var slug=n.getAttribute('data-count');if(!slug)return;
    counts[slug]=counts[slug]||fetch(api+'/v1/games/'+encodeURIComponent(slug)+'/count').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
    counts[slug].then(function(d){
      if(!d)return;var plays=typeof d.playsPublic==='number'?d.playsPublic:(typeof d.plays==='number'?d.plays:0);
      if(plays<Number(n.getAttribute('data-min')||0))return;
      var b=n.querySelector('b');if(b)b.textContent=fmt(plays);n.classList.add('is-set');
    });
  });

  // leaderboard of the lead story (top 3)
  if(boardEl){
    var slug=boardEl.getAttribute('data-slug');
    if(!slug)noBoard();else fetch(api+'/v1/games/'+encodeURIComponent(slug)+'/board?limit=3').then(function(r){return r.ok?r.json():null;}).then(function(d){
      if(!d||!d.top||!d.top.length){noBoard();return;}
      var ol=boardEl.querySelector('.board-list');if(!ol)return;
      ol.innerHTML=d.top.slice(0,3).map(function(r){return '<li class="in"><span class="rank">'+r.rank+'</span><span class="nick">'+esc(r.nick||'Anonymous')+'</span><span class="score">'+fmt(r.score)+'</span></li>';}).join('');
      boardEl.classList.remove('is-loading');boardEl.setAttribute('aria-busy','false');
    }).catch(noBoard);
  }
})();`;
