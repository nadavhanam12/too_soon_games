"""Turn the raw candidates of one run into game-ready MP3s (rule 13a budget: mono, small).

Tracks with loop_bars -> seamless loop: that many bars starting one bar in, with the bar after the
                         loop end crossfaded (equal-power) into the loop start.
Other tracks          -> trimmed trailing silence + short fade-out.
Output: Games/<GameId>/music/runs/<run>/game/<track>-<n>.mp3. Pruned candidates are skipped.

Run with the ACE-Step venv python (it has soundfile with MP3 write; there is no ffmpeg):
  <ACE-Step-1.5>/.venv/Scripts/python.exe -I GamesTemplate/other-services/skills/make-music/loopify.py <GameId> <run>
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(sys.argv[0]).resolve().parents[4]
MUSIC = ROOT / "Games" / sys.argv[1] / "music"
RUN = MUSIC / "runs" / sys.argv[2]
OUT = RUN / "game"
OUT.mkdir(exist_ok=True)
XF = 0.5  # crossfade seconds


# libsndfile maps compression_level 0..1 onto MP3 bitrate steps (measured at 48kHz mono):
# 0.85 -> 80kbps, 0.9 -> 56kbps. Instrumentals at 56; vocals at 80 so words stay clear.
def mp3(has_vocals):
    return dict(format="MP3", bitrate_mode="CONSTANT", compression_level=0.85 if has_vocals else 0.9)


def make_loop(x, sr, bpm, bars):
    bar = int(round(sr * 60 / bpm * 4))
    start, length, xf = bar, bar * bars, int(sr * XF)
    if start + length + xf > len(x):
        raise ValueError(f"track too short for {bars} bars at {bpm} bpm")
    seg = x[start : start + length + xf].copy()
    t = np.linspace(0, np.pi / 2, xf)
    seg[:xf] = seg[:xf] * np.sin(t) + seg[length : length + xf] * np.cos(t)
    return seg[:length]


def trim_and_fade(x, sr, fade=0.8):
    loud = np.nonzero(np.abs(x) > 0.01)[0]
    x = x[: loud[-1] + int(0.2 * sr)] if len(loud) else x
    n = min(int(fade * sr), len(x))
    x = x.copy()
    x[-n:] *= np.linspace(1, 0, n)
    return x


log = json.loads((RUN / "prompts.json").read_text(encoding="utf-8"))
for name, t in log.items():
    vocals = t.get("lyrics", "[Instrumental]") != "[Instrumental]"
    for r in t["results"]:
        if r.get("pruned"):
            continue
        x, sr = sf.read(MUSIC / r["file"], always_2d=True)
        x = x.mean(axis=1)
        bpm = float((r.get("metas") or {}).get("bpm") or t["bpm"])
        y = make_loop(x, sr, bpm, t["loop_bars"]) if t.get("loop_bars") else trim_and_fade(x, sr)
        y = y / max(1e-9, np.abs(y).max()) * 0.89  # peak -1 dBFS
        dst = OUT / f"{name}-{r['n']}.mp3"
        sf.write(dst, y.astype(np.float32), sr, **mp3(vocals))
        print(f"{dst.name}: {len(y) / sr:5.1f}s  {dst.stat().st_size // 1024:4d}KB  bpm={bpm:g}")
