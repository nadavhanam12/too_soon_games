from pathlib import Path
import sys, math, json, subprocess, wave
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'.video-tools'))
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageOps
import imageio_ffmpeg
P=Path(__file__).parent;B=P/'build';B.mkdir(exist_ok=True)
W,H,FPS=1280,720,24;FF=imageio_ffmpeg.get_ffmpeg_exe()
SC=json.loads((P/'narration.json').read_text());F={}
BG='#0c1022';WHITE='#f5f5ff';MINT='#8bffd6';PURPLE='#a191ff';PINK='#ff799a';MUTED='#9ba6c5';ORANGE='#ffbc7b'
photo=Image.open(P.parent/'Coldplay/event-source.jpg').convert('RGB')
def font(n,b=False):
 if (n,b) not in F:F[n,b]=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf' if b else 'C:/Windows/Fonts/arial.ttf',n)
 return F[n,b]
def txt(im,s,x,y,n=28,c=WHITE,b=False,anchor='lm'):
 ImageDraw.Draw(im).text((x,y),s,font=font(n,b),fill=c,anchor=anchor)
def box(im,xy,c='#1b2340',r=20,outline=None,width=2):ImageDraw.Draw(im).rounded_rectangle(tuple(map(int,xy)),r,fill=c,outline=outline,width=width)
def line(im,pts,c=MINT,w=3):ImageDraw.Draw(im).line(pts,fill=c,width=w)
def circle(im,x,y,r,c):ImageDraw.Draw(im).ellipse((x-r,y-r,x+r,y+r),fill=c)
def ease(p):return 1-(1-max(0,min(1,p)))**3
def wrap(s,n=28,m=1120):
 lines=[];cur=''
 for w in s.split():
  v=(cur+' '+w).strip()
  if font(n).getlength(v)>m and cur:lines.append(cur);cur=w
  else:cur=v
 if cur:lines.append(cur)
 return lines
def bg(t):
 im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
 for x in range(-60,1340,60):d.line((x+int(t*5)%60,0,x+int(t*5)%60,H),fill='#121a30')
 for y in range(0,H,60):d.line((0,y,W,y),fill='#121a30')
 return im
def header(im,label,clock):
 txt(im,'TOO SOON',42,33,20,MINT,True);txt(im,'GAMES',157,33,20,WHITE,True)
 txt(im,label,42,83,42,WHITE,True)
 txt(im,'SINCE THE MOMENT',1236,25,13,MUTED,anchor='rm')
 txt(im,clock,1236,55,28,MINT,True,'rm')
def person(im,x,y,s,col,phase=0,duck=False,glasses=False):
 # Native 2D arcade character, with articulated limbs and squash animation.
 d=ImageDraw.Draw(im);off=12*s if duck else 0;y+=off
 step=math.sin(phase)*8*s if not duck else 0
 line(im,(x-8*s,y+28*s,x-13*s-step,y+55*s-off),col,max(2,int(8*s)))
 line(im,(x+8*s,y+28*s,x+13*s+step,y+55*s-off),col,max(2,int(8*s)))
 box(im,(x-18*s,y-3*s,x+18*s,y+32*s),col,int(9*s))
 line(im,(x-15*s,y+3*s,x-27*s,y+18*s+step/2),ORANGE,max(2,int(7*s)))
 line(im,(x+15*s,y+3*s,x+27*s,y+18*s-step/2),ORANGE,max(2,int(7*s)))
 circle(im,x,y-22*s,19*s,ORANGE)
 d.pieslice((x-20*s,y-45*s,x+20*s,y-13*s),180,360,fill='#2c2139')
 if glasses:
  for a in [-8,8]:d.ellipse((x+(a-6)*s,y-29*s,x+(a+6)*s,y-17*s),outline=BG,width=max(1,int(s*2)))
 for a in [-7,7]:circle(im,x+a*s,y-23*s,2*s,BG)
 d.arc((x-5*s,y-20*s,x+5*s,y-12*s),0,180,fill=BG,width=max(1,int(s*2)))
def camera(im,x,y):
 box(im,(x-31,y-17,x+26,y+20),PINK,9)
 ImageDraw.Draw(im).polygon([(x+26,y-10),(x+47,y-21),(x+47,y+23),(x+26,y+12)],fill=PINK)
 circle(im,x-12,y,8,BG)
