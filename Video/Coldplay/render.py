"""Reproducible 60-second Hebrew motion-graphics film; original musical bed."""
from pathlib import Path
import sys, json, math, subprocess, wave
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'.video-tools'))
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps
from bidi.algorithm import get_display
import imageio_ffmpeg
P=Path(__file__).resolve().parent; B=P/'build'; B.mkdir(exist_ok=True)
W,H,FPS=1280,720,24
FF=imageio_ffmpeg.get_ffmpeg_exe()
SC=json.loads((P/'scenes.json').read_text(encoding='utf-8'))
SHEET=Image.open(P/'story-art.png').convert('RGB')
sw,sh=SHEET.size
PANELS=[SHEET.crop((c*sw//2+3,r*sh//3+3,(c+1)*sw//2-3,(r+1)*sh//3-3)) for r in range(3) for c in range(2)]
PHOTO=Image.open(P/'event-source.jpg').convert('RGB')
NAVY=(16,22,43); WHITE=(249,248,255); MINT=(132,242,208); CORAL=(255,133,146)
FONTS={}
def font(s,b=False):
    key=(s,b)
    if key not in FONTS: FONTS[key]=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf' if b else 'C:/Windows/Fonts/arial.ttf',s)
    return FONTS[key]
def text(im,txt,x,y,size=32,color=WHITE,anchor='mm',bold=False):
    ImageDraw.Draw(im).text((x,y),get_display(txt),font=font(size,bold),fill=color,anchor=anchor)
def rect(im,box,fill,r=16): ImageDraw.Draw(im).rounded_rectangle(box,radius=r,fill=fill)
def fit(img,w,h): return ImageOps.fit(img,(int(w),int(h)),method=Image.Resampling.LANCZOS)
def cover(panel,p):
    # Gentle movement instead of a stressful countdown.
    z=1.0+.045*p
    base=fit(panel,W*z,H*z)
    x=(base.width-W)//2; y=(base.height-H)//2
    return base.crop((x,y,x+W,y+H)).convert('RGBA')
def wrapped(txt,max_width,size):
    words=txt.split(); lines=[]; line=''
    for word in words:
        cand=(line+' '+word).strip()
        if font(size).getlength(get_display(cand))>max_width and line: lines.append(line);line=word
        else:line=cand
    if line:lines.append(line)
    return lines
def chrome(im,i,t,p):
    layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer)
    for y in range(170):d.line((0,y,W,y),fill=(*NAVY,int(235*(1-y/170))))
    for y in range(510,720):d.line((0,y,W,y),fill=(*NAVY,int(245*(y-510)/210)))
    im.alpha_composite(layer)
    text(im,'TOO SOON / GAMES',36,30,21,MINT,'lm',True)
    text(im,SC[i][3],W-40,88,42,WHITE,'rm',True)
    rect(im,(1020,14,1242,52),(*NAVY,230),12)
    text(im,SC[i][2],1065,33,22,MINT)
    text(im,'מאז האירוע',1227,33,18,WHITE,'rm')
    # Full narration is retained as paced readable Hebrew captions.
    lines=wrapped(SC[i][4],1110,29)
    groups=[lines[n:n+2] for n in range(0,len(lines),2)]
    group=groups[min(len(groups)-1,int(p*len(groups)))]
    for j,line in enumerate(group):text(im,line,640,637+j*35,29,WHITE)
    d=ImageDraw.Draw(im)
    d.line((40,706,1240,706),fill=(70,77,95),width=3)
    d.line((40,706,40+1200*t/60,706),fill=MINT,width=3)
def frame(t):
    i=max(j for j,s in enumerate(SC) if s[0]<=t)
    s=SC[i];p=(t-s[0])/(s[1]-s[0]);u=t-s[0]
    panel=[0,1,2,3,4,4,5,1][i]
    im=cover(PANELS[panel],p)
    if i==0:
        if u<1.8:
            rect(im,(45,400,390,470),(*NAVY,245))
            text(im,'גל',360,426,28,MINT,'rm',True)
            text(im,'הפייפליין איתר אירוע חדש',360,454,21,WHITE,'rm')
        else:
            im=Image.new('RGBA',(W,H),NAVY)
            pic=ImageOps.contain(PHOTO,(430,465),Image.Resampling.LANCZOS)
            im.paste(pic,(105+(430-pic.width)//2,135))
            text(im,'COLDPLAY',1170,225,55,MINT,'rm',True)
            text(im,'המצלמה תפסה רגע.',1170,300,38,WHITE,'rm',True)
            text(im,'האינטרנט תפס סיפור.',1170,350,38,WHITE,'rm',True)
            text(im,'האירוע האמיתי • יולי 2025',1170,425,25,CORAL,'rm')
            text(im,'צילום מהאירוע: ABC News / GMA',1170,465,18,WHITE,'rm')
            text(im,'מועמד חדש למשחק',1170,530,26,MINT,'rm')
    elif i==1:
        for x,name in [(225,'גל'),(640,'נדב'),(1055,'אור')]:
            rect(im,(x-72,452,x+72,495),(*NAVY,230),12);text(im,name,x,473,27,MINT,bold=True)
        if u<3:
            for x,label in [(220,'רגע ספורטיבי'),(640,'מצלמת קולדפליי'),(1060,'טרנד פופ')]:
                rect(im,(x-165,535,x+165,586),(*NAVY,245));text(im,label,x,560,25,MINT if x==640 else WHITE)
        else:
            rect(im,(390,535,890,586),(*NAVY,245));text(im,'בוחרים יחד: מוכר, מצחיק, שחיק',640,560,26)
    elif i==2:
        for x,name in [(310,'נדב'),(970,'אור')]:
            rect(im,(x-90,475,x+90,520),(*NAVY,230));text(im,name,x,497,27,MINT,bold=True)
        text(im,'REMOTE / BUILD + SHARE',640,568,22,MINT,bold=True)
    elif i==3:
        # Animated camera framing overlays the illustrated game.
        x=int(660+230*math.sin(u*.9));y=int(225+35*math.cos(u))
        d=ImageDraw.Draw(im)
        for dx,dy,a,b in [(0,0,1,1),(300,0,-1,1),(0,220,1,-1),(300,220,-1,-1)]:
            d.line((x-150+dx,y+dy,x-150+dx+a*35,y+dy),fill=MINT,width=5)
            d.line((x-150+dx,y+dy,x-150+dx,y+dy+b*35),fill=MINT,width=5)
        rect(im,(50,160,300,208),(*NAVY,240));text(im,f'{int(u*3):02d} שניות בלי להיתפס',175,184,23,MINT)
        if u>3.5:
            rect(im,(405,485,875,548),(*NAVY,245));text(im,'הכוס הזאת לא תציל אותנו',640,516,29,CORAL,bold=True)
    elif i==4:
        rect(im,(340,170,940,290),(*NAVY,235),24)
        text(im,'המשחק באוויר!',640,214,48,MINT,bold=True)
        text(im,'קליפ קצר. קישור. עוד ניסיון.',640,264,27)
        if u>3:
            rect(im,(400,443,880,552),(*NAVY,240),20)
            text(im,'שרדתי 18 שניות. ואתם?',640,480,31,WHITE,bold=True)
            text(im,'משתפים תוצאה עם חברים',640,524,23,MINT)
    elif i==5:
        veil=Image.new('RGBA',(W,H),(*NAVY,155));im.alpha_composite(veil)
        q=min(1,u/5);q=1-(1-q)**3
        text(im,f'{int(1000000*q):,}',640,250,104,MINT,bold=True)
        text(im,'צפיות מצטברות בקליפים ובפוסטים',640,325,31)
        text(im,f'{int(20000*q):,}',640,414,65,WHITE,bold=True)
        text(im,'כניסות למשחק',640,466,28)
        text(im,'תרחיש הצלחה להמחשה • לא נתוני אמת',640,535,22,CORAL,bold=True)
    elif i==6:
        rect(im,(35,112,300,150),(*NAVY,245));text(im,'חדשות הרשת | הדמיה',168,131,21,MINT,bold=True)
        rect(im,(40,490,1240,580),(*NAVY,245),8)
        text(im,'הרגע בקולדפליי הפך למשחק רשת',1205,521,35,WHITE,'rm',True)
        text(im,'כתבה בדיונית להמחשת החזון',1205,559,23,CORAL,'rm')
        if u>4.5:
            rect(im,(520,422,940,478),(*NAVY,245));text(im,'רגע, אתה על מיוט!',730,450,29,MINT,bold=True)
    else:
        im.alpha_composite(Image.new('RGBA',(W,H),(*NAVY,180)))
        text(im,'TOO SOON',640,260,91,MINT,bold=True)
        text(im,'GAMES',640,347,86,WHITE,bold=True)
        text(im,'האירוע הבא כבר בדרך.',640,445,37,WHITE,bold=True)
        for x,name in [(480,'גל'),(640,'נדב'),(800,'אור')]:text(im,name,x,515,27,CORAL,bold=True)
    chrome(im,i,t,p)
    # Brief fade between cuts, preserving readability during the rest of each scene.
    fade=min(1,u/.25,(s[1]-t)/.2)
    if fade<1: im=Image.blend(Image.new('RGBA',(W,H),NAVY),im,max(.25,fade))
    return im.convert('RGB')
def music():
    sr=24000;n=sr*60; a=np.zeros(n,dtype=np.float32)
    rng=np.random.default_rng(42); beat=60/104
    # Original soft plucked major-seventh progression, light kick and shaker.
    chords=[[48,52,55,59],[45,48,52,55],[53,57,60,64],[55,59,62,65]]
    def add(start,sig):
        k=int(start*sr);m=min(len(sig),n-k)
        if k>=0 and m>0:a[k:k+m]+=sig[:m]
    for j in range(int(60/beat)*2):
        st=j*beat/2;ch=chords[(j//16)%4];note=ch[j%4]+12;f=440*2**((note-69)/12)
        tt=np.arange(int(sr*.6))/sr
        sig=(np.sin(2*np.pi*f*tt)+.25*np.sin(4*np.pi*f*tt))*np.exp(-tt*7)*.055
        add(st,sig)
        if j%2==0:
            tt=np.arange(int(sr*.16))/sr
            add(st,np.sin(2*np.pi*(65*tt-90*tt**2))*np.exp(-tt*28)*.07)
        else:
            tt=np.arange(int(sr*.045))/sr;add(st,rng.normal(0,1,len(tt))*np.exp(-tt*95)*.013)
    a*=np.minimum(1,np.arange(n)/sr/1.5)*np.minimum(1,(n-np.arange(n))/sr/2)
    with wave.open(str(B/'music.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((a*32767).astype('<i2').tobytes())
def audio():
    music();sr=24000;voice=np.zeros(sr*60,dtype=np.float32);have=True;timings=[]
    for i,s in enumerate(SC):
        src=B/f'voice-{i}.mp3'
        if not src.exists() or src.stat().st_size<100:have=False;continue
        raw=subprocess.check_output([FF,'-v','error','-i',str(src),'-f','f32le','-ac','1','-ar',str(sr),'-'])
        vals=np.frombuffer(raw,dtype='<f4');duration=len(vals)/sr;avail=s[1]-s[0]-.4;rate=max(1,duration/avail)
        if rate>1:
            raw=subprocess.check_output([FF,'-v','error','-i',str(src),'-af',f'atempo={rate}', '-f','f32le','-ac','1','-ar',str(sr),'-']);vals=np.frombuffer(raw,dtype='<f4')
        k=int((s[0]+.18)*sr);m=min(len(vals),len(voice)-k);voice[k:k+m]+=vals[:m]
        timings.append({'scene':i,'original_seconds':duration,'speed':rate})
    with wave.open(str(B/'music.wav'),'rb') as w:bed=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float32)/32767
    mix=np.clip(voice*.9+bed*(.6 if have else 1.7),-.98,.98)
    with wave.open(str(B/'mix.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((mix*32767).astype('<i2').tobytes())
    (B/'audio-report.json').write_text(json.dumps({'complete_narration':have,'timings':timings},indent=2))
    return have
if __name__=='__main__':
    if '--preview' in sys.argv:
        for t in [4,11,19,26,34,44,53,58]:frame(t).save(B/f'preview-{t}.jpg',quality=90)
        print('Previews ready');sys.exit()
    narrated=audio()
    name='Too-Soon-Games-60s.mp4' if narrated else 'Too-Soon-Games-60s-captioned.mp4'
    command=[FF,'-y','-v','error','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(B/'mix.wav'),'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-t','60','-movflags','+faststart',str(P/name)]
    proc=subprocess.Popen(command,stdin=subprocess.PIPE)
    for f in range(60*FPS):
        proc.stdin.write(frame(f/FPS).tobytes())
        if f%(FPS*10)==0:print(f'Rendered {f/FPS:.0f}/60 seconds',flush=True)
    proc.stdin.close()
    if proc.wait()!=0:raise RuntimeError('Video encoder failed')
    frame(44).save(P/'poster.jpg',quality=95)
    print('Saved',P/name,flush=True)
