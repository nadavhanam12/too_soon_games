"""Deterministic, original mobile environment textures. Python + Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import random, math, json
OUT=Path(__file__).resolve().parents[1]/'assets-src'/'models'/'textures'
OUT.mkdir(parents=True,exist_ok=True)
r=random.Random(63)
def noise(n,base,amount):
    im=Image.new('RGB',(n,n)); im.putdata([tuple(max(0,min(255,b+r.randint(-amount,amount))) for b in base) for _ in range(n*n)]); return im
atlas=Image.new('RGB',(1024,1024))
for k in range(4):
    tile=noise(512,[(184,178,169),(161,132,120),(157,170,171),(168,169,164)][k],5)
    d=ImageDraw.Draw(tile)
    if k==1:
        for y in range(0,512,32):
            d.line((0,y,511,y),fill=(126,115,110),width=2)
            for x in range(-64,576,96): d.line((x+(48 if y//32%2 else 0),y,x+(48 if y//32%2 else 0),y+32),fill=(126,115,110),width=2)
    elif k==2:
        for y in range(0,512,32):
            d.line((0,y,511,y),fill=(115,133,137),width=3); d.line((0,y+3,511,y+3),fill=(185,195,193),width=1)
    else:
        for y in range(0,512,128):
            d.line((0,y,511,y),fill=(145,145,140),width=2)
        for x in range(0,512,256): d.line((x,0,x,511),fill=(150,150,144),width=2)
    # Painted depth under ledges and small weather streaks, no dynamic AO cost.
    shade=Image.new('RGB',(512,512)); shade.putdata([tuple(int(c*(.85+.15*min(1,(y%128)/14))) for c in tile.getpixel((x,y))) for y in range(512) for x in range(512)])
    atlas.paste(shade,((k%2)*512,(k//2)*512))
atlas.save(OUT/'facade-atlas.png',optimize=True)
road=noise(512,(111,116,125),10); d=ImageDraw.Draw(road)
for _ in range(9):
    x,y=r.randrange(512),r.randrange(512); pts=[(x,y)]
    for j in range(r.randint(3,7)): x+=r.randint(-18,18); y+=r.randint(7,20); pts.append((x,y))
    d.line(pts,fill=(78,83,91),width=1)
road.save(OUT/'asphalt.png',optimize=True)
pave=noise(256,(172,172,166),3); d=ImageDraw.Draw(pave)
for y in range(0,256,64):
    d.line((0,y,255,y),fill=(128,134,132),width=2)
    for x in range(0,256,128): d.line((x+(64 if y//64%2 else 0),y,x+(64 if y//64%2 else 0),y+64),fill=(128,134,132),width=2)
pave.save(OUT/'pavement.png',optimize=True)
for name in ('facade-atlas','asphalt','pavement'):
    Image.open(OUT/(name+'.png')).save(OUT/(name+'.webp'),quality=82,method=6)
(OUT/'manifest.json').write_text(json.dumps({'facade-atlas.png':{'size':[1024,1024],'tiles':['stucco','brick','siding','concrete'],'layout':'top-left, top-right, bottom-left, bottom-right; 512px each'},'asphalt.png':{'size':[512,512],'repeat':True},'pavement.png':{'size':[256,256],'repeat':True},'note':'sRGB base colour only; lighting-like painted shading is stylistic, not a physical lightmap. Original procedural assets; no external licences.'},indent=2))
print('Textures generated:',OUT)
