"""Clear a game's interface off part of a frame by painting the clean art back over it (a still for a launch clip).
   python -I paint-over.py <frame.jpg> <art image> <x> <y> <w> <from_row> <fill #rrggbb> <out.png>
The art is drawn at (x, y), w wide (its own aspect), exactly where the game draws it, but only from <from_row> down: the
rows above stay the game's (its top bar, and anything the game paints onto the art there, e.g. Nice City's LAUNCH DAY
sticker over the calendar's real-brand header). Below the art's bottom edge the frame is filled with <fill>.
Find x / y / w by matching the art against the frame (Nice City's conversation portrait: 0, 204, 1080).
"""
import sys
from PIL import Image

if len(sys.argv) != 9:
    sys.exit(__doc__)
frame_p, art_p, x, y, w, row, fill, out = sys.argv[1:]
x, y, w, row = int(x), int(y), int(w), int(row)
fr = Image.open(frame_p).convert('RGB')
art = Image.open(art_p).convert('RGB')
h = round(w * art.height / art.width)
art = art.resize((w, h), Image.LANCZOS)
W, H = fr.size
fill_rgb = tuple(int(fill.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
bottom = min(H, y + h)
if row < y or row >= bottom:
    sys.exit(f'from_row {row} is outside the art ({y}..{bottom})')
fr.paste(art.crop((0, row - y, w, bottom - y)), (x, row))
if bottom < H:
    fr.paste(Image.new('RGB', (W, H - bottom), fill_rgb), (0, bottom))
fr.save(out)
print(out)
