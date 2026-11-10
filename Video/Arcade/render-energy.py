"""Energetic revision; retains the original film and all disclosure labels."""
import render as v
from PIL import Image,ImageDraw
import numpy as np
import json, math, wave, subprocess, sys
v.B=v.P/'build-energy';v.B.mkdir(exist_ok=True)
v.SC=json.loads((v.P/'narration-energy.json').read_text())
original_frame=v.frame;original_header=v.header;original_text=v.txt
current_t=0
titles={
 'DON’T GET CAUGHT':'CAUGHT! YOU’RE FAMOUS.',
 'IT STARTED WITH THIS.':'ONE MOMENT. HUGE POTENTIAL.',
 'WAIT… THAT’S A GAME.':'YES. THAT’S OUR NEXT GAME!',
 'ONE MOMENT. ONE SIMPLE GAME.':'LET’S BUILD SOMETHING FUN.',
 'STILL TRENDING. ALREADY PLAYABLE.':'WE’RE LIVE. LET’S GET IT OUT THERE!',
 'OKAY, THIS ESCAPED OUR GROUP CHAT.':'IMAGINE THIS TAKING OFF!',
 'NOW OUR GAME IS THE STORY.':'OUR LITTLE GAME. A BIG NEW STORY.'
}
def title(im,label,clock):
 s=next(s for s in v.SC if s['start']<=current_t<s['end'])
 u=current_t-s['start'];p=v.ease(u/.5)
 original_text(im,'TOO SOON GAMES',42,33,20,v.MINT,True)
 original_text(im,titles.get(label,label),42+int(80*(1-p)),83,42,v.WHITE,True)
 original_text(im,'SINCE THE MOMENT',1236,25,13,v.MUTED,anchor='rm')
 original_text(im,clock,1236,55,28,v.MINT,True,'rm')
v.header=title
def typeface(im,s,x,y,n=28,c=v.WHITE,b=False,anchor='lm'):
 if s in ['1,000,000','20,000']:
  n=int(n*(1+.035*max(0,math.sin((current_t-47)*8))*math.exp(-max(0,current_t-47))))
 original_text(im,s,x,y,n,c,b,anchor)
v.txt=typeface
def ribbon(im,message,t0,t1,t,color=v.MINT):
 if not t0<=t<t1:return
 progress=min(v.ease((t-t0)/.2),v.ease((t1-t)/.2))
 width=int(min(1050,v.font(25,True).getlength(message)+70));y=606+int(45*(1-progress))
 v.box(im,(640-width/2,y-24,640+width/2,y+24),color,12)
 original_text(im,message,640,y,25,v.BG,True,'mm')
def frame(t):
 global current_t
 current_t=t;im=original_frame(t)
 # Scene-entry motion accents sweep across the background, away from subtitles.
 s=next(s for s in v.SC if s['start']<=t<s['end']);u=t-s['start']
 if u<.5:
  d=ImageDraw.Draw(im);x=int(v.ease(u/.5)*1280)
  d.line((max(0,x-220),116,x,116),fill=v.MINT,width=5)
 if 33<t<42:
  for j in range(3):
   r=20+((t*50+j*40)%120)
   d=ImageDraw.Draw(im);d.arc((640-r,365-r,640+r,365+r),200,270,fill=v.PURPLE,width=2)
 # Animated celebration particles around the metrics and final brand.
 if 45<t<51 or t>57:
  d=ImageDraw.Draw(im);epoch=45 if t<51 else 57
  for j in range(60):
   x=(j*173+math.sin(t*2+j)*25)%1280
   y=120+((t-epoch)*(65+j%7*8)+j*73)%490
   color=[v.MINT,v.PINK,v.PURPLE,v.ORANGE][j%4]
   if t<51 and 370<x<920:continue
   ang=t*3+j;dx=math.cos(ang)*5;dy=math.sin(ang)*5
   d.line((x-dx,y-dy,x+dx,y+dy),fill=color,width=3)
 ribbon(im,'A VIRAL MOMENT. A PLAYABLE IDEA.',9,11.7,t)
 ribbon(im,'THREE LOCATIONS. ONE BIG “LET’S GO!”',17,19.7,t)
 ribbon(im,'DODGE. HIDE. LAUGH. TRY AGAIN.',29,32.7,t)
 ribbon(im,'18 SECONDS? I CAN BEAT THAT.',37,41.7,t,v.ORANGE)
 # Preserve source credit and success disclaimers from the base film.
 return im
def sound():
 v.sound(music_bpm=124);sr=24000
 with wave.open(str(v.B/'mix.wav'),'rb') as f:a=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(np.float32)/32767
 n=len(a);rng=np.random.default_rng(18);beat=60/124
 def add(st,sig):
  k=int(st*sr);m=min(len(sig),n-k)
  if k>=0 and m>0:a[k:k+m]+=sig[:m]
 # Buoyant bass and handclap-style percussion; no countdown or alarm sounds.
 for k in range(int(60/beat)):
  st=k*beat;z=np.arange(int(sr*.22))/sr
  add(st,np.sin(2*np.pi*(66*z-75*z*z))*np.exp(-z*24)*.033)
  if k%2:
   z=np.arange(int(sr*.07))/sr
   noise=rng.normal(0,1,len(z));noise=np.concatenate(([0],np.diff(noise)))
   add(st,noise*np.exp(-z*60)*.012)
  note=[48,45,41,43][(k//8)%4];freq=440*2**((note-69)/12)
  z=np.arange(int(sr*.25))/sr
  add(st,np.sin(2*np.pi*freq*z)*np.exp(-z*12)*.025)
 for st in [12,20,33,42,51,57]:
  for j,note in enumerate([72,76,79,84]):
   z=np.arange(int(sr*.35))/sr;freq=440*2**((note-69)/12)
   add(st+.08*j,np.sin(2*np.pi*freq*z)*np.exp(-z*10)*.045)
 a*=np.minimum(1,(n-np.arange(n))/sr/.65)
 a=np.clip(a,-.96,.96)
 with wave.open(str(v.B/'mix.wav'),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes((a*32767).astype('<i2').tobytes())
if __name__=='__main__':
 if '--preview' in sys.argv:
  for t in [10,18,30,38,48,58]:frame(t).save(v.B/f'preview-{t}.jpg',quality=93)
 else:
  sound()
  proc=subprocess.Popen([v.FF,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r','24','-i','-','-i',str(v.B/'mix.wav'),'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-t','60','-movflags','+faststart',str(v.P/'Too-Soon-Games-Energetic-EN.mp4')],stdin=subprocess.PIPE)
  for k in range(1440):
   proc.stdin.write(frame(k/24).tobytes())
   if k%240==0:print(f'{k//24}/60 seconds',flush=True)
  proc.stdin.close();assert proc.wait()==0
  print('Energetic revision complete',flush=True)
