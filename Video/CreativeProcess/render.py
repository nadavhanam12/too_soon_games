from pathlib import Path
import sys,json,math,subprocess,wave
P=Path(__file__).resolve().parent;sys.path.insert(0,str(P.parents[1]/'.video-tools'))
import numpy as np
from PIL import Image,ImageDraw,ImageFont
import imageio_ffmpeg
W,H,FPS=1280,720,24;B=P/'build';B.mkdir(exist_ok=True);FF=imageio_ffmpeg.get_ffmpeg_exe()
SC=json.loads((P/'narration.json').read_text());F={}
INK='#17211f';PAPER='#f3f1e8';MUTED='#64706b';GREEN='#c6f462';ORANGE='#fc7950';WHITE='#ffffff'
def font(n,b=True):
 if (n,b) not in F:F[n,b]=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf' if b else 'C:/Windows/Fonts/arial.ttf',n)
 return F[n,b]
def text(im,s,x,y,n=28,c=INK,anchor='lm',b=True):ImageDraw.Draw(im).text((x,y),s,font=font(n,b),fill=c,anchor=anchor)
def rect(im,box,c=WHITE,r=16,outline=None):ImageDraw.Draw(im).rounded_rectangle(tuple(map(int,box)),radius=r,fill=c,outline=outline,width=2)
def line(im,pts,c=INK,w=3):ImageDraw.Draw(im).line(pts,fill=c,width=w)
def dot(im,x,y,r,c):ImageDraw.Draw(im).ellipse((x-r,y-r,x+r,y+r),fill=c)
def ease(x):return 1-(1-max(0,min(1,x)))**3
def arrow(im,a,b,c=INK):
 line(im,(*a,*b),c,3);ang=math.atan2(b[1]-a[1],b[0]-a[0]);d=ImageDraw.Draw(im)
 d.polygon([b,(b[0]-15*math.cos(ang-.5),b[1]-15*math.sin(ang-.5)),(b[0]-15*math.cos(ang+.5),b[1]-15*math.sin(ang+.5))],fill=c)
def camera(im,x,y,sz=1):
 rect(im,(x-32*sz,y-20*sz,x+20*sz,y+20*sz),ORANGE,8)
 ImageDraw.Draw(im).polygon([(x+20*sz,y-10*sz),(x+42*sz,y-25*sz),(x+42*sz,y+25*sz),(x+20*sz,y+10*sz)],fill=ORANGE)
 dot(im,x-8*sz,y,8*sz,INK)
def game(im,box,t,stage=3):
 x,y,xx,yy=box;ww=xx-x;hh=yy-y;rect(im,box,INK,20)
 d=ImageDraw.Draw(im)
 for a in range(1,12):d.line((x+a*ww/12,y+45,x+a*ww/12,yy-15),fill='#293732',width=1)
 for a in range(1,7):d.line((x+12,y+a*hh/7,xx-12,y+a*hh/7),fill='#293732',width=1)
 text(im,'CAMERA DODGE',x+22,y+29,19,GREEN)
 cx=x+ww*(.5+.32*math.sin(t*.9));cy=y+hh*.4
 if stage>=1:
  layer=Image.new('RGBA',(W,H));ld=ImageDraw.Draw(layer)
  ld.polygon([(cx,y+65),(cx-ww*.16,yy-14),(cx+ww*.16,yy-14)],fill=(252,121,80,55))
  im.paste(Image.alpha_composite(im.convert('RGBA'),layer).convert('RGB'));camera(im,cx,y+65,.6)
 if stage>=2:
  for a in [.25,.72]:rect(im,(x+ww*a-25,y+hh*.6,x+ww*a+25,y+hh*.77),'#52665c',8)
  px=x+ww*(.5+.3*math.sin(t*1.4+2));py=y+hh*.76
  dot(im,px,py,13,GREEN);dot(im,px,py,5,INK)
 if stage>=3:
  text(im,f'{int(t*2)%19:02d}.0s',xx-20,y+29,23,GREEN,'rm')
  text(im,'MOVE  /  HIDE  /  REPEAT',x+ww/2,yy-24,14,'#b4c4bb','mm')
def caption(im,i,p):
 words=SC[i]['text'].split();chunks=[' '.join(words[k:k+11]) for k in range(0,len(words),11)];s=chunks[min(len(chunks)-1,int(p*len(chunks)))]
 text(im,s,640,665,25,INK,'mm',False)
