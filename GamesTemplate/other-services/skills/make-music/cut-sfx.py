"""Cut sound effects out of ACE-Step stingers (make-music, section "Sound effects").

usage: python -I cut-sfx.py <GameId> <run>

For every raw WAV of the run (music/runs/<run>/raw/<track>-<n>.wav) keep only its first `sfx_len` seconds (from the
spec's track, default 1.2) starting at the first onset, with a 6 ms fade-in and a smooth fade-out over the last 40%,
peak-normalised to -1 dBFS, mono, MP3 at ~40 kbps (the game's 1.5 MB audio budget, rule 13א).
Output: music/runs/<run>/game/<track>-<n>.mp3 (local only, like loopify's candidates).
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[4]
game, run = sys.argv[1], sys.argv[2]
MUSIC = ROOT / "Games" / game / "music"
spec = json.loads((MUSIC / "specs" / f"{run}.json").read_text(encoding="utf-8"))
RAW, OUT = MUSIC / "runs" / run / "raw", MUSIC / "runs" / run / "game"
OUT.mkdir(parents=True, exist_ok=True)

for wav in sorted(RAW.glob("*.wav")):
    track = wav.stem.rsplit("-", 1)[0]
    t = spec["tracks"].get(track)
    if t is None:
        raise SystemExit(f"{wav.name}: no track '{track}' in specs/{run}.json")
    x, sr = sf.read(wav, always_2d=True)
    x = x.mean(axis=1)
    env = np.abs(x)
    start = int(np.argmax(env > 0.05 * env.max()))          # the first onset: skip the silence the model leaves in front
    n = int(float(t.get("sfx_len", 1.2)) * sr)
    y = x[start:start + n].copy()
    fi = int(0.006 * sr); y[:fi] *= np.linspace(0, 1, fi)
    fo = int(len(y) * 0.4); y[-fo:] *= np.linspace(1, 0, fo) ** 2
    y = y / (np.abs(y).max() + 1e-9) * 0.89                 # -1 dBFS
    dst = OUT / f"{wav.stem}.mp3"
    sf.write(dst, y.astype(np.float32), sr, format="MP3", bitrate_mode="CONSTANT", compression_level=0.97)
    print(f"{dst.name}: {len(y) / sr:.2f} s, {dst.stat().st_size // 1024} KB")
