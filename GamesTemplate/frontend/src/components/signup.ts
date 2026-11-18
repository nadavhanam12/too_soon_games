import type { SiteCtx } from '../types';

/**
 * The sign-up card on top of the home timeline (where the follow prompt was). Google or Apple: the account's player
 * id becomes this browser's tsg:uid, so every game on the site posts its scores under the account, on every device.
 * A typed email joins the new-game list and marks this browser's player as signed up; it signs nobody in, since
 * nothing proves the address (routes/auth.ts in the API). The signed-out state is the page's own HTML; SIGNUP_JS
 * switches to "You're in".
 * A way in shows only when its client id is in studio.json (googleClientId, appleClientId); email needs only the API.
 */
export function signupCard(follow: string): string {
  return `<section class="prompt signup" id="signup" aria-label="Sign up">
  <span class="av" aria-hidden="true"><img src="/assets/logo.png" alt="" width="360" height="352"></span>
  <div class="su">
    <p class="prompt-h" data-in="You're on the list for the next viral game.">Sign up. Be the first to play the next viral game.</p>
    <p class="prompt-sub" data-in="We'll email you the moment it drops. Your scores are saved on every device, and you compete across all our games.">We email you the moment a new game drops. Your scores are saved on every device, and you compete across all our games.</p>
    <div class="su-out">
      <div class="su-ways">
        <div class="su-google" hidden></div>
        <button type="button" class="su-apple" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1-3.2-1 .1-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>Continue with Apple</button>
      </div>
      <form class="su-mail" novalidate>
        <input type="email" name="email" autocomplete="email" inputmode="email" placeholder="Your email" aria-label="Your email" required>
        <button type="submit">Sign up</button>
      </form>
      <p class="su-msg" role="status" aria-live="polite"></p>
      <p class="su-fine">One email per new game. Stop them anytime. <a href="/privacy/">Privacy</a></p>
    </div>
    <div class="su-in" hidden>
      <p class="su-who">You're in as <b></b>.</p>
      <label class="su-check"><input type="checkbox" class="su-notify"> Email me when a new game drops</label>
      <button type="button" class="su-signout">Sign out</button>
    </div>
    <div class="su-follow"><span>Or follow us</span><div class="nets nets-mini">${follow}</div></div>
  </div>
</section>`;
}

/** Client ids for the page script (site-data). Empty strings keep those buttons hidden. */
export const signupData = (ctx: SiteCtx) => ({ googleClientId: ctx.studio.googleClientId || '', appleClientId: ctx.studio.appleClientId || '' });

// Runs inside the page script in layout.ts (CLIENT_JS), after api, uid, store and send are set. No template
// expressions in here: it is pasted into CLIENT_JS as text.
export const SIGNUP_JS = String.raw`
  // ---- the sign-up card (home) ----
  var su=document.getElementById('signup');
  if(su&&!api)su.querySelector('.su-out').hidden=true;
  if(su&&api)(function(){
    var q=function(s){return su.querySelector(s);};
    var msg=q('.su-msg');
    var say=function(t,bad){msg.textContent=t||'';msg.classList.toggle('bad',!!bad);};
    var acct=null;
    try{acct=JSON.parse(store('account')||'null');}catch(e){/* a corrupt saved value counts as signed out */}
    var setUid=function(id){uid=id;store('uid',id);document.cookie='tsg_uid='+id+'; max-age=34560000; path=/; samesite=lax'+(location.protocol==='https:'?'; secure':'');};
    var post=function(path,body){
      return fetch(api+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){
        // an error answer without a JSON body still fails, with its HTTP status as the message
        return r.json().catch(function(){return {};}).then(function(d){if(!r.ok)throw new Error(d.message||('HTTP '+r.status));return d;});
      });
    };
    var fail=function(e){say(e&&e.message&&e.message!=='Failed to fetch'?e.message:'Could not reach the server. Try again.',true);};
    var loaded=false;
    var show=function(){
      var inn=!!(acct&&acct.userId===uid);
      q('.su-out').hidden=inn;q('.su-in').hidden=!inn;su.classList.toggle('is-in',inn);
      [q('.prompt-h'),q('.prompt-sub')].forEach(function(el){if(!el.hasAttribute('data-out'))el.setAttribute('data-out',el.textContent);el.textContent=el.getAttribute(inn?'data-in':'data-out');});
      if(inn){q('.su-who b').textContent=acct.email||('your '+acct.provider+' account');q('.su-notify').checked=acct.notify!==false;}
      else if(!loaded){loaded=true;ways();}
    };
    var done=function(way){return function(d){
      setUid(d.userId);if(d.nick)store('nick',d.nick);
      acct={userId:d.userId,email:d.email,provider:d.provider,notify:d.notify};store('account',JSON.stringify(acct));
      send('signup',{provider:way,created:!!d.created});say('');show();
    };};
    var script=function(src,onload){var s=document.createElement('script');s.src=src;s.async=true;s.onload=onload;
      s.onerror=function(){/* blocked by a content blocker or offline: that button stays hidden, email still works */};
      document.head.appendChild(s);};
    // Google and Apple load only for a signed-out visitor, after the page
    function ways(){
      if(D.googleClientId)script('https://accounts.google.com/gsi/client',function(){
        var el=q('.su-google');el.hidden=false;
        google.accounts.id.initialize({client_id:D.googleClientId,ux_mode:'popup',callback:function(r){
          post('/v1/auth/google',{credential:r.credential,userId:uid}).then(done('google'),fail);
        }});
        google.accounts.id.renderButton(el,{theme:'filled_black',shape:'pill',size:'large',text:'continue_with',width:Math.max(200,Math.min(300,q('.su-ways').clientWidth||300))});
        el.addEventListener('click',function(){send('signup_start',{provider:'google'});},true);
      });
      if(D.appleClientId)script('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',function(){
        AppleID.auth.init({clientId:D.appleClientId,scope:'email',redirectURI:location.origin+'/',usePopup:true});
        var b=q('.su-apple');b.hidden=false;
        b.addEventListener('click',function(){
          send('signup_start',{provider:'apple'});say('');
          AppleID.auth.signIn().then(function(r){return post('/v1/auth/apple',{idToken:r.authorization.id_token,userId:uid});}).then(done('apple'),function(e){
            if(e&&e.error==='popup_closed_by_user')return; // the player closed Apple's window: nothing to report
            fail(e);
          });
        });
      });
    }
    q('.su-mail').addEventListener('submit',function(e){
      e.preventDefault();
      var input=q('.su-mail input'),email=input.value.trim();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){say('Type your email address, like name@gmail.com.',true);input.focus();return;}
      var btn=q('.su-mail button');btn.disabled=true;say('');
      send('signup_start',{provider:'email'});
      post('/v1/auth/email',{email:email,userId:uid}).then(done('email'),fail).then(function(){btn.disabled=false;});
    });
    q('.su-notify').addEventListener('change',function(e){
      var on=e.target.checked;
      post('/v1/account',{userId:uid,notify:on}).then(function(d){acct.notify=d.notify;store('account',JSON.stringify(acct));},function(err){e.target.checked=!on;fail(err);});
    });
    q('.su-signout').addEventListener('click',function(){
      // a new anonymous id: the next scores on this browser are not the account's
      store('account','');store('nick','');setUid(crypto.randomUUID());acct=null;show();
    });
    show();
  })();
`;