def gameplay(im,t,area=(70,145,1210,590),caught=False,build=1):
 x0,y0,x1,y1=area;ww=x1-x0;hh=y1-y0;d=ImageDraw.Draw(im)
 box(im,area,'#171b38',24,PURPLE,2)
 # stage and crowd stay within the game viewport.
 box(im,(x0+ww*.25,y0+20,x0+ww*.75,y0+90),'#28224e',12)
 txt(im,'COLDPLAY / CAMERA DODGE',x0+ww/2,y0+53,21,PURPLE,True,'mm')
 for k in range(8):
  xx=x0+55+k*(ww-110)/7;circle(im,xx,y0+100,4,MINT if k%2 else PINK)
 for row in range(3):
  for col in range(13):
   xx=x0+40+col*(ww-80)/12;yy=y0+155+row*80
   circle(im,xx,yy+math.sin(t*2+col)*3,10,'#34365b')
   box(im,(xx-12,yy+12,xx+12,yy+37),'#282e50',6)
 if build<.25:return
 cx=x0+ww*(.5+.36*math.sin(t*.85));cy=y0+105
 if build>.5:
  overlay=Image.new('RGBA',(W,H));od=ImageDraw.Draw(overlay)
  od.polygon([(cx,cy),(cx-100,y1-8),(cx+100,y1-8)],fill=(255,121,154,35))
  im.paste(Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB'))
  camera(im,cx,cy)
 px=x0+ww*(.5+.27*math.sin(t*1.25));py=y0+hh*.62
 if caught:px=cx
 if build>.75:
  person(im,px-22,py,1.12,MINT,t*7,math.sin(t*2)>0)
  person(im,px+24,py+10,1.06,PURPLE,t*7+2,math.sin(t*2)>0)
  box(im,(px-15,py+30,px+15,py+55),'#f2e9d5',4)
  txt(im,'HIDE',px,py+43,11,BG,True,'mm')
 txt(im,f'{int(t*2)%19:02d}s',x1-23,y0+34,26,MINT,True,'rm')
 if caught:
  box(im,(x0+ww*.2,y0+hh*.36,x0+ww*.8,y0+hh*.7),BG,14,PINK,3)
  txt(im,"TOO LATE. YOU'RE FAMOUS.",x0+ww*.5,y0+hh*.48,30,PINK,True,'mm')
  txt(im,'TRY AGAIN',x0+ww*.5,y0+hh*.61,22,MINT,True,'mm')
def cursor(im,x,y,c,label):
 d=ImageDraw.Draw(im);d.polygon([(x,y),(x+7,y+28),(x+14,y+18),(x+26,y+15)],fill=c)
 box(im,(x+20,y+22,x+105,y+50),c,8);txt(im,label,x+62,y+36,16,BG,True,'mm')
def phone(im,x,y,scale=1,score=18):
 ww=170*scale;hh=295*scale
 box(im,(x-ww/2,y-hh/2,x+ww/2,y+hh/2),'#080c1a',22,MUTED)
 box(im,(x-ww/2+9,y-hh/2+26,x+ww/2-9,y+hh/2-12),'#252040',14)
 txt(im,'DON’T GET',x,y-85*scale,int(17*scale),WHITE,True,'mm');txt(im,'CAUGHT',x,y-61*scale,int(24*scale),MINT,True,'mm')
 person(im,x,y-4*scale,.9*scale,PURPLE,0)
 txt(im,f'{score} SECONDS',x,y+72*scale,int(18*scale),WHITE,True,'mm')
 box(im,(x-65*scale,y+95*scale,x+65*scale,y+125*scale),MINT,8)
 txt(im,'BEAT MY SCORE',x,y+110*scale,int(12*scale),BG,True,'mm')
def frame(t):
 i=max(j for j,s in enumerate(SC) if s['start']<=t);s=SC[i];u=t-s['start'];p=u/(s['end']-s['start'])
 im=bg(t)
 if i==0:
  header(im,'DON’T GET CAUGHT','THE GAME');gameplay(im,t,caught=u>2.8)
  if u>4:box(im,(470,540,810,599),MINT);txt(im,'<< REWIND',640,569,29,BG,True,'mm')
 elif i==1:
  header(im,'IT STARTED WITH THIS.','00h')
  ph=ImageOps.contain(photo,(335,430));im.paste(ph,(65,148))
  txt(im,'REAL EVENT / JULY 2025',65,602,15,MUTED)
  txt(im,'Image: ABC News / GMA',65,622,13,MUTED)
  txt(im,'TREND RADAR',480,169,17,PURPLE,True)
  for j,(a,b) in enumerate([('SPORT','An unexpected finish'),('COLDPLAY','The camera caught a moment'),('POP CULTURE','A new internet obsession')]):
   yy=210+j*104;xx=480+int(80*(1-ease((u-j*.25)/1.3)))
   box(im,(xx,yy,1195,yy+84),'#202943' if j!=1 else '#273b42',15,MINT if j==1 else None)
   txt(im,a,xx+20,yy+25,16,MINT if j==1 else MUTED,True);txt(im,b,xx+20,yy+57,25)
  txt(im,'Gal  /  Event discovery',480,572,20,MINT)
 elif i==2:
  header(im,'WAIT… THAT’S A GAME.','02h')
  for j,(name,c) in enumerate([('Gal',MINT),('Nadav',PINK),('Or',PURPLE)]):
   x=240+j*400;box(im,(x-170,145,x+170,355),'#1b2340',20,c)
   # Different room backdrops establish remote work.
   if j==0:box(im,(x-130,165,x-60,242),'#35405d',4)
   if j==1:line(im,(x+80,165,x+80,265),ORANGE,4);circle(im,x+80,180,22,'#5b443d')
   if j==2:
    for z in range(4):line(im,(x-120+z*70,180,x-120+z*70,300),'#35445b',3)
   person(im,x,247,1.2,c,u*1.4,False,j==0);txt(im,name,x,330,22,c,True,'mm')
  box(im,(280,400,1000,555),'#253344',20,MINT)
  txt(im,'COLDPLAY → CAMERA DODGE',640,442,30,MINT,True,'mm')
  txt(im,'Recognizable. Funny. Playable.',640,490,29,WHITE,False,'mm')
  for j,(name,c) in enumerate([('Gal',MINT),('Nadav',PINK),('Or',PURPLE)]):
   cursor(im,350+j*200+int(20*math.sin(u+j)),515+int(10*math.cos(u+j)),c,name)
  txt(im,'REMOTE CALL  /  ONE SHARED IDEA',640,603,16,MUTED,False,'mm')
 elif i==3:
  header(im,'ONE MOMENT. ONE SIMPLE GAME.','05h' if u<4 else '08h')
  gameplay(im,u,build=min(1,.2+u*.25),caught=7<u<8.2)
  if u<3:
   box(im,(110,510,600,563),BG,10);txt(im,'Nadav + Or / build + launch prep',135,537,21,MINT)
  elif 4<u<6.5:
   box(im,(350,504,930,565),BG,10);txt(im,'We’re going to need a bigger cup.',640,534,27,ORANGE,True,'mm')
  elif u>9:
   box(im,(90,500,610,569),BG,10);txt(im,'The funny moment becomes the promo.',115,535,23,MINT)
 elif i==4:
  header(im,'STILL TRENDING. ALREADY PLAYABLE.','12h')
  phone(im,640,365,1.3)
  for j,label in enumerate(['HUMOR PAGES','COMMUNITIES','PLAYER SHARES']):
   x=210 if j!=1 else 1070;y=220+j*140
   box(im,(x-140,y-35,x+140,y+35),'#232a46',14)
   txt(im,label,x,y,19,MINT,True,'mm')
   line(im,(x+(150 if x<640 else -150),y,640+(-125 if x<640 else 125),365),PURPLE,3)
   q=(u*.5+j*.3)%1;startx=x+(150 if x<640 else -150);endx=640+(-125 if x<640 else 125);xx=startx+(endx-startx)*q;yy=y+(365-y)*q;circle(im,xx,yy,7,MINT)
  txt(im,'One link. No download. Your turn.',640,595,27,WHITE,True,'mm')
 elif i==5:
  header(im,'OKAY, THIS ESCAPED OUR GROUP CHAT.','24h')
  q=ease(u/5)
  txt(im,f'{int(1000000*q):,}',640,235,98,MINT,True,'mm')
  txt(im,'CONTENT VIEWS',640,305,23,MUTED,True,'mm')
  txt(im,f'{int(20000*q):,}',640,398,64,WHITE,True,'mm')
  txt(im,'GAME VISITS',640,448,22,MUTED,True,'mm')
  for j in range(20):
   ang=j*2.399;rad=240+40*math.sin(j);xx=640+rad*1.8*math.cos(ang);yy=340+rad*.7*math.sin(ang)
   circle(im,xx,yy,4+(j%3),[MINT,PINK,PURPLE][j%3])
  txt(im,'Players bring players.',640,525,30,PURPLE,True,'mm')
  box(im,(380,568,900,603),'#30283b',10);txt(im,'ILLUSTRATIVE SUCCESS SCENARIO',640,586,17,ORANGE,True,'mm')
 elif i==6:
  header(im,'NOW OUR GAME IS THE STORY.','48h')
  box(im,(65,150,1215,585),'#202842',20)
  txt(im,'THE INTERNET DESK',95,183,20,MINT,True)
  box(im,(90,220,460,475),'#302c52',10);person(im,275,330,2,PURPLE,u)
  txt(im,'VIRAL MOMENT',520,263,38,WHITE,True);txt(im,'BECOMES A GAME',520,313,38,MINT,True)
  txt(im,'A concert clip. A playable challenge.',520,368,24)
  txt(im,'A remote team moving fast.',520,407,24)
  box(im,(90,503,1190,559),BG,8);txt(im,'TOO SOON GAMES TAKES THE MOMENT ONLINE',114,531,25,WHITE,True)
  txt(im,'IMAGINED NEWS COVERAGE',640,612,16,ORANGE,True,'mm')
 elif i==7:
  txt(im,'TOO SOON',640,245,96,MINT,True,'mm');txt(im,'GAMES',640,340,96,WHITE,True,'mm')
  txt(im,'MAKE THE MOMENT PLAYABLE.',640,438,30,PURPLE,True,'mm')
  box(im,(400,525,880,584),'#223748',16);circle(im,430,555,6,MINT)
  txt(im,'Next viral moment detected.',460,555,23,MINT)
 # English captions, high-contrast and paced in short chunks.
 words=s['text'].split();chunks=[' '.join(words[k:k+12]) for k in range(0,len(words),12)]
 cap=chunks[min(len(chunks)-1,int(p*len(chunks)))];ls=wrap(cap,25,1150)
 box(im,(24,640,1256,700),BG,8)
 for j,l in enumerate(ls):txt(im,l,640,659+j*26,25,WHITE,False,'mm')
 line(im,(40,711,1240,711),'#27304a',3);line(im,(40,711,40+1200*t/60,711),MINT,3)
 return im
def sound(music_bpm=108):
 sr=24000;n=sr*60;a=np.zeros(n,np.float32);music=np.zeros(n,np.float32);rng=np.random.default_rng(8)
 def add(dst,start,sig):
  k=int(start*sr);m=min(len(sig),n-k)
  if k>=0 and m>0:dst[k:k+m]+=sig[:m]
 def tone(f,d=.18,amp=.1):
  z=np.arange(int(sr*d))/sr;return np.sin(2*np.pi*f*z)*np.exp(-z*18)*amp
 beat=60/music_bpm
 for k in range(int(60/beat)*2):
  tm=k*beat/2;note=[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,65]][(k//16)%4][k%4]
  add(music,tm,tone(440*2**((note-69)/12),.5,.025))
  if k%2==0:
   z=np.arange(int(sr*.15))/sr;add(music,tm,np.sin(2*np.pi*(70*z-100*z*z))*np.exp(-z*30)*.035)
 for tm in [5.2,12.2,18,33.2,36,39,42.2,57.3]:
  for j,f in enumerate([660,880,1100]):add(a,tm+j*.075,tone(f,.16,.075))
 for tm in [2.8,27]:
  z=np.arange(int(sr*.11))/sr;add(a,tm,rng.normal(0,1,len(z))*np.exp(-z*60)*.16)
 for tm in np.arange(43,47,.35):add(a,tm,tone(700+(tm-43)*120,.1,.045))
 report=[]
 for i,s in enumerate(SC):
  raw=subprocess.check_output([FF,'-v','error','-i',str(B/f'voice-{i}.wav'),'-f','f32le','-ar',str(sr),'-ac','1','-'])
  v=np.frombuffer(raw,dtype='<f4');duration=len(v)/sr;rate=max(1,duration/(s['end']-s['start']-.25))
  if rate>1:
   raw=subprocess.check_output([FF,'-v','error','-i',str(B/f'voice-{i}.wav'),'-af',f'atempo={rate}','-f','f32le','-ar',str(sr),'-ac','1','-']);v=np.frombuffer(raw,dtype='<f4')
  peak=max(.01,float(np.max(np.abs(v))));v=v*(.68/peak)
  add(a,s['start']+.1,v);report.append({'scene':i,'original_duration':duration,'speed':rate})
 fade=np.minimum(1,np.arange(n)/sr)*np.minimum(1,(n-np.arange(n))/sr/1.3)
 a=np.clip((a+music)*fade,-.95,.95)
 with wave.open(str(B/'mix.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((a*32767).astype('<i2').tobytes())
 (B/'audio-report.json').write_text(json.dumps(report,indent=2))
if __name__=='__main__':
 if '--preview' in sys.argv:
  for t in [1,4,8,16,25,35,47,54,58]:frame(t).save(B/f'preview-{t}.jpg',quality=92)
 else:
  sound()
  proc=subprocess.Popen([FF,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r',str(FPS),'-i','-','-i',str(B/'mix.wav'),'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-t','60','-movflags','+faststart',str(P/'Too-Soon-Games-Arcade-EN.mp4')],stdin=subprocess.PIPE)
  for k in range(60*FPS):
   proc.stdin.write(frame(k/FPS).tobytes())
   if k%(FPS*10)==0:print(f'{k//FPS}/60 seconds',flush=True)
  proc.stdin.close();assert proc.wait()==0
  frame(25).save(P/'poster.jpg',quality=95)
  print('Video complete',flush=True)