def frame(t):
 i=max(j for j,s in enumerate(SC) if s['start']<=t);s=SC[i];u=t-s['start'];p=u/(s['end']-s['start'])
 im=Image.new('RGB',(W,H),PAPER);d=ImageDraw.Draw(im)
 text(im,'TOO SOON GAMES',42,31,20);text(im,'THE CREATIVE PROCESS',1238,31,14,MUTED,'rm')
 labels=['THE MOMENT','FIND THE HOOK','MAKE IT A RULE','BUILD + PLAY','FIND THE LOOK','MAKE IT SHAREABLE','LEARN + GROW','NEXT UP']
 text(im,f'0{i+1}',44,85,24,ORANGE);text(im,labels[i],103,85,18,MUTED)
 if i==0:
  text(im,'ONE MOMENT.',55,193,76);text(im,'A WHOLE NEW GAME.',55,281,69)
  rect(im,(55,346,784,572),WHITE,20)
  text(im,'REAL-WORLD INSPIRATION',80,378,14,MUTED)
  text(im,'Coldplay’s concert camera moment',80,423,31)
  text(im,'July 2025  /  Foxborough, Massachusetts',80,468,21,MUTED,b=False)
  text(im,'A public moment becomes a viral story.',80,522,24)
  camera(im,1020,368+math.sin(u*2)*7,2.3)
  for j in range(3):d.arc((920-j*22,275-j*22,1135+j*22,480+j*22),-45,45,fill=ORANGE,width=3)
  text(im,'Event reference: ABC News / GMA',55,607,14,MUTED,b=False)
 elif i==1:
  text(im,'FIND THE PLAYABLE FEELING.',55,171,53)
  for j,(a,b,col) in enumerate([('THE EVENT','A camera finds you.',WHITE),('THE FEELING','Please. Not me.',WHITE),('THE HOOK','Stay out of sight.',GREEN)]):
   x=55+j*410;off=50*(1-ease((u-j*.35)/.8));rect(im,(x,245+off,x+350,484+off),col)
   text(im,a,x+24,287+off,17,MUTED);text(im,b,x+24,360+off,29)
   if j<2:arrow(im,(x+362,365),(x+397,365))
  text(im,'The joke gives us the objective.',640,566,34,INK,'mm')
 elif i==2:
  text(im,'ONE RULE YOU GET IN A SECOND.',55,164,49)
  for j,label in enumerate(['MOVE.','HIDE.','DON’T GET CAUGHT.']):
   yy=255+j*105;x=70+int(70*(1-ease((u-j*.3)/.7)))
   dot(im,x+12,yy,9,ORANGE);text(im,label,x+45,yy,49 if j<2 else 43)
  game(im,(720,219,1224,566),u,3)
  text(im,'A simple mechanic. An instant connection.',55,592,25,MUTED,b=False)
 elif i==3:
  text(im,'MAKE IT PLAYABLE. THEN MAKE IT FUN.',55,166,45)
  stage=1 if u<2 else 2 if u<4 else 3
  game(im,(55,218,865,589),u,stage)
  for j,(label,val) in enumerate([('CAMERA SPEED',.5+.16*math.sin(u)),('HIDING SPACE',.65),('RETRY TIME',.18)]):
   y=264+j*102;text(im,label,920,y,16,MUTED)
   line(im,(925,y+36,1210,y+36),'#d0d6c8',8);line(im,(925,y+36,925+285*val,y+36),INK,8);dot(im,925+285*val,y+36,9,ORANGE)
  text(im,'PLAY → TWEAK → PLAY',920,566,18)
 elif i==4:
  text(im,'GIVE THE IDEA AN IDENTITY.',55,162,53)
  rect(im,(55,218,750,581),INK,20)
  text(im,'CAMERA',88,300,75,GREEN);text(im,'DODGE',88,380,75,WHITE);camera(im,620,344,1.7)
  text(im,'Your 18 seconds of fame.',90,464,33,WHITE,b=False)
  for j,col in enumerate([GREEN,ORANGE,WHITE]):dot(im,105+j*52,538,17,col)
  rect(im,(810,218,1225,581),WHITE,20)
  text(im,'THE SHARE CARD',840,255,16,MUTED)
  text(im,f'{18*ease(u/2):.1f}',1018,363,87,INK,'mm');text(im,'SECONDS UNDETECTED',1018,433,17,MUTED,'mm')
  rect(im,(846,481,1190,544),GREEN,12);text(im,'CAN YOU BEAT THAT?',1018,513,22,INK,'mm')
 elif i==5:
  text(im,'BUILD THE GAME. BUILD THE BUZZ.',55,161,47)
  game(im,(55,226,620,547),u,3)
  text(im,'THE FUNNIEST FIVE SECONDS',55,582,18,MUTED)
  arrow(im,(645,389),(720,389))
  for j,(a,b) in enumerate([('THE CLIP','One moment that makes you laugh.'),('THE LINK','Straight into the game.'),('THE CHALLENGE','A score your friends want to beat.')]):
   y=224+j*121;rect(im,(750,y,1225,y+103),WHITE,14)
   text(im,a,776,y+30,16,MUTED);text(im,b,776,y+70,23)
  if u>4:text(im,'12h  /  READY TO LAUNCH',640,614,23,INK,'mm')
 elif i==6:
  text(im,'THE LAUNCH IS JUST THE START.',55,163,52)
  for j,(a,b) in enumerate([('REPLAYS','Is it fun enough to try again?'),('SHARES','Is it worth sending to a friend?'),('FEEDBACK','What makes the next version better?')]):
   y=242+j*109;text(im,a,65,y,24);text(im,b,420,y,27,MUTED,b=False)
   line(im,(65,y+44,1210,y+44),'#d5d8cb',2)
  # Ambition stays explicit; these are not measurements.
  rect(im,(55,559,1225,616),GREEN,12)
  text(im,'THE AMBITION: 1M VIEWS IN 24h. NEWS COVERAGE IN 48h.',640,588,23,INK,'mm')
  text(im,'Illustrative goals, not actual results',1230,632,12,MUTED,'rm',False)
 else:
  text(im,'TOO SOON',640,229,103,INK,'mm');text(im,'GAMES',640,330,103,INK,'mm')
  rect(im,(220,418,1060,492),GREEN,14)
  text(im,'MAKE THE MOMENT PLAYABLE.',640,454,36,INK,'mm')
  text(im,'The next idea is already out there.',640,554,29,MUTED,'mm',False)
 # Quick, gentle entrance wipe; no flash or pressure-inducing countdown.
 if u<.35:
  edge=int(W*ease(u/.35));ImageDraw.Draw(im).rectangle((edge,110,W,638),fill=PAPER)
 caption(im,i,p)
 for j in range(8):
  x=42+j*150;line(im,(x,707,x+133,707),INK if j<i else '#d3d7cb',4)
  if j==i:line(im,(x,707,x+133*p,707),ORANGE,4)
 return im
def sound():
 sr=24000;n=sr*60;a=np.zeros(n,np.float32);rng=np.random.default_rng(23);beat=60/116;report=[]
 def add(st,sig):
  k=int(st*sr);m=min(len(sig),n-k)
  if k>=0 and m>0:a[k:k+m]+=sig[:m]
 for k in range(int(60/beat)*2):
  z=np.arange(int(sr*.4))/sr;note=[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,65]][(k//16)%4][k%4];hz=440*2**((note-69)/12)
  add(k*beat/2,np.sin(2*np.pi*hz*z)*np.exp(-z*12)*.025)
  if k%2==0:add(k*beat/2,np.sin(2*np.pi*65*z)*np.exp(-z*35)*.025)
 for st in [0,7,15,23,33,41,49,56]:
  for j,hz in enumerate([660,880]):
   z=np.arange(int(sr*.16))/sr;add(st+j*.08,np.sin(2*np.pi*hz*z)*np.exp(-z*25)*.04)
 for i,s in enumerate(SC):
  src=B/f'voice-{i}.mp3'
  def decode(rate=1):
   cmd=[FF,'-v','error','-i',str(src)]
   if rate>1:cmd+=['-af',f'atempo={rate}']
   return np.frombuffer(subprocess.check_output(cmd+['-f','f32le','-ac','1','-ar',str(sr),'-']),dtype='<f4').copy()
  v=decode();duration=len(v)/sr;rate=max(1,duration/(s['end']-s['start']-.3));v=decode(rate);v*=.7/max(.01,float(np.max(np.abs(v))));add(s['start']+.12,v)
  report.append({'scene':i,'duration':duration,'speed':rate})
 a*=np.minimum(1,(n-np.arange(n))/sr/.5);a=np.clip(a,-.96,.96)
 with wave.open(str(B/'mix.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((a*32767).astype('<i2').tobytes())
 (B/'audio-report.json').write_text(json.dumps(report,indent=2))
if __name__=='__main__':
 if '--preview' in sys.argv:
  for t in [4,11,19,27,37,45,53,58]:frame(t).save(B/f'preview-{t}.jpg',quality=95)
 else:
  sound();proc=subprocess.Popen([FF,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r','24','-i','-','-i',str(B/'mix.wav'),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-t','60','-movflags','+faststart',str(P/'Too-Soon-Games-Creative-Process-EN.mp4')],stdin=subprocess.PIPE)
  for k in range(1440):
   proc.stdin.write(frame(k/24).tobytes())
   if k%240==0:print(f'{k//24}/60 seconds',flush=True)
  proc.stdin.close();assert proc.wait()==0
  print('Complete',flush=True)
